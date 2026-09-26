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
  useUpdateTeamKR,
} from './hooks';

// Exécution (mig. 160, M3) : cycles et projets reliés aux KR, branchés sur la
// fiche d'OKR d'équipe (audit des popups, 2026-09-25).
export type { OkrCycle, KRProjectLink } from './execution.types';
export {
  useOkrCycles,
  useCreateOkrCycle,
  useKRProjects,
  useSetKRProjects,
} from './execution.hooks';
