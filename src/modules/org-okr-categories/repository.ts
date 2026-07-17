// ═══════════════════════════════════════════════════════════════════
// ORG-OKR-CATEGORIES MODULE - Repository Interface + LocalStorage (démo)
// ═══════════════════════════════════════════════════════════════════

import { OrgOKRCategory, CreateOrgOKRCategoryInput } from './types';
import { ORG_OKR_CATEGORIES_STORAGE_KEY } from './constants';

export interface IOrgOKRCategoriesRepository {
  getCategories(orgId: string): Promise<OrgOKRCategory[]>;
  createCategory(orgId: string, input: CreateOrgOKRCategoryInput): Promise<OrgOKRCategory>;
  deleteCategory(categoryId: string): Promise<void>;
}

const DEMO_ORG_ID = 'org-demo-1';
const DEMO_USER_ID = 'demo-user';
const DAY = 24 * 60 * 60 * 1000;

const DEMO_CATEGORIES: OrgOKRCategory[] = [
  { id: 'okrcat-growth', orgId: DEMO_ORG_ID, name: 'Croissance', color: '#10b981', createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
  { id: 'okrcat-product', orgId: DEMO_ORG_ID, name: 'Produit', color: '#6366f1', createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
  { id: 'okrcat-brand', orgId: DEMO_ORG_ID, name: 'Marque', color: '#ec4899', createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
];

function readOrSeed(): OrgOKRCategory[] {
  const data = localStorage.getItem(ORG_OKR_CATEGORIES_STORAGE_KEY);
  if (!data) {
    const clone = JSON.parse(JSON.stringify(DEMO_CATEGORIES)) as OrgOKRCategory[];
    localStorage.setItem(ORG_OKR_CATEGORIES_STORAGE_KEY, JSON.stringify(clone));
    return clone;
  }
  try {
    return JSON.parse(data) as OrgOKRCategory[];
  } catch {
    return [];
  }
}

export class LocalStorageOrgOKRCategoriesRepository implements IOrgOKRCategoriesRepository {
  private getAll(): OrgOKRCategory[] {
    return readOrSeed();
  }
  private save(cats: OrgOKRCategory[]): void {
    localStorage.setItem(ORG_OKR_CATEGORIES_STORAGE_KEY, JSON.stringify(cats));
  }

  async getCategories(orgId: string): Promise<OrgOKRCategory[]> {
    return this.getAll().filter((c) => c.orgId === orgId);
  }

  async createCategory(orgId: string, input: CreateOrgOKRCategoryInput): Promise<OrgOKRCategory> {
    const all = this.getAll();
    // Unicité (org, name) — miroir de la contrainte SQL.
    const existing = all.find((c) => c.orgId === orgId && c.name.toLowerCase() === input.name.toLowerCase());
    if (existing) return existing;
    const cat: OrgOKRCategory = {
      id: crypto.randomUUID(),
      orgId,
      name: input.name,
      color: input.color ?? '#6366f1',
      createdBy: DEMO_USER_ID,
      createdAt: new Date().toISOString(),
    };
    this.save([...all, cat]);
    return cat;
  }

  async deleteCategory(categoryId: string): Promise<void> {
    this.save(this.getAll().filter((c) => c.id !== categoryId));
  }
}
