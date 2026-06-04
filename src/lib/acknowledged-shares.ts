// ═══════════════════════════════════════════════════════════════════
// ACKNOWLEDGED SHARES — acquittement local des tâches partagées reçues
//
// En mode Supabase, le partage est matérialisé par une ligne `shared_tasks`
// qui donne un accès en lecture IMMÉDIAT au destinataire (RLS). Le champ
// `sharedBy` affiché côté destinataire est DÉRIVÉ (enrichSharedBy) — il n'est
// pas persisté, donc on ne peut pas le « désactiver » en base pour sortir une
// tâche de la boîte de réception après acceptation.
//
// On persiste donc localement (par utilisateur) l'ensemble des tâches reçues
// que l'utilisateur a déjà acquittées (acceptées). Refuser, lui, supprime la
// grant `shared_tasks` (l'utilisateur perd l'accès) — pas besoin d'ack, mais
// on l'ajoute aussi pour éviter un flash le temps du refetch.
// ═══════════════════════════════════════════════════════════════════

const keyFor = (userId?: string) => `cosmo_ack_shares_${userId ?? 'anon'}`;

export function getAcknowledgedShares(userId?: string): Set<string> {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function acknowledgeShare(userId: string | undefined, taskId: string): void {
  const set = getAcknowledgedShares(userId);
  set.add(taskId);
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify([...set]));
  } catch {
    /* quota / mode privé — best effort */
  }
}
