// ═══════════════════════════════════════════════════════════════════
// KR-COMPLETIONS MODULE - Public API
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type {
  KRCompletion,
  CreateKRCompletionInput,
  KRCompletionFilters,
} from './types';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS & QUERY KEYS
// ═══════════════════════════════════════════════════════════════════

export { krCompletionKeys, KR_COMPLETIONS_STORAGE_KEY } from './constants';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY
// ═══════════════════════════════════════════════════════════════════

export type { IKRCompletionsRepository } from './repository';
export { LocalStorageKRCompletionsRepository } from './repository';

// ═══════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════

export {
  useKRCompletions,
  useCreateKRCompletion,
} from './hooks';
