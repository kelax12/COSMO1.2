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
// `LocalStorageKRCompletionsRepository` n'est PAS ré-exporté (V12.3) : il vit dans
// `./local.repository` et n'arrive que par `import()`, depuis le factory.

// ═══════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════

export {
  useKRCompletions,
  useKRCompletionsExport,
  useLoadOkrJournal,
} from './hooks';
