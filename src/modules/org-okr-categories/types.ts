// ═══════════════════════════════════════════════════════════════════
// ORG-OKR-CATEGORIES MODULE - Types (catégories d'OKR d'entreprise)
// ═══════════════════════════════════════════════════════════════════

export interface OrgOKRCategory {
  id: string;
  orgId: string;
  name: string;
  /** Couleur CSS (hex). */
  color: string;
  createdBy: string | null;
  createdAt: string;
}

export interface CreateOrgOKRCategoryInput {
  name: string;
  color?: string;
}

export interface UpdateOrgOKRCategoryInput {
  name?: string;
  color?: string;
}
