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
  { id: 'teamcat-client', orgId: DEMO_ORG_ID, name: 'Client', color: '#3b82f6', parentId: null, position: 0, createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
  { id: 'teamcat-produit', orgId: DEMO_ORG_ID, name: 'Produit', color: '#10b981', parentId: null, position: 1, createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
  { id: 'teamcat-support', orgId: DEMO_ORG_ID, name: 'Support', color: '#f59e0b', parentId: null, position: 2, createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
  // Racines dédiées aux OKR d'équipe (ex-org_okr_categories, mig. 148).
  { id: 'teamcat-croissance', orgId: DEMO_ORG_ID, name: 'Croissance', color: '#6366f1', parentId: null, position: 3, createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
  { id: 'teamcat-interne', orgId: DEMO_ORG_ID, name: 'Interne', color: '#ec4899', parentId: null, position: 4, createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 40 * DAY).toISOString() },
  // Sous-catégorie de démonstration, pour montrer le pliage/dépliage d'emblée.
  { id: 'teamcat-design', orgId: DEMO_ORG_ID, name: 'Design', color: '#8b5cf6', parentId: 'teamcat-produit', position: 0, createdBy: DEMO_USER_ID, createdAt: new Date(Date.now() - 39 * DAY).toISOString() },
];

// Overlay anglais — cf. src/lib/seed-i18n.ts.
const DEMO_CATEGORIES_EN: Record<string, Partial<TeamCategory>> = {
  'teamcat-client': { name: 'Client' },
  'teamcat-produit': { name: 'Product' },
  'teamcat-support': { name: 'Support' },
  'teamcat-croissance': { name: 'Growth' },
  'teamcat-interne': { name: 'Internal' },
  'teamcat-design': { name: 'Design' },
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
    const parentId = input.parentId ?? null;
    // Unicité par FRATRIE (org, parent, name) — miroir des deux index partiels SQL.
    const existing = all.find(
      (c) => c.orgId === orgId && c.parentId === parentId && c.name.toLowerCase() === input.name.toLowerCase(),
    );
    if (existing) return existing;
    const cat: TeamCategory = {
      id: crypto.randomUUID(),
      orgId,
      name: input.name,
      color: input.color ?? '#6366f1',
      parentId,
      position: input.position ?? 0,
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
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
    };
    all[idx] = updated;
    this.save(all);
    return updated;
  }

  async deleteCategory(categoryId: string): Promise<void> {
    this.save(this.getAll().filter((c) => c.id !== categoryId));
  }
}
