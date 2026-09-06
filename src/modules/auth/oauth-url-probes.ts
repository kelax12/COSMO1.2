// ═══════════════════════════════════════════════════════════════════
// Ce que le retour OAuth raconte de travers
//
// FRONTIÈRE : deux sondes qui lisent l'URL au retour du fournisseur. Elles
// ne connaissent ni la session, ni le contexte d'authentification, ni le
// routeur : elles inspectent `window.location`, signalent, et nettoient.
//
// 🔴 Les deux existent parce qu'un échec OAuth est SILENCIEUX par défaut :
//   • un refus revient dans l'URL, pas dans une exception —
//     `detectSessionInUrl` n'ouvre alors aucune session et ne dit rien, et
//     côté utilisateur la connexion « a marché » puis l'app est vide ;
//   • une session qui s'ouvre à une autre adresse que celle demandée veut
//     dire que GoTrue a substitué le Site URL, donc que la « Redirect URL
//     allow list » du projet ne couvre pas la destination — et l'invitation
//     que portait le lien vient de se perdre (sonde C-45).
//
// ⚠️ Le nettoyage d'URL ne retire QUE les paramètres d'erreur. Réécrire sur
// le seul `pathname` jetait la query string entière, `?redirect=` compris :
// un échec transitoire faisait perdre la destination d'une invitation
// d'entreprise, donc le jeton à usage unique qu'elle portait (garde R-04).
//
// Extrait de `AuthContext.tsx` le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import { toast } from 'sonner';
import * as monitoring from '@/lib/monitoring';
import { reportOAuthLandingMismatch } from './oauth-landing';
import { translator } from '@/i18n/useT';

/**
 * Le fournisseur OAuth renvoie ses echecs dans l'URL, pas dans une exception.
 *
 * Google redirige vers `/dashboard?error=access_denied&error_description=...`
 * (ou la meme chose dans le fragment, selon le flux). `detectSessionInUrl`
 * n'ouvre alors aucune session et ne signale rien : cote utilisateur, la
 * connexion « a marche » puis l'app est vide. On lit ces parametres au
 * demarrage pour en laisser une trace exploitable, puis on nettoie l'URL
 * (elle peut contenir un identifiant de tentative).
 *
 * Retourne la description lisible s'il y en a une.
 */
export const consumeOAuthErrorFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const code = query.get('error') ?? hash.get('error');
    if (!code) return null;
    const description =
      query.get('error_description') ?? hash.get('error_description') ?? code;
    console.error('[auth] retour OAuth en erreur', code, description);
    monitoring.captureMessage(`OAuth callback error: ${code}`, {
      level: 'warning',
      tags: { context: 'oauth-callback' },
    });
    // Nettoie l'URL : sans ca, un rechargement rejoue l'erreur a l'infini.
    //
    // 🔴 On ne retire QUE les parametres d'erreur. Reecrire sur le seul
    // `pathname` jetait la query string entiere, `?redirect=` compris : un
    // echec OAuth transitoire faisait perdre la destination d'une invitation
    // d'entreprise, donc le jeton a usage unique qu'elle portait (garde R-04).
    for (const key of ['error', 'error_code', 'error_description']) query.delete(key);
    const remaining = query.toString();
    const clean = `${window.location.pathname}${remaining ? `?${remaining}` : ''}`;
    window.history.replaceState(null, '', clean);
    return description;
  } catch {
    return null;
  }
};

/**
 * Sonde C-45 : appelée au moment où une session s'ouvre réellement.
 *
 * Une intention de redirection n'existe que si `loginWithGoogle` vient de
 * partir chez Google depuis cet onglet. Si une session s'ouvre alors que
 * l'URL courante n'est pas celle qu'on avait demandée, c'est que GoTrue a
 * substitué le Site URL, donc que la « Redirect URL allow list » du projet
 * ne couvre pas la destination. On le dit à l'exploitant (console + Sentry)
 * ET à l'utilisateur, dont l'invitation vient de se perdre.
 */
export const checkOAuthLanding = (): void => {
  if (typeof window === 'undefined') return;
  const mismatch = reportOAuthLandingMismatch(window.location.href);
  if (!mismatch) return;
  // Toast différé : Sonner est monté par App, sous ce provider.
  setTimeout(() => {
    toast.error(translator('common').t('auth.oauthRedirectLostTitle'), {
      description: translator('common').t('auth.oauthRedirectLostBody'),
    });
  }, 0);
};
