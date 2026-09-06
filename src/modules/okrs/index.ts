// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - Public API
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type { 
  OKR, 
  KeyResult,
  CreateOKRInput, 
  UpdateOKRInput,
  UpdateKeyResultInput,
  OKRFilters,
  OKRStatus,
} from './types';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS & QUERY KEYS
// ═══════════════════════════════════════════════════════════════════

export { okrsKeys, OKRS_STORAGE_KEY } from './constants';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY
// ═══════════════════════════════════════════════════════════════════

export type { IOKRsRepository } from './repository';
export { LocalStorageOKRsRepository } from './repository';

// ═══════════════════════════════════════════════════════════════════
// PROGRESS (fonction pure — source unique du calcul pondéré)
// ═══════════════════════════════════════════════════════════════════

export { recalcProgress, krWeight } from './progress';
export type { OKRProgress } from './progress';

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════

export {
  useOkrs,
  useActiveOkrs,
} from './hooks';

// ═══════════════════════════════════════════════════════════════════
// WRITE HOOKS (Mutations)
// ═══════════════════════════════════════════════════════════════════

export {
  useCreateOkr,
  useUpdateOkr,
  useDeleteOkr,
  useUpdateKeyResult,
} from './hooks';

// ═══════════════════════════════════════════════════════════════════
// DERIVED HOOKS (Performance Optimized)
// ═══════════════════════════════════════════════════════════════════

// 🗑️ `hooks.derived.ts` a été SUPPRIMÉ le 2026-09-05 (C-49) : ses sept
// sélecteurs et le type `EnrichedKeyResult` n'avaient aucun consommateur. Le
// fichier était orphelin EN ENTIER. Cf. la note du baril `tasks`.

// Restauration AVEC le journal des completions (C-01).
export { useRestoreOkrWithJournal } from './restore-journal.hooks';
export type { RestoreOkrPayload } from './restore-journal.hooks';
