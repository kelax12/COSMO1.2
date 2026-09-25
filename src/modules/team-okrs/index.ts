// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS MODULE - Public API
// ═══════════════════════════════════════════════════════════════════

export type {
  TeamOKR,
  TrashedTeamOKR,
  TeamKeyResult,
  CreateTeamOKRInput,
  CreateTeamKRInput,
  UpdateTeamOKRInput,
  UpdateTeamKRInput,
  SyncTeamKRInput,
} from './types';

export { teamOkrKeys, TEAM_OKRS_STORAGE_KEY } from './constants';

// ─── Validation ──────────────────────────────────────────────────────
// Les schémas ne sont PLUS réexportés ici : ils importent zod, et un barrel qui
// les porte rattache zod à tout fichier l'important pour une autre raison. Ils
// se chargent à la demande via `@/lib/validation/lazy` (cf. son en-tête).

export type { ITeamOKRsRepository } from './repository';
export { LocalStorageTeamOKRsRepository } from './local.repository';
export { SupabaseTeamOKRsRepository } from './supabase.repository';

export {
  useTeamOKRs,
  useCreateTeamOKR,
  useEditTeamOKR,
  useDeleteTeamOKR,
  useTeamOKRTrash,
  useRestoreTeamOKR,
  usePurgeTeamOKR,
  useUpdateTeamKR,
} from './hooks';

// Exécution (mig. 160) : cycles, projets reliés à un KR, points d'étape.
export type {
  OkrCycle,
  CreateOkrCycleInput,
  KRProjectLink,
  KRCheckin,
  PostKRCheckinInput,
  ProjectHealth,
} from './execution.types';
export {
  useOkrCycles,
  useCreateOkrCycle,
  useDeleteOkrCycle,
  useKRProjects,
  useSetKRProjects,
  useKRCheckins,
  usePostKRCheckin,
} from './execution.hooks';
