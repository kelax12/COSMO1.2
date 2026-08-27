// ═══════════════════════════════════════════════════════════════════
// Badge « Entreprise » (reco #7, version dérivée sans table dédiée) :
// demandes d'adhésion en attente (admins) + nouvelles tâches qui me sont
// assignées depuis ma dernière visite de /entreprise. Le compteur profite
// du polling existant de useTeamTasks (20 s) — pas de requête en plus.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useAuth } from '@/modules/auth/AuthContext';
import {
  useActiveOrganization, useOrgJoinRequests, useOrgNotifications, unreadCount,
} from '@/modules/organizations';
import { useTeamTasks } from '@/modules/team-projects';
import { computeOrgBadges, type OrgBadges } from './org-badges.helpers';

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

const EMPTY_BADGES: OrgBadges = {
  projects: 0, members: 0, total: 0, projectItems: [], memberItems: [],
};

/**
 * Compteurs ventilés par onglet — source unique du badge de navigation ET des
 * badges d'onglet de /entreprise. Le calcul est dans `org-badges.helpers.ts`
 * (testé) ; ce hook ne fait que rassembler ses entrées.
 */
export function useOrgBadges(): OrgBadges {
  const { user } = useAuth();
  const { activeOrg } = useActiveOrganization();
  const isAdmin = activeOrg?.myRole === 'admin';
  // Requêtes no-op (enabled: !!orgId) hors entreprise / hors admin.
  const { data: requests = [] } = useOrgJoinRequests(isAdmin ? activeOrg?.id : undefined);
  // `background` : ce hook est monté par `Layout`, donc sur toutes les pages
  // protégées. Il ne rend pas la liste, il en dérive un chiffre — voir la
  // justification complète sur `useTeamTasks`.
  const { data: tasks = [] } = useTeamTasks(activeOrg?.id, undefined, { background: true });
  const { data: notifications = [] } = useOrgNotifications(activeOrg?.id);

  return useMemo(() => {
    if (!activeOrg || !user?.id) return EMPTY_BADGES;
    const pending = requests.filter((r) => r.status === 'pending');
    return computeOrgBadges({
      userId: user.id,
      lastSeen: readOrgLastSeen(activeOrg.id),
      pendingRequests: pending.length,
      // `requesterName` n'est enrichi que pour la vue admin ; l'aperçu tombe
      // sur l'email, puis se tait — jamais sur un UUID, qui ne dit rien.
      pendingRequestNames: pending
        .map((r) => r.requesterName ?? r.requesterEmail ?? '')
        .filter(Boolean),
      tasks,
      unreadNotifications: unreadCount(notifications),
      unreadNotificationTaskIds: notifications
        .filter((n) => n.readAt === null && !!n.taskId)
        .map((n) => n.taskId as string),
    });
  }, [activeOrg, user?.id, requests, tasks, notifications]);
}

/** Total pour la pastille de navigation — signature inchangée (compat). */
export function useOrgNotificationCount(): number {
  return useOrgBadges().total;
}
