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
// ⚠️ `LocalStorageCategoriesRepository` n'est PAS ré-exporté : ce baril est
// importé par une douzaine d'écrans, et l'y remettre ferait repartir les seeds
// de démonstration dans le chunk d'entrée. Il vit dans `./local.repository`,
// chargé à la demande par `src/lib/demo-repositories.ts`.
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
