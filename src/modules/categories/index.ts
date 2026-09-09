// ═══════════════════════════════════════════════════════════════════
// CATEGORIES MODULE - Public API
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type { 
  Category, 
  CreateCategoryInput, 
  UpdateCategoryInput 
} from './types';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS & QUERY KEYS
// ═══════════════════════════════════════════════════════════════════

export { categoryKeys, CATEGORIES_STORAGE_KEY, DEFAULT_CATEGORY_COLOR } from './constants';

// ═══════════════════════════════════════════════════════════════════
// ARBRE — logique pure (tâche 1)
// ═══════════════════════════════════════════════════════════════════

export {
  CATEGORY_MAX_DEPTH,
  buildTree,
  categoryPath,
  childrenOf,
  descendantIds,
  ancestorIds,
  formatPath,
  orderByDepth,
  treeDepth,
  wouldCreateCycle,
} from './tree';
export type { CategoryNode } from './tree';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY
// ═══════════════════════════════════════════════════════════════════

export type { ICategoriesRepository } from './repository';
export { LocalStorageCategoriesRepository } from './repository';
export { SupabaseCategoriesRepository } from './supabase.repository';

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════

export {
  useCategories,
  useCategoryColor,
  useCategoryLookup,
} from './hooks';

// ═══════════════════════════════════════════════════════════════════
// WRITE HOOKS (Mutations)
// ═══════════════════════════════════════════════════════════════════

export {
  useCreateCategory,
  useUpdateCategory,
  useMoveCategory,
  useDeleteCategory,
  useRestoreCategory,
} from './hooks';
