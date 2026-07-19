// ═══════════════════════════════════════════════════════════════════
// Badge « Entreprise » (reco #7, version dérivée sans table dédiée) :
// demandes d'adhésion en attente (admins) + nouvelles tâches qui me sont
// assignées depuis ma dernière visite de /entreprise. Le compteur profite
// du polling existant de useTeamTasks (20 s) — pas de requête en plus.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useAuth } from '@/modules/auth/AuthContext';
import { useActiveOrganization, useOrgJoinRequests } from '@/modules/organizations';
import { useTeamTasks } from '@/modules/team-projects';

const lastSeenKey = (orgId: string) => `cosmo_org_last_seen_${orgId}`;

/** Timestamp (ms) de la dernière visite de /entreprise pour cette org. */
export function readOrgLastSeen(orgId: string): number {
  try {
    const raw = localStorage.getItem(lastSeenKey(orgId));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** À appeler quand l'utilisateur ouvre /entreprise : remet le badge à zéro. */
export function markOrgSeen(orgId: string): void {
  try { localStorage.setItem(lastSeenKey(orgId), String(Date.now())); } catch { /* no-op */ }
}

export function useOrgNotificationCount(): number {
  const { user } = useAuth();
  const { activeOrg } = useActiveOrganization();
  const isAdmin = activeOrg?.myRole === 'admin';
  // Requêtes no-op (enabled: !!orgId) hors entreprise / hors admin.
  const { data: requests = [] } = useOrgJoinRequests(isAdmin ? activeOrg?.id : undefined);
  const { data: tasks = [] } = useTeamTasks(activeOrg?.id);

  return useMemo(() => {
    if (!activeOrg || !user?.id) return 0;
    const lastSeen = readOrgLastSeen(activeOrg.id);
    const pendingRequests = requests.filter((r) => r.status === 'pending').length;
    const newAssigned = tasks.filter((t) => {
      if (t.completed || !t.assigneeIds.includes(user.id)) return false;
      if (t.createdBy === user.id) return false; // s'auto-assigner ne notifie pas
      const created = Date.parse(t.createdAt);
      return Number.isFinite(created) && created > lastSeen;
    }).length;
    return pendingRequests + newAssigned;
  }, [activeOrg, user?.id, requests, tasks]);
}
