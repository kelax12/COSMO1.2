// ═══════════════════════════════════════════════════════════════════
// TEAM-CATEGORIES MODULE - Implémentation de démo (localStorage)
// ═══════════════════════════════════════════════════════════════════

import { TeamCategory, CreateTeamCategoryInput, UpdateTeamCategoryInput } from './types';
import { TEAM_CATEGORIES_STORAGE_KEY } from './constants';
import { safeGetItem, safeSetItem, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';
import type { ITeamCategoriesRepository } from './repository';
import { wouldCreateCycle, wouldExceedMaxDepth } from './tree';
import { DEMO_USER_ID, localizedDemoTeamCategories } from './local.seed';

function readOrSeed(): TeamCategory[] {
  const data = safeGetItem(TEAM_CATEGORIES_STORAGE_KEY);
  if (!data) {
    const clone = JSON.parse(JSON.stringify(localizedDemoTeamCategories())) as TeamCategory[];
    safeSetItem(TEAM_CATEGORIES_STORAGE_KEY, JSON.stringify(clone));
    return clone;
  }
  try {
    return JSON.parse(data) as TeamCategory[];
  } catch {
    return [];
  }
}

// Miroirs de la base (mig. 148), trouvés absents par la suite de contrat (V12.2) :
// un doublon de fratrie RENDAIT la catégorie existante au lieu d'échouer, et ni
// la boucle, ni le cycle, ni la profondeur n'étaient gardés.

/** Les deux index partiels d'unicité par fratrie (org, parent, nom). */
function assertSiblingNameFree(
  all: readonly TeamCategory[],
  orgId: string,
  parentId: string | null,
  name: string,
  selfId: string | null,
): void {
  const taken = all.some(
    (c) => c.id !== selfId && c.orgId === orgId && c.parentId === parentId && c.name.toLowerCase() === name.toLowerCase(),
  );
  if (taken) throw makeApiError('invalid_input');
}

/** Trigger `enforce_team_category_tree` : boucle, parent absent ou d'une autre organisation, cycle, profondeur. */
function assertTreeIsValid(id: string, parentId: string | null, orgId: string, all: readonly TeamCategory[]): void {
  if (parentId === null) return;
  if (parentId === id) throw makeApiError('hierarchy_cycle');
  const parent = all.find((c) => c.id === parentId);
  if (!parent || parent.orgId !== orgId) throw makeApiError('not_found');
  if (wouldCreateCycle(id, parentId, all)) throw makeApiError('hierarchy_cycle');
  if (wouldExceedMaxDepth(id, parentId, all)) throw makeApiError('hierarchy_max_depth');
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
    const id = crypto.randomUUID();
    assertSiblingNameFree(all, orgId, parentId, input.name, null);
    assertTreeIsValid(id, parentId, orgId, all);
    const cat: TeamCategory = {
      id,
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
    const current = all[idx];
    const nextParent = input.parentId !== undefined ? input.parentId : current.parentId;
    if (input.parentId !== undefined) assertTreeIsValid(categoryId, input.parentId, current.orgId, all);
    if (input.name !== undefined || input.parentId !== undefined) {
      assertSiblingNameFree(all, current.orgId, nextParent, input.name ?? current.name, categoryId);
    }
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
