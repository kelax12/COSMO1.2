// ═══════════════════════════════════════════════════════════════════
// CATEGORIES MODULE - Constants
// ═══════════════════════════════════════════════════════════════════

export const CATEGORIES_STORAGE_KEY = 'cosmo_categories';

/**
 * React Query keys for categories
 */
export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  detail: (id: string) => [...categoryKeys.all, 'detail', id] as const,
};
