// ═══════════════════════════════════════════════════════════════════
// Actions groupées branchées sur les mutations : PARTOUT où il y a une liste
// de tâches (cohérence globale, 2026-09-25)
//
// Elles n'existaient que dans l'onglet Projets. Le tableau de l'onglet Tâches,
// « Mes tâches » de l'Aperçu et les tâches d'une fiche membre obligeaient à
// ouvrir chaque tâche une par une. Ce hook porte le même lot, avec les mêmes
// « Annuler », que Projets ; `TeamTasksBulkLayer` porte la même barre.
// ═══════════════════════════════════════════════════════════════════

import { useMyOrgPermissions } from '@/modules/organizations';
import {
  useUpdateTeamTask, useDeleteTeamTask, useRestoreTeamTask, type TeamTask,
} from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import { useTeamTasksSelection } from './use-team-tasks-selection';

export const useTeamTasksBulk = (orgId: string, visibleTasks: TeamTask[]) => {
  const { canAssign } = useMyOrgPermissions(orgId);
  const { tp } = useT('org');
  // Libellés d'annulation lus au moment du geste : la barre, chargée avec le
  // catalogue `portfolio`, est toujours montée avant qu'un geste soit possible.
  const { tp: tpf } = useT('portfolio');
  const updateTask = useUpdateTeamTask(orgId);
  const deleteTask = useDeleteTeamTask(orgId);
  const restoreTask = useRestoreTeamTask(orgId);
  const selection = useTeamTasksSelection({
    visibleTasks,
    setCompleted: (task, completed) => updateTask.mutate({ taskId: task.id, input: { completed } }),
    deleteTask: (taskId) => deleteTask.mutate(taskId),
    restoreTask: (task) => restoreTask.mutate(task.id),
    deletedLabel: (count) => tp('projects.bulkDeleted', count),
    updateTask: (task, input) => updateTask.mutate({ taskId: task.id, input }),
    labels: {
      reassigned: (count) => tpf('bulk.reassigned', count),
      moved: (count) => tpf('bulk.moved', count),
      statusChanged: (count) => tpf('bulk.statusChanged', count),
    },
    canAssign,
  });
  return { ...selection, canAssign };
};

export type TeamTasksBulk = ReturnType<typeof useTeamTasksBulk>;
