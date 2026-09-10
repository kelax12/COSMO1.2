// ═══════════════════════════════════════════════════════════════════
// CATEGORIES MODULE - Constants
// ═══════════════════════════════════════════════════════════════════

export const CATEGORIES_STORAGE_KEY = 'cosmo_categories';

/**
 * Couleur d'une catégorie racine créée sans couleur.
 *
 * ⚠️ Valeur unique : elle était écrite en dur dans `ColorSettingsModal`
 * (`#3B82F6`) et nulle part ailleurs.
 */
export const DEFAULT_CATEGORY_COLOR = '#3B82F6';

/**
 * React Query keys for categories
 */
export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  detail: (id: string) => [...categoryKeys.all, 'detail', id] as const,
};
