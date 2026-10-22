// ═══════════════════════════════════════════════════════════════════
// TEAM-LISTS MODULE - Interface + LocalStorage (démo)
// ═══════════════════════════════════════════════════════════════════

import type { TeamList, CreateTeamListInput, UpdateTeamListInput } from './types';
import { TEAM_LISTS_STORAGE_KEY, TEAM_LIST_TASKS_STORAGE_KEY } from './constants';
import { localizeSeed } from '@/lib/seed-i18n';
import { safeGetItem, safeSetItem, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';

export interface ITeamListsRepository {
  /** Listes de l'organisation, `taskIds` renseignés, triées par position. */
  getLists(orgId: string): Promise<TeamList[]>;
  createList(orgId: string, input: CreateTeamListInput): Promise<TeamList>;
  updateList(listId: string, input: UpdateTeamListInput): Promise<void>;
  deleteList(listId: string): Promise<void>;
  addTask(listId: string, taskId: string): Promise<void>;
  removeTask(listId: string, taskId: string): Promise<void>;
}

type StoredList = Omit<TeamList, 'taskIds' | 'isDefault'>;
interface StoredLink { listId: string; taskId: string }

const DEMO_ORG_ID = 'org-demo-1';

const DEMO_LISTS: StoredList[] = [
  { id: 'tlist-client', orgId: DEMO_ORG_ID, name: 'À valider par le client', color: 'purple', type: 'manual', position: 0 },
  { id: 'tlist-vendredi', orgId: DEMO_ORG_ID, name: 'Revue du vendredi', color: 'blue', type: 'manual', position: 1 },
];
// Overlay anglais — cf. src/lib/seed-i18n.ts.
const DEMO_LISTS_EN: Record<string, Partial<StoredList>> = {
  'tlist-client': { name: 'Client approval' },
  'tlist-vendredi': { name: 'Friday review' },
};
const DEMO_LINKS: StoredLink[] = [
  { listId: 'tlist-client', taskId: 'ttask-1' },
  { listId: 'tlist-client', taskId: 'ttask-9' },
  { listId: 'tlist-vendredi', taskId: 'ttask-2' },
  { listId: 'tlist-vendredi', taskId: 'ttask-4' },
  { listId: 'tlist-vendredi', taskId: 'ttask-5' },
];

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
