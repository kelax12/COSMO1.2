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
