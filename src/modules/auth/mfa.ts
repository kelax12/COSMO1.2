// Second facteur (TOTP) — enrôlement, défi, et état de la garde `/admin`.
//
// La frontière de sécurité n'est PAS ici : c'est `public.is_admin()`
// (mig. 131), qui exige une session `aal2` avant que `get_admin_stats()`
// ne rende quoi que ce soit. Ce module ne fait que conduire l'utilisateur
// jusqu'à cette session — masquer un écran n'a jamais protégé une donnée.
//
// GoTrue porte tout l'état : la liste des facteurs et le niveau d'assurance
// se demandent au serveur, jamais au localStorage.
import { supabase } from '@/lib/supabase';
import { makeApiError } from '@/lib/normalizeApiError';

/** Ce que la page `/admin` doit afficher, avant toute requête de stats. */
export type AdminGateState = 'loading' | 'not-admin' | 'enrol' | 'challenge' | 'ready';

/** Niveau d'assurance de la session, tel que rendu par GoTrue. */
export interface AssuranceLevel {
  currentLevel: string | null;
  nextLevel: string | null;
}

/** Facteur MFA, réduit aux trois champs dont la garde a besoin. */
export interface MfaFactorLike {
  id: string;
  factor_type: string;
  status: string;
}

/** Secret TOTP + QR code d'un enrôlement en cours (jamais persisté). */
export interface TotpEnrolment {
  factorId: string;
  /** SVG complet rendu par GoTrue, à injecter tel quel. */
  qrSvg: string;
  /** Secret en base32, pour la saisie manuelle si le QR ne passe pas. */
  secret: string;
}

/**
 * Seuls les facteurs TOTP **vérifiés** comptent. Un enrôlement abandonné
 * laisse un facteur `unverified` derrière lui : le compter reviendrait à
 * demander un code à quelqu'un qui n'en a jamais validé un, donc à
 * l'enfermer dehors.
 */
export const countVerifiedTotp = (factors: MfaFactorLike[] | undefined): number =>
  (factors ?? []).filter((f) => f.factor_type === 'totp' && f.status === 'verified').length;

/**
 * Secret base32 groupé par 4, seule forme saisissable à la main sans erreur.
 *
 * Total par construction : cette fonction est appelée PENDANT LE RENDU de
 * l'écran d'enrôlement. Un `secret` absent y levait un `TypeError`, qui
 * remontait à l'`AppErrorBoundary` — l'admin voyait « Une erreur inattendue
 * s'est produite » à la place de son QR code, sans aucun moyen de savoir
 * pourquoi. Un helper d'affichage ne doit jamais pouvoir abattre la page
 * qui l'appelle.
 */
export const formatSecret = (secret: string | null | undefined): string =>
  (String(secret ?? '').match(/.{1,4}/g) ?? []).join(' ');

/**
 * L'écran à rendre, à partir des trois seules réponses qui comptent.
 *
 * L'ordre des tests est la garde elle-même :
 *   1. hors allowlist → rien, quel que soit le niveau ;
 *   2. session déjà aal2 → on passe, même si la liste des facteurs est vide
 *      (facteur retiré ailleurs pendant la session : elle a déjà prouvé) ;
 *   3. aucun facteur vérifié → enrôlement ;
 *   4. tout le reste → défi. Un niveau inconnu tombe donc sur le défi, pas
 *      sur `ready` : une garde ne se relâche pas sur une valeur manquante.
 */
export function deriveAdminGateState(input: {
  allowlisted: boolean | undefined;
  aal: AssuranceLevel | undefined;
  factors: number | undefined;
}): AdminGateState {
  const { allowlisted, aal, factors } = input;
  if (allowlisted === undefined || aal === undefined || factors === undefined) return 'loading';
  if (!allowlisted) return 'not-admin';
  if (aal.currentLevel === 'aal2') return 'ready';
  if (factors === 0) return 'enrol';
  return 'challenge';
}

/** Facteurs du compte courant. */
export async function listFactors(): Promise<MfaFactorLike[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data?.all ?? []) as MfaFactorLike[];
}

/** Niveau d'assurance de la session courante. */
export async function getAssuranceLevel(): Promise<AssuranceLevel> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return { currentLevel: data?.currentLevel ?? null, nextLevel: data?.nextLevel ?? null };
}

/**
 * Ouvre un enrôlement TOTP. Le facteur créé reste `unverified` jusqu'au
 * premier code valide : tant qu'il l'est, il ne protège rien et ne bloque
 * rien.
 */
export async function startTotpEnrolment(friendlyName: string): Promise<TotpEnrolment> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
  });
  if (error) throw error;

  // La forme de la réponse se vérifie ICI, à la frontière, et jamais dans le
  // rendu. Sans cette garde, un champ manquant devient un `TypeError` en
  // phase de rendu, donc l'écran d'erreur générique de l'`AppErrorBoundary` :
  // l'admin est bloqué dehors sans message exploitable, et la cause est
  // invisible. Une réponse malformée doit produire une ERREUR, pas un écran
  // blanc — l'appelant l'attrape déjà et affiche `mfa.enrolFailed`.
  const factorId = data?.id;
  const qrSvg = data?.totp?.qr_code;
  const secret = data?.totp?.secret;
  if (!factorId || !qrSvg || !secret) {
    throw makeApiError('mfa_enrol_malformed_response');
  }

  return { factorId, qrSvg, secret };
}

/**
 * Vérifie un code à 6 chiffres. En cas de succès, GoTrue réémet le jeton
 * avec `aal: 'aal2'` : c'est CE jeton que Postgres lira dans `is_admin()`.
 * Le `AuthContext` n'a rien à rafraîchir, le client Supabase porte déjà la
 * nouvelle session.
 */
export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw error;
}

/**
 * Abandon d'un enrôlement en cours. Ne jamais l'appeler sur un facteur
 * vérifié depuis l'écran de défi : retirer sa protection à quelqu'un qui
 * n'arrive pas à saisir son code, c'est transformer une gêne en trou.
 */
export async function cancelEnrolment(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}
