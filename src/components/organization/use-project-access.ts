// Rôles par projet (mig. 190) et avancement compté par le serveur (mig. 191),
// lus UNE fois pour tout l'onglet Projets. Extrait de `TeamProjectsTab` pour
// le garder sous le plafond de 600 lignes (`architecture.guard.test.ts`).

import { useMemo } from 'react';
import { useTeamProjectMembers, useTeamProjectTaskStats, type TeamProject } from '@/modules/team-projects';

export function useProjectAccess(orgId: string, currentUserId: string | undefined) {
  const { data: projectMembers = [] } = useTeamProjectMembers(orgId);
  const { data: statsRows } = useTeamProjectTaskStats(orgId);
  // `undefined` tant que la réponse n'est pas arrivée : les écrans retombent
  // alors sur le calcul local, au lieu d'afficher 0 % partout.
  const statsById = useMemo(() => (statsRows ? new Map(statsRows.map((s) => [s.projectId, s])) : undefined), [statsRows]);
  /** Co-pilote (`lead`) de ce projet : pilote comme le responsable. */
  const isLeadOf = (p: TeamProject) =>
    !!currentUserId && projectMembers.some((m) => m.projectId === p.id && m.userId === currentUserId && m.role === 'lead');
  return { projectMembers, statsById, isLeadOf };
}
