// ═══════════════════════════════════════════════════════════════════
// ORG-OKR-CATEGORIES MODULE - Constants
// ═══════════════════════════════════════════════════════════════════

// Clé localStorage (démo) — préfixe cosmo_ (sweep clearDemoStorage, B21).
export const ORG_OKR_CATEGORIES_STORAGE_KEY = 'cosmo_org_okr_categories';

export const orgOKRCategoryKeys = {
  all: ['org-okr-categories'] as const,
  list: (orgId: string) => [...orgOKRCategoryKeys.all, orgId] as const,
};

/** Palette proposée à la création d'une catégorie (parité mode perso). */
export const OKR_CATEGORY_COLORS = [
  '#6366f1', '#3b82f6', '#14b8a6', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6',
];
