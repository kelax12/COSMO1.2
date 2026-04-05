// ═══════════════════════════════════════════════════════════════════
// HABITS MODULE - Constants & Query Keys
// ═══════════════════════════════════════════════════════════════════

/**
 * LocalStorage key for persisting habits in demo mode
 */
export const HABITS_STORAGE_KEY = 'cosmo_demo_habits';

/**
 * React Query keys for habits
 * Centralized to prevent duplication and ensure consistent cache management
 */
export const habitKeys = {
  all: ['habits'] as const,
  lists: () => [...habitKeys.all, 'list'] as const,
  detail: (id: string) => [...habitKeys.all, 'detail', id] as const,
};
