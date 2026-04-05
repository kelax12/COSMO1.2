// ═══════════════════════════════════════════════════════════════════
// LISTS MODULE - Constants
// ═══════════════════════════════════════════════════════════════════

export const LISTS_STORAGE_KEY = 'cosmo_lists';

/**
 * React Query keys for lists
 */
export const listKeys = {
  all: ['lists'] as const,
  lists: () => [...listKeys.all, 'list'] as const,
  detail: (id: string) => [...listKeys.all, 'detail', id] as const,
  byTask: (taskId: string) => [...listKeys.all, 'byTask', taskId] as const,
};
