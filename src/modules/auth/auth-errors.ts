import { translator } from '@/i18n/useT';

// ═══════════════════════════════════════════════════════════════════
// AUD-05 — Ne jamais renvoyer `error.message` brut à l'UI
//
// `login` et `register` étaient les deux derniers chemins à échapper à la
// règle V7/N1 appliquée partout ailleurs via `normalizeApiError`. Le cas qui
// compte est `signUp` sur une adresse déjà enregistrée : Supabase répond
// « User already registered » (code `user_already_exists`), ce qui transforme
// le formulaire d'inscription en oracle d'existence de compte — de quoi
// vérifier en masse quelles adresses d'une fuite tierce ont un compte COSMO,
// puis cibler le credential stuffing.
//
// Contrat : seuls des codes explicitement whitelistés produisent un message
// spécifique ; tout le reste retombe sur un texte générique identique.
//
// ⚠️ Extrait de `AuthContext.tsx` le 2026-08-28, et c'est le cliquet de taille
// qui l'a imposé : le fichier était à 626 lignes pour un budget qui n'avait
// plus qu'UNE ligne de marge, et le cas captcha en demandait quatre. La garde
// ne demande jamais de refactor, elle rend le refactor moins cher que le
// contournement — cinquième fois que la séquence est identique.
//
// La coupe suit une frontière réelle : d'un côté une fonction pure de
// traduction d'erreur, testable sans React ni Supabase ; de l'autre le
// provider qui tient la session.
// ═══════════════════════════════════════════════════════════════════

// 🔴 Des FONCTIONS, pas des constantes. Ces messages étaient des littéraux
// français évalués À L'IMPORT : ils figeaient la langue pour toute la session
// et s'affichaient tels quels à un anglophone. `translator` doit être appelé
// au moment où le message est produit, jamais au niveau du module.
export const authLoginGeneric = (): string => translator('common').t('auth.loginGeneric');
export const authRegisterGeneric = (): string => translator('common').t('auth.registerGeneric');

export type SupabaseAuthErrorLike = { code?: string; status?: number; message?: string };

export const safeAuthError = (error: SupabaseAuthErrorLike, fallback: string): string => {
  // Loggé pour l'ops (droppé du bundle prod par esbuild, remonté par Sentry).
  console.error('[auth]', error.code ?? error.status ?? 'unknown', error.message);
  const t = translator('common').t;
  const code = error.code;
  // ⚠️ Ce message est EXACT côté serveur et TROMPEUR côté utilisateur quand la
  // cause est le quota d'emails du projet : il n'a rien fait de trop, c'est le
  // plafond de l'expéditeur — éventuellement consommé par quelqu'un d'autre —
  // qui est atteint. Il ne peut pas être précisé sans distinguer les deux
  // codes, et GoTrue ne les distingue pas toujours. La vraie sortie est le
  // SMTP applicatif (docs/DEPLOYMENT.md §2ter), pas une meilleure phrase.
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || error.status === 429) {
    return t('auth.tooManyAttempts');
  }
  if (code === 'weak_password') {
    return t('auth.weakPassword');
  }
  if (code === 'email_address_invalid') {
    return t('auth.invalidEmailAddress');
  }
  // Vérification anti-robot refusée ou expirée. Le jeton Turnstile est à usage
  // unique et court : le cas normal n'est pas une attaque, c'est un formulaire
  // resté ouvert trop longtemps. On le dit, et l'écran réarme le widget.
  if (code === 'captcha_failed') {
    return t('auth.captchaFailed');
  }
  return fallback;
};
