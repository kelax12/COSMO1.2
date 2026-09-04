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
  TeamLabel,
  CreateTeamLabelInput,
  UpdateTeamLabelInput,
  TeamTaskLabel,
  TeamTaskDependency,
  TeamTaskActivity,
  TeamActivityField,
  CreateTeamTaskInput,
  UpdateTeamTaskInput,
  TeamTaskFilters,
  TeamTaskComment,
  CreateTeamTaskCommentInput,
} from './types';

export {
  teamProjectKeys,
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
  useTeamTasks,
  useCreateTeamProject,
  useUpdateTeamProject,
  useArchiveTeamProject,
  useCreateTeamTask,
  useUpdateTeamTask,
  useTeamSubtasks,
  useCreateTeamSubtask,
  useUpdateTeamSubtask,
  useDeleteTeamSubtask,
  useTeamLabels,
  useTeamTaskLabels,
  useTeamTaskDependencies,
  useAddTaskDependency,
  useRemoveTaskDependency,
  useCreateTeamLabel,
  useUpdateTeamLabel,
  useDeleteTeamLabel,
  useToggleTaskLabel,
  useTeamTaskActivity,
  useOrgActivity,
  useDeleteTeamTask,
  useTeamTaskComments,
  useAddTeamTaskComment,
  useDeleteTeamTaskComment,
} from './hooks';

// Restauration d'un commentaire supprime (« Annuler », C-42).
export { useRestoreComment } from './restore-comment.hooks';
