// ═══════════════════════════════════════════════════════════════════
// TEAM-CATEGORIES MODULE - Public API
// ═══════════════════════════════════════════════════════════════════

export type { TeamCategory, CreateTeamCategoryInput, UpdateTeamCategoryInput } from './types';
export { teamCategoryKeys, TEAM_CATEGORIES_STORAGE_KEY, TEAM_CATEGORY_COLORS } from './constants';
export type { ITeamCategoriesRepository } from './repository';
export { LocalStorageTeamCategoriesRepository } from './repository';
export { SupabaseTeamCategoriesRepository } from './supabase.repository';
export {
  useTeamCategories,
  useCreateTeamCategory,
  useUpdateTeamCategory,
  useDeleteTeamCategory,
} from './hooks';

// ─── Arbre — logique pure (mig. 148) ───────────────────────────────
export {
  TEAM_CATEGORY_MAX_DEPTH,
  TEAM_CATEGORY_PATH_SEPARATOR,
  buildTree,
  categoryPath,
  childrenOf,
  descendantIds,
  descendantIdSet,
  ancestorIds,
  formatPath,
  treeDepth,
  wouldCreateCycle,
  wouldExceedMaxDepth,
} from './tree';
export type { TeamCategoryNode } from './tree';

// ─── Impact d'une suppression ──────────────────────────────────────
export { teamCategoryImpact, EMPTY_TEAM_CATEGORY_IMPACT } from './impact';
export type { TeamCategoryImpact } from './impact';
