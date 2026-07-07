// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS MODULE - Public API
// ═══════════════════════════════════════════════════════════════════

export type {
  TeamOKR,
  TeamKeyResult,
  CreateTeamOKRInput,
  CreateTeamKRInput,
  UpdateTeamOKRInput,
  UpdateTeamKRInput,
} from './types';

export { teamOkrKeys, TEAM_OKRS_STORAGE_KEY } from './constants';

export {
  createTeamOKRSchema,
  createTeamKRSchema,
  updateTeamKRSchema,
} from './team-okr.schema';

export type { ITeamOKRsRepository } from './repository';
export { LocalStorageTeamOKRsRepository } from './local.repository';
export { SupabaseTeamOKRsRepository } from './supabase.repository';

export {
  useTeamOKRs,
  useCreateTeamOKR,
  useUpdateTeamOKR,
  useDeleteTeamOKR,
  useUpdateTeamKR,
} from './hooks';
