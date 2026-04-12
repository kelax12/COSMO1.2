// ═══════════════════════════════════════════════════════════════════
// KR-COMPLETIONS MODULE - Constants & Query Keys
// ═══════════════════════════════════════════════════════════════════

import { KRCompletionFilters } from './types';

/**
 * LocalStorage key for persisting KR completions in demo mode
 */
export const KR_COMPLETIONS_STORAGE_KEY = 'cosmo_demo_kr_completions';

/**
 * React Query keys for KR Completions
 */
export const krCompletionKeys = {
  all: ['kr-completions'] as const,
  lists: () => [...krCompletionKeys.all, 'list'] as const,
  list: (filters: KRCompletionFilters) => [...krCompletionKeys.lists(), filters] as const,
};
