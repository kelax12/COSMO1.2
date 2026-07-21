// ═══════════════════════════════════════════════════════════════════
// LISTS MODULE - Repository Pattern Implementation
// ═══════════════════════════════════════════════════════════════════

import { TaskList, CreateListInput, UpdateListInput } from './types';
import { LISTS_STORAGE_KEY } from './constants';

// ═══════════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════════

const DEMO_LISTS: TaskList[] = [
  {
    id: 'list-1',
    name: 'Urgent',
    color: 'red',
    taskIds: ['task-1', 'task-2'],
    type: 'manual',
    isDefault: true,        // épinglée par défaut à l'ouverture
    position: 0,
  },
  {
    id: 'list-2',
    name: 'Professionnel',
    color: 'purple',
    taskIds: ['task-1', 'task-2'],
    type: 'manual',
    position: 1,
  },
  {
    id: 'list-3-smart-overdue',
    name: 'En retard',
    color: 'red',
    taskIds: [],
    type: 'smart',
    smartRule: 'overdue',
    position: 2,
  },
  {
    id: 'list-4-smart-priority',
    name: 'Priorité haute',
    color: 'orange',
    taskIds: [],
    type: 'smart',
    smartRule: 'high-priority',
    position: 3,
  },
];

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface IListsRepository {
  // Read operations
  getAll(): Promise<TaskList[]>;
  getById(id: string): Promise<TaskList | null>;
  getByTaskId(taskId: string): Promise<TaskList[]>;

  // Write operations
  create(input: CreateListInput): Promise<TaskList>;
  update(id: string, updates: UpdateListInput): Promise<TaskList>;
  delete(id: string): Promise<void>;

  // Task association operations
  addTaskToList(taskId: string, listId: string): Promise<TaskList>;
  removeTaskFromList(taskId: string, listId: string): Promise<TaskList>;
}

// ═══════════════════════════════════════════════════════════════════
// LOCAL STORAGE REPOSITORY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export class LocalStorageListsRepository implements IListsRepository {
  /**
   * Get all lists from localStorage (or initialize with demo data)
   */
  private getLists(): TaskList[] {
    const data = localStorage.getItem(LISTS_STORAGE_KEY);
    if (!data) {
      this.saveLists(DEMO_LISTS);
      return DEMO_LISTS;
    }
    return JSON.parse(data);
  }

  /**
   * Save lists to localStorage
   */
  private saveLists(lists: TaskList[]): void {
    localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(lists));
  }

  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async getAll(): Promise<TaskList[]> {
    // Tri identique au repo Supabase : position ascendante puis nom alpha.
    // Les listes sans position passent à la fin (équivalent NULLS LAST).
    const lists = this.getLists();
    return [...lists].sort((a, b) => {
      const ap = a.position ?? Number.MAX_SAFE_INTEGER;
      const bp = b.position ?? Number.MAX_SAFE_INTEGER;
      if (ap !== bp) return ap - bp;
      return a.name.localeCompare(b.name);
    });
  }

  async getById(id: string): Promise<TaskList | null> {
    const lists = this.getLists();
    return lists.find(l => l.id === id) || null;
  }

  async getByTaskId(taskId: string): Promise<TaskList[]> {
    const lists = this.getLists();
    return lists.filter(l => l.taskIds.includes(taskId));
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateListInput): Promise<TaskList> {
    const lists = this.getLists();

    // Backfill (#XX) : les listes jamais réordonnées manuellement n'ont pas
    // de `position` et retombent sur le tri alphabétique (cf. mig. 021). Sans
    // ce backfill, la nouvelle liste (elle aussi sans position) rejoindrait
    // ce groupe et s'insérerait alphabétiquement au milieu au lieu
    // d'apparaître en dernier — donnant l'impression que l'ordre a changé.
    // On fige donc l'ordre visuel ACTUEL en position explicite pour toutes
    // les listes concernées, puis on ajoute la nouvelle après tout le monde.
    const sorted = [...lists].sort((a, b) => {
      const ap = a.position ?? Number.MAX_SAFE_INTEGER;
      const bp = b.position ?? Number.MAX_SAFE_INTEGER;
      if (ap !== bp) return ap - bp;
      return a.name.localeCompare(b.name);
    });
    let nextPosition = 1 + Math.max(-1, ...sorted.map(l => l.position ?? -1));
    const backfilled = sorted.map((l) => {
      if (l.position !== undefined) return l;
      return { ...l, position: nextPosition++ };
    });

    const newList: TaskList = {
      ...input,
      id: crypto.randomUUID(),
      taskIds: [],
      position: input.position ?? nextPosition,
    };
    this.saveLists([...backfilled, newList]);
    return newList;
  }

  async update(id: string, updates: UpdateListInput): Promise<TaskList> {
    const lists = this.getLists();
    const index = lists.findIndex(l => l.id === id);

    if (index === -1) {
      throw new Error(`List with id ${id} not found`);
    }

    const updatedList: TaskList = { ...lists[index], ...updates };
    lists[index] = updatedList;
    this.saveLists(lists);
    return updatedList;
  }

  async delete(id: string): Promise<void> {
    const lists = this.getLists();
    const filtered = lists.filter(l => l.id !== id);

    if (filtered.length === lists.length) {
      throw new Error(`List with id ${id} not found`);
    }

    this.saveLists(filtered);
  }

  // ═══════════════════════════════════════════════════════════════════
  // TASK ASSOCIATION OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async addTaskToList(taskId: string, listId: string): Promise<TaskList> {
    const lists = this.getLists();
    const index = lists.findIndex(l => l.id === listId);

    if (index === -1) {
      throw new Error(`List with id ${listId} not found`);
    }

    const list = lists[index];
    if (!list.taskIds.includes(taskId)) {
      list.taskIds = [...list.taskIds, taskId];
      lists[index] = list;
      this.saveLists(lists);
    }

    return list;
  }

  async removeTaskFromList(taskId: string, listId: string): Promise<TaskList> {
    const lists = this.getLists();
    const index = lists.findIndex(l => l.id === listId);

    if (index === -1) {
      throw new Error(`List with id ${listId} not found`);
    }

    const list = lists[index];
    list.taskIds = list.taskIds.filter(id => id !== taskId);
    lists[index] = list;
    this.saveLists(lists);

    return list;
  }
}
