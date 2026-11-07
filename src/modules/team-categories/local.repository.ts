// ═══════════════════════════════════════════════════════════════════
// TEAM-CATEGORIES MODULE - Implémentation de démo (localStorage)
// ═══════════════════════════════════════════════════════════════════

import { TeamCategory, CreateTeamCategoryInput, UpdateTeamCategoryInput } from './types';
import { TEAM_CATEGORIES_STORAGE_KEY } from './constants';
import { localizeSeed } from '@/lib/seed-i18n';
import { safeGetItem, safeSetItem, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';
import type { ITeamCategoriesRepository } from './repository';
import { DEMO_USER_ID, DEMO_CATEGORIES, DEMO_CATEGORIES_EN } from './local.seed';

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
