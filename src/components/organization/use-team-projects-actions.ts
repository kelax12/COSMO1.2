// ═══════════════════════════════════════════════════════════════════
// Actions de l'onglet Projets — mutations et leurs filets (« Annuler »)
//
// Extrait de `TeamProjectsTab` le 2026-09-24 : l'onglet frôlait le plafond de
// 600 lignes, et le portefeuille (M2) lui ajoutait archivage, duplication et
// modèles. Ce hook ne rend rien : il porte les gestes, l'onglet les place.
// ═══════════════════════════════════════════════════════════════════

import { toast } from '@/lib/toast';
import { showUndoToast } from '@/lib/undo-toast';
import {
  useCreateTeamProjectWithTasks,
  useUpdateTeamProject,
  useCreateTeamTask,
  useUpdateTeamTask,
  useDeleteTeamTask,
  useRestoreTeamTask,
  type TeamProject,
  type TeamProjectMilestone,
  type TeamTask,
  type TeamTaskStatus,
  type UpdateTeamProjectInput,
} from '@/modules/team-projects';
import { buildTemplatePayload, duplicateBlueprint } from './portfolio.helpers';
import { useT } from '@/i18n/useT';

interface Options {
  orgId: string;
  currentUserId?: string;
  allTasks: TeamTask[];
  milestones: TeamProjectMilestone[];
  /** Ouvre la page d'un projet (après duplication). */
  onOpenProject: (projectId: string) => void;
}

export const useTeamProjectsActions = ({
  orgId, currentUserId, allTasks, milestones, onOpenProject,
}: Options) => {
  const { t } = useT('org');
  const { t: pf } = useT('portfolio');
  const createProjectWithTasks = useCreateTeamProjectWithTasks(orgId);
  const updateProject = useUpdateTeamProject(orgId);
  const createTask = useCreateTeamTask(orgId);
  const updateTask = useUpdateTeamTask(orgId);
  const deleteTask = useDeleteTeamTask(orgId);
  // « Annuler » = sortir de la corbeille (mig. 152), à l'identique : commentaires,
  // sous-tâches et historique compris. L'ancien « Annuler » recréait une tâche neuve.
  const restoreTask = useRestoreTeamTask(orgId);

  // ─── Projets ────────────────────────────────────────────────────────

  const patchProject = (project: TeamProject, input: UpdateTeamProjectInput) =>
    updateProject.mutateAsync({ projectId: project.id, input });

  /**
   * Archiver avec « Annuler » : le reste de l'application en propose un pour
   * chaque geste lourd, l'archivage n'en avait pas (audit 2026-09-24).
   */
  const archiveWithUndo = (project: TeamProject) =>
    updateProject.mutate(
      { projectId: project.id, input: { archived: true } },
      {
        onSuccess: () =>
          showUndoToast(pf('archived'), () =>
            updateProject.mutate({ projectId: project.id, input: { archived: false } }),
          ),
      },
    );

  const restoreProject = (project: TeamProject) =>
    updateProject.mutate({ projectId: project.id, input: { archived: false } });

  const duplicateProject = (project: TeamProject) => {
    const blueprint = duplicateBlueprint(project, allTasks, milestones, {
      name: pf('copyName', { name: project.name }).slice(0, 120),
      ownerId: currentUserId ?? null,
    });
    createProjectWithTasks.mutate(blueprint, {
      onSuccess: (newId) => {
        toast.success(pf('duplicated'));
        onOpenProject(newId);
      },
    });
  };

  /** Modèle = contenu en JSON, jamais de vraies tâches (cf. mig. 153). */
  const saveAsTemplate = (project: TeamProject) =>
    createProjectWithTasks.mutate(
      {
        input: {
          name: pf('templateName', { name: project.name }).slice(0, 120),
          color: project.color,
          teamId: project.teamId ?? null,
          categoryId: project.categoryId ?? null,
          description: project.description ?? null,
          ownerId: currentUserId ?? null,
          status: 'planned',
          isTemplate: true,
          templatePayload: buildTemplatePayload(project, allTasks, milestones),
        },
      },
      { onSuccess: () => toast.success(pf('templateSaved')) },
    );

  const archiveTemplate = (template: TeamProject) =>
    updateProject.mutate({ projectId: template.id, input: { archived: true } });

  // ─── Tâches ─────────────────────────────────────────────────────────

  const toggleComplete = (task: TeamTask) =>
    updateTask.mutate({ taskId: task.id, input: { completed: !task.completed } });
  const setAssignees = (task: TeamTask, assigneeIds: string[]) =>
    updateTask.mutate({ taskId: task.id, input: { assigneeIds } });
  // `status` seul : le serveur synchronise `completed` (trigger mig. 091).
  const setStatus = (task: TeamTask, status: TeamTaskStatus) =>
    updateTask.mutate({ taskId: task.id, input: { status } });

  /**
   * Réassignation par glisser-déposer (kanban) — avec « Annuler ». Un drag se
   * déclenche à la souris sans confirmation : c'est le geste le plus facile à
   * faire par accident de toute la vue.
   */
  const setAssigneesWithUndo = (task: TeamTask, assigneeIds: string[]) => {
    const previous = task.assigneeIds;
    updateTask.mutate({ taskId: task.id, input: { assigneeIds } });
    showUndoToast(t('projects.reassigned'), () =>
      updateTask.mutate({ taskId: task.id, input: { assigneeIds: previous } }),
    );
  };

  const restoreDeletedTask = (task: TeamTask) => restoreTask.mutate(task.id);

  // Suppression avec « Annuler ».
  const removeWithUndo = (task: TeamTask) =>
    deleteTask.mutate(task.id, {
      onSuccess: () => showUndoToast(t('projects.taskDeleted'), () => restoreDeletedTask(task)),
    });

  return {
    patchProject,
    archiveWithUndo,
    restoreProject,
    duplicateProject,
    saveAsTemplate,
    archiveTemplate,
    toggleComplete,
    setAssignees,
    setStatus,
    setAssigneesWithUndo,
    restoreDeletedTask,
    removeWithUndo,
    createTaskAsync: createTask.mutateAsync,
    updateTaskAsync: updateTask.mutateAsync,
    updateTaskInput: (task: TeamTask, input: Parameters<typeof updateTask.mutate>[0]['input']) =>
      updateTask.mutate({ taskId: task.id, input }),
    deleteTaskById: (taskId: string) => deleteTask.mutate(taskId),
  };
};
