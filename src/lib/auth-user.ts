// ═══════════════════════════════════════════════════════════════════
// auth-user — résolution de l'utilisateur courant SANS aller-retour réseau.
//
// Pourquoi ce module (audit architecture 2026-08-07, point C4) :
//
// `supabase.auth.getUser()` fait un **appel réseau** vers `/auth/v1/user`
// pour re-valider le JWT auprès de GoTrue. Il était appelé sur ~45 sites,
// dont l'entrée de presque chaque lecture de repository — donc chaque
// `getAll()` / `create()` payait un RTT complet AVANT même de toucher
// PostgREST. Deux conséquences mesurables :
//
//   1. Latence perçue doublée sur mobile (2 RTT au lieu d'1 par écran).
//   2. GoTrue devenait un SPOF pour la LECTURE DE DONNÉES : une panne du
//      service d'auth faisait échouer toutes les requêtes, pas seulement
//      le login.
//
// `getSession()` lit le JWT déjà stocké localement (localStorage) et ne
// part sur le réseau que si le token doit être rafraîchi. Pour tout ce
// dont nous avons besoin — l'`id` de l'utilisateur, pour l'écrire dans
// `user_id` ou scoper une requête — c'est strictement équivalent :
//
//   • L'`id` provient du JWT signé par Supabase dans les deux cas.
//   • Un `id` falsifié côté client ne sert à rien : la frontière de
//     sécurité reste la RLS, qui utilise `auth.uid()` lu du JWT PAR LE
//     SERVEUR. Un attaquant qui mentirait ici ne ferait qu'échouer son
//     propre INSERT (`WITH CHECK (auth.uid() = user_id)`).
//
// ⚠️ Ne PAS utiliser ce helper pour une décision d'autorisation côté
// client. Il répond à « quel est mon id ? », jamais à « ai-je le droit ? ».
// ═══════════════════════════════════════════════════════════════════
import { supabase } from '@/lib/supabase';

/** Identité minimale exposée aux repositories (surface volontairement étroite). */
export interface CurrentUser {
  id: string;
  email?: string;
}

/**
 * Utilisateur courant (identité seulement), ou `null` si aucune session locale.
 * Remplacement direct de `const { data: { user } } = await supabase.auth.getUser()`.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  return user ? { id: user.id, email: user.email ?? undefined } : null;
}

/**
 * Id de l'utilisateur courant, ou `null` si aucune session locale.
 * Lecture locale : pas d'aller-retour réseau (cf. en-tête du module).
 */
export async function getCurrentUserId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}

/**
 * Comme `getCurrentUserId`, mais lève quand aucune session n'est présente.
 * À utiliser sur les chemins d'ÉCRITURE, qui ont besoin d'un `user_id`
 * et n'ont aucun comportement dégradé sensé sans session.
 */
export async function requireCurrentUserId(): Promise<string> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not authenticated');
  return uid;
}

/**
 * Email de l'utilisateur courant (session locale), ou `null`.
 * Utilisé par les flux « inviter par email » pour se comparer soi-même.
 */
export async function getCurrentUserEmail(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.email ?? null;
}
