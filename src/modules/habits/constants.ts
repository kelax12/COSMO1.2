// ═══════════════════════════════════════════════════════════════════
// HABITS MODULE - Constants & Query Keys
// ═══════════════════════════════════════════════════════════════════

/**
 * LocalStorage key for persisting habits in demo mode
 */
export const HABITS_STORAGE_KEY = 'cosmo_demo_habits';

/**
 * Jours cochés de la démo, `{ [habitId]: ['YYYY-MM-DD', ...] }` : le pendant
 * local de la table `habit_completions` (mig. 248, DAT-02). `cosmo_demo_habits`
 * ne porte plus de carte `completions`.
 */
export const HABIT_COMPLETIONS_STORAGE_KEY = 'cosmo_demo_habit_completions';

/**
 * React Query keys for habits
 * Centralized to prevent duplication and ensure consistent cache management
 */
export const habitKeys = {
  all: ['habits'] as const,
  lists: () => [...habitKeys.all, 'list'] as const,
  detail: (id: string) => [...habitKeys.all, 'detail', id] as const,
};
