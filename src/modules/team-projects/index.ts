// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS MODULE - Public API
// ═══════════════════════════════════════════════════════════════════

export type {
  TeamProject,
  CreateTeamProjectInput,
  UpdateTeamProjectInput,
  TeamTask,
  TeamTaskStatus,
  TeamSubtask,
  CreateTeamSubtaskInput,
  UpdateTeamSubtaskInput,
  TeamTaskDependency,
  TeamTaskActivity,
  TeamActivityField,
  CreateTeamTaskInput,
  UpdateTeamTaskInput,
  TeamTaskFilters,
  TeamTaskComment,
  CreateTeamTaskCommentInput,
  TeamTrashedTask,
  TeamProjectStatus,
  TeamProjectHealth,
  TeamProjectRole,
  TeamProjectMember,
  TeamProjectTaskStats,
  TeamMemberWorkload,
  TeamProjectTemplatePayload,
  TeamProjectDependency,
  TeamProjectTeam,
  DraftProjectTask,
} from './types';

export {
  teamProjectKeys,
  TEAM_TASKS_READ_LIMIT,
  TEAM_TASK_TRASH_DAYS,
  TEAM_TASK_TRASH_STORAGE_KEY,
  TEAM_PROJECTS_STORAGE_KEY,
  TEAM_TASKS_STORAGE_KEY,
} from './constants';

// ─── Validation ──────────────────────────────────────────────────────
// Les schémas ne sont PLUS réexportés ici : ils importent zod, et un barrel qui
// les porte rattache zod à tout fichier l'important pour une autre raison. Ils
// se chargent à la demande via `@/lib/validation/lazy` (cf. son en-tête).

export type { ITeamProjectsRepository } from './repository';
export { LocalStorageTeamProjectsRepository } from './local.repository';
export { SupabaseTeamProjectsRepository } from './supabase.repository';

export {
  useTeamProjects,
  useTeamProjectTemplates,
  useTeamTasks,
  useTeamTaskWorkingSet,
  useTeamTaskSlice,
  useTeamTaskPages,
  useUpdateTeamProject,
  useCreateTeamTask,
  useUpdateTeamTask,
  useTeamSubtasks,
  useCreateTeamSubtask,
  useUpdateTeamSubtask,
  useDeleteTeamSubtask,
  useTeamTaskDependencies,
  useAddTaskDependency,
  useRemoveTaskDependency,
  useOrgActivity,
  useDeleteTeamTask,
  useRestoreTeamTask,
  usePurgeTeamTask,
  useTeamTrash,
  useTeamTaskComments,
  useAddTeamTaskComment,
  useDeleteTeamTaskComment,
} from './hooks';

// Portefeuille (mig. 153, M2) : création atomique, dépendances.
export {
  useCreateTeamProjectWithTasks,
  useTeamProjectDependencies,
  useAddProjectDependency,
  useRemoveProjectDependency,
  // Mig. 164 : équipes associées, purge d'un projet archivé.
  useTeamProjectTeams,
  useAddProjectTeam,
  useRemoveProjectTeam,
  usePurgeArchivedProject,
} from './portfolio.hooks';

// Membres et rôles par projet, chiffres comptés par le serveur (mig. 190, 191).
export {
  useTeamProjectMembers,
  useSetProjectMember,
  useRemoveProjectMember,
  useTeamProjectTaskStats,
  useTeamMemberWorkload,
} from './access.hooks';

// Restauration d'un commentaire supprime (« Annuler », C-42).
export { useRestoreComment } from './restore-comment.hooks';

// Historique par tâche (mig. 094), fiche de tâche d'équipe.
export {
  useTeamTaskActivity,
  useApplyTeamTaskDraft,
  type TeamTaskDraftExtras,
} from './task-extras.hooks';
// Suivre une tâche ou un projet (mig. 162, M14).
export { useMyFollows, useToggleFollow, type FollowTarget, type MyFollows } from './follows.hooks';
