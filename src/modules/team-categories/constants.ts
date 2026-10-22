// ═══════════════════════════════════════════════════════════════════
// TEAM-CATEGORIES MODULE - Constants
// ═══════════════════════════════════════════════════════════════════

// Clé localStorage (démo) — préfixe cosmo_ (sweep clearDemoStorage, B21).
export const TEAM_CATEGORIES_STORAGE_KEY = 'cosmo_team_categories';

export const teamCategoryKeys = {
  all: ['team-categories'] as const,
  list: (orgId: string) => [...teamCategoryKeys.all, orgId] as const,
};

/** Palette proposée à la création d'une catégorie (parité OKR/perso). */
export const TEAM_CATEGORY_COLORS = [
  '#6366f1', '#3b82f6', '#14b8a6', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6',
];
