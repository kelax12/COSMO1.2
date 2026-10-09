// ═══════════════════════════════════════════════════════════════════
// Les tâches d'équipe dans la liste perso (mode entreprise)
//
// FRONTIÈRE : tout ce que la liste perso sait des tâches d'équipe qui me sont
// assignées, au même endroit. Les données (projets, tâches, membres pour la
// modale), la tâche ouverte, et les seuls gestes permis ici : cocher,
// changer l'État, enregistrer depuis `TeamTaskModal`. Le reste vit dans
// l'espace Entreprise (cf. `TeamTaskRowLite`).
//
// Les droits viennent de `usePermissionHints`, comme dans `TeamTasksTab` :
// un geste refusé se grise en disant pourquoi.
//
// Extrait de `TaskTable` le 2026-10-09 (budget 600 lignes).
// ═══════════════════════════════════════════════════════════════════
import { useCallback, useMemo, useState } from 'react';
import { useActiveOrganization, useOrgMembers } from '@/modules/organizations';
import {
  useTeamProjects, useTeamTasks, useUpdateTeamTask,
  type TeamProjectHealth, type TeamTask, type UpdateTeamTaskInput,
} from '@/modules/team-projects';
import { usePermissionHints } from '../organization/permission-hints';

export const useTeamTasksInList = () => {
  const { activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;
  const { data: teamProjects = [] } = useTeamProjects(orgId);
  const { data: allTeamTasks = [] } = useTeamTasks(orgId);
  const { data: orgMembers = [] } = useOrgMembers(orgId);
  const updateTeamTaskMutation = useUpdateTeamTask(orgId ?? '');
  const hints = usePermissionHints(orgId);
  const [editingTeamTask, setEditingTeamTask] = useState<TeamTask | null>(null);

  const teamProjectsById = useMemo(
    () => new Map(teamProjects.map((p) => [p.id, p])),
    [teamProjects],
  );

  const toggleComplete = useCallback((task: TeamTask) => {
    updateTeamTaskMutation.mutate({ taskId: task.id, input: { completed: !task.completed } });
    /* eslint-disable-next-line react-hooks/exhaustive-deps --
    `updateTeamTaskMutation` est recree a chaque rendu alors que son
       `.mutate` est stable (React Query) : le mettre en dependance recreerait
       ce callback a chaque rendu. `orgId` est la seule valeur dont depend la
       mutation, et elle y est. */
  }, [orgId]);

  // Colonne État : même mutation que la colonne des tâches d'équipe (`TeamTasksTab`).
  const setHealth = useCallback((task: TeamTask, health: TeamProjectHealth) => {
    updateTeamTaskMutation.mutate({ taskId: task.id, input: { health } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- même raison que ci-dessus
  }, [orgId]);

  const updateFromModal = (taskId: string, input: UpdateTeamTaskInput) =>
    updateTeamTaskMutation.mutateAsync({ taskId, input });

  return {
    orgId,
    teamProjects,
    allTeamTasks,
    orgMembers,
    teamProjectsById,
    editingTeamTask,
    setEditingTeamTask,
    toggleComplete,
    setHealth,
    editReason: hints.taskEditReason,
    updateFromModal,
  };
};
