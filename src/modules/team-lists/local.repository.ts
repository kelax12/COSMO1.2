// ═══════════════════════════════════════════════════════════════════
// TEAM-LISTS MODULE - Implémentation de démo (localStorage)
// ═══════════════════════════════════════════════════════════════════

import type { TeamList, CreateTeamListInput, UpdateTeamListInput } from './types';
import { TEAM_LISTS_STORAGE_KEY, TEAM_LIST_TASKS_STORAGE_KEY } from './constants';
import { localizeSeed } from '@/lib/seed-i18n';
import { safeGetItem, safeSetItem, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';
import type { ITeamListsRepository } from './repository';
import { DEMO_LISTS, DEMO_LISTS_EN, DEMO_LINKS } from './local.seed';
import type { StoredList, StoredLink } from './local.seed';

/** Une valeur illisible est ré-ensemencée, comme dans les autres dépôts démo. */
function readOrSeed<T>(key: string, seed: () => T): T {
  const data = safeGetItem(key);
  if (data) {
    try { return JSON.parse(data) as T; } catch { /* illisible : on repart de la graine */ }
  }
  const clone = JSON.parse(JSON.stringify(seed())) as T;
  safeSetItem(key, JSON.stringify(clone));
  return clone;
}

export class LocalStorageTeamListsRepository implements ITeamListsRepository {
  private lists(): StoredList[] {
    return readOrSeed(TEAM_LISTS_STORAGE_KEY, () => localizeSeed(DEMO_LISTS, DEMO_LISTS_EN));
  }
  private links(): StoredLink[] {
    return readOrSeed(TEAM_LIST_TASKS_STORAGE_KEY, () => DEMO_LINKS);
  }

  async getLists(orgId: string): Promise<TeamList[]> {
    const links = this.links();
    return this.lists()
      .filter((l) => l.orgId === orgId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((l) => ({ ...l, taskIds: links.filter((k) => k.listId === l.id).map((k) => k.taskId) }));
  }

  async createList(orgId: string, input: CreateTeamListInput): Promise<TeamList> {
    const all = this.lists();
    const list: StoredList = {
      id: crypto.randomUUID(),
      orgId,
      name: input.name.trim(),
      color: input.color,
      type: input.type ?? 'manual',
      ...(input.smartRule ? { smartRule: input.smartRule } : {}),
      position: all.filter((l) => l.orgId === orgId).length,
    };
    writeJsonOrThrow(TEAM_LISTS_STORAGE_KEY, [...all, list]);
    return { ...list, taskIds: [] };
  }

  async updateList(listId: string, input: UpdateTeamListInput): Promise<void> {
    const all = this.lists();
    if (!all.some((l) => l.id === listId)) throw makeApiError('not_found');
    writeJsonOrThrow(TEAM_LISTS_STORAGE_KEY, all.map((l) => (l.id === listId ? { ...l, ...input } : l)));
  }

  async deleteList(listId: string): Promise<void> {
    writeJsonOrThrow(TEAM_LISTS_STORAGE_KEY, this.lists().filter((l) => l.id !== listId));
    // Miroir du ON DELETE CASCADE de la jonction.
    writeJsonOrThrow(TEAM_LIST_TASKS_STORAGE_KEY, this.links().filter((k) => k.listId !== listId));
  }

  async addTask(listId: string, taskId: string): Promise<void> {
    const links = this.links();
    // Miroir de la PK composite : deux fois la même tâche est un no-op.
    if (links.some((k) => k.listId === listId && k.taskId === taskId)) return;
    writeJsonOrThrow(TEAM_LIST_TASKS_STORAGE_KEY, [...links, { listId, taskId }]);
  }

  async removeTask(listId: string, taskId: string): Promise<void> {
    writeJsonOrThrow(
      TEAM_LIST_TASKS_STORAGE_KEY,
      this.links().filter((k) => !(k.listId === listId && k.taskId === taskId)),
    );
  }
}
