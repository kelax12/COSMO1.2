// ═══════════════════════════════════════════════════════════════════
// TEAM-CATEGORIES MODULE - Repository Interface + LocalStorage (démo)
// ═══════════════════════════════════════════════════════════════════

import { TeamCategory, CreateTeamCategoryInput, UpdateTeamCategoryInput } from './types';
import { TEAM_CATEGORIES_STORAGE_KEY } from './constants';
import { localizeSeed } from '@/lib/seed-i18n';
import { safeGetItem, safeSetItem, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';

export interface ITeamCategoriesRepository {
  getCategories(orgId: string): Promise<TeamCategory[]>;
  createCategory(orgId: string, input: CreateTeamCategoryInput): Promise<TeamCategory>;
  updateCategory(categoryId: string, input: UpdateTeamCategoryInput): Promise<TeamCategory>;
  deleteCategory(categoryId: string): Promise<void>;
}

const DEMO_ORG_ID = 'org-demo-1';
const DEMO_USER_ID = 'demo-user';
const DAY = 24 * 60 * 60 * 1000;

const DEMO_CATEGORIES: TeamCategory[] = [
  { id: 'teamcat-client', orgId: DEMO_ORG_ID, name: 'Client', color: '#3b82f6', createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
  { id: 'teamcat-produit', orgId: DEMO_ORG_ID, name: 'Produit', color: '#10b981', createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
  { id: 'teamcat-support', orgId: DEMO_ORG_ID, name: 'Support', color: '#f59e0b', createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
];

// Overlay anglais — cf. src/lib/seed-i18n.ts.
const DEMO_CATEGORIES_EN: Record<string, Partial<TeamCategory>> = {
  'teamcat-client': { name: 'Client' },
  'teamcat-produit': { name: 'Product' },
  'teamcat-support': { name: 'Support' },
};

function readOrSeed(): TeamCategory[] {
  const data = safeGetItem(TEAM_CATEGORIES_STORAGE_KEY);
  if (!data) {
    const clone = JSON.parse(JSON.stringify(localizeSeed(DEMO_CATEGORIES, DEMO_CATEGORIES_EN))) as TeamCategory[];
    safeSetItem(TEAM_CATEGORIES_STORAGE_KEY, JSON.stringify(clone));
    return clone;
  }
  try {
    return JSON.parse(data) as TeamCategory[];
  } catch {
    return [];
  }
}

export class LocalStorageTeamCategoriesRepository implements ITeamCategoriesRepository {
  private getAll(): TeamCategory[] {
    return readOrSeed();
  }
  private save(cats: TeamCategory[]): void {
    writeJsonOrThrow(TEAM_CATEGORIES_STORAGE_KEY, cats);
  }

  async getCategories(orgId: string): Promise<TeamCategory[]> {
    return this.getAll().filter((c) => c.orgId === orgId);
  }

  async createCategory(orgId: string, input: CreateTeamCategoryInput): Promise<TeamCategory> {
    const all = this.getAll();
    // Unicité (org, name) — miroir de la contrainte SQL.
    const existing = all.find((c) => c.orgId === orgId && c.name.toLowerCase() === input.name.toLowerCase());
    if (existing) return existing;
    const cat: TeamCategory = {
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

  async updateCategory(categoryId: string, input: UpdateTeamCategoryInput): Promise<TeamCategory> {
    const all = this.getAll();
    const idx = all.findIndex((c) => c.id === categoryId);
    if (idx === -1) throw makeApiError('not_found');
    const updated: TeamCategory = {
      ...all[idx],
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    };
    all[idx] = updated;
    this.save(all);
    return updated;
  }

  async deleteCategory(categoryId: string): Promise<void> {
    this.save(this.getAll().filter((c) => c.id !== categoryId));
  }
}
