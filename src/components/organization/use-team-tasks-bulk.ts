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
      // Dans `org`, pas `portfolio` : chaque liste qui monte ce hook porterait
      // sinon ce catalogue (cf. lazy-namespaces.guard).
      // Un seul libellé pour les trois gestes : le toast dit ce qui s'annule
      // (« 3 tâches mises à jour »), le geste vient d'être fait sous les yeux.
      reassigned: (count) => tp('bulkUndo.updated', count),
      moved: (count) => tp('bulkUndo.updated', count),
      statusChanged: (count) => tp('bulkUndo.updated', count),
    },
    canAssign,
  });
  return { ...selection, canAssign };
};

export type TeamTasksBulk = ReturnType<typeof useTeamTasksBulk>;
