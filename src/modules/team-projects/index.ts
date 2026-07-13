// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS MODULE - Public API
// ═══════════════════════════════════════════════════════════════════

export type {
  TeamProject,
  CreateTeamProjectInput,
  UpdateTeamProjectInput,
  TeamTask,
  CreateTeamTaskInput,
  UpdateTeamTaskInput,
  TeamTaskFilters,
} from './types';

export {
  teamProjectKeys,
  TEAM_PROJECTS_STORAGE_KEY,
  TEAM_TASKS_STORAGE_KEY,
} from './constants';

export {
  createTeamProjectSchema,
  updateTeamProjectSchema,
  createTeamTaskSchema,
  updateTeamTaskSchema,
} from './team-task.schema';

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
  useDeleteTeamTask,
} from './hooks';
