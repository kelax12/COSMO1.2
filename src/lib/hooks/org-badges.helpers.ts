// ═══════════════════════════════════════════════════════════════════
// Compteurs de badge de l'espace entreprise
//
// Le calcul vivait inline dans `use-org-notifications.ts` et ne produisait
// qu'un total pour la navigation. Il est extrait ici pour être ventilé par
// onglet ET testé : c'est la seule partie qui décide quelque chose.
// ═══════════════════════════════════════════════════════════════════

import type { TeamTask } from '@/modules/team-projects';

export interface OrgBadgeInput {
  userId: string;
  /** Timestamp (ms) de la dernière visite de /entreprise. */
  lastSeen: number;
  /** Demandes d'adhésion en attente (0 si non-admin). */
  pendingRequests: number;
  tasks: TeamTask[];
}

export interface OrgBadges {
  /** Tâches nouvellement assignées → onglet Projets. */
  projects: number;
  /** Demandes d'adhésion en attente → onglet Membres. */
  members: number;
  /** Somme — c'est ce qu'affiche la pastille de navigation. */
  total: number;
}

export const computeOrgBadges = ({
  userId, lastSeen, pendingRequests, tasks,
}: OrgBadgeInput): OrgBadges => {
  const projects = tasks.filter((t) => {
    if (t.completed || !t.assigneeIds.includes(userId)) return false;
    // S'auto-assigner ne notifie pas : on sait déjà ce qu'on vient d'écrire.
    if (t.createdBy === userId) return false;
    const created = Date.parse(t.createdAt);
    return Number.isFinite(created) && created > lastSeen;
  }).length;

  return { projects, members: pendingRequests, total: projects + pendingRequests };
};
