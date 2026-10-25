// ═══════════════════════════════════════════════════════════════════
// Appartenance ACTIVE à une organisation, vue depuis une Edge Function
// (audit serveur du 2026-10-24, SV-1 et SV-2). Module PUR : aucun import Deno
// ni npm, exécuté par vitest (`src/edge-audit-serveur.guard.test.ts`).
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 Les Edge Functions lisent `organization_members` en service_role : la RLS
// ne les protège pas, et `is_org_member()` (mig. 161) non plus, puisqu'elle
// lit `auth.uid()`. Elles refaisaient donc la règle à la main, et ne
// regardaient que `suspended_at` : un admin dont l'accès avait EXPIRÉ
// (`access_expires_at` passé) envoyait encore des invitations au nom de
// l'organisation et vérifiait ses domaines. Même règle que la base, ici.

export interface MembershipState {
  suspended_at: string | null
  access_expires_at: string | null
}

/** Miroir de `is_org_member` : ni suspendu, ni expiré (`access_expires_at > now()`). */
export function membershipIsActive(m: MembershipState, nowMs: number): boolean {
  if (m.suspended_at) return false
  if (m.access_expires_at === null) return true
  const expires = Date.parse(m.access_expires_at)
  // Une date illisible n'ouvre rien.
  return Number.isFinite(expires) && expires > nowMs
}

export interface SuccessorCandidate extends MembershipState {
  user_id: string
  role: string
}

/**
 * Le successeur d'un propriétaire qui efface son compte (`delete-account`).
 *
 * 🔴 SV-2 : le choix prenait « le premier admin, sinon le premier membre »,
 * suspendus et expirés compris. Or un propriétaire ne peut être ni suspendu ni
 * restreint (`cannot_restrict_owner`, mig. 161) : la personne écartée devenait
 * propriétaire, c'est-à-dire seule à pouvoir ouvrir le portail de facturation,
 * résilier et se faire rembourser, et plus personne ne pouvait la restreindre.
 *
 * Ordre : admin actif, membre actif, puis, s'il ne reste QUE des membres
 * inactifs, l'ancien choix. ⚠️ Ce dernier cas est assumé : sans successeur,
 * `owner_id ON DELETE CASCADE` emporte l'organisation entière, et détruire les
 * données des autres membres serait pire. Il est remonté à l'arbitrage d'Axel.
 *
 * `candidates` arrive trié par ancienneté (`joined_at`), qui départage.
 */
export function pickOrgSuccessor<T extends SuccessorCandidate>(candidates: T[], nowMs: number): T | null {
  const active = candidates.filter((m) => membershipIsActive(m, nowMs))
  return active.find((m) => m.role === 'admin')
    ?? active[0]
    ?? candidates.find((m) => m.role === 'admin')
    ?? candidates[0]
    ?? null
}
