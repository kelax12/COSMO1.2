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
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════

export {
  useOkrs,
  useOkr,
  useOkrsByCategory,
  useFilteredOkrs,
  useActiveOkrs,
  useCompletedOkrs,
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

export {
  useOkrsWithProgress,
  useOkrsByStatus,
  useOkrStats,
  useOkrsEndingSoon,
  useAtRiskOkrs,
  useKeyResults,
  useCompletedKeyResults,
} from './hooks.derived';

export type { EnrichedKeyResult } from './hooks.derived';
