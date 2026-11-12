import { ITasksRepository, ToggleCompleteResult, type TaskPageParams } from './repository';
import { type TaskQuery, matchesTaskQuery, sortByTaskKeyset, isAfterCursor, isEmptyTaskQuery, assertSupportedTaskQuery } from './task-query';
import { Task, CreateTaskInput, UpdateTaskInput, TaskFilters, TaskDependency } from './types';
import { PaginatedResult, DEFAULT_PAGE_SIZE } from '@/lib/pagination.types';
import { reachableSets } from '@/lib/dependency-graph';
import { TASK_DEPENDENCIES_STORAGE_KEY } from './constants';
import { deadlineDayKey } from '@/lib/deadline';
import type { CreateOptions } from '@/lib/restore-id';
import { DEPENDENCY_ERRORS, makeDependencyError } from './dependency-errors';
import { safeGetItem, safeParseArray, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';
import { applyStatusSync, effectiveStatus } from './status-sync';
import { localizedDemoTasks } from './local.seed';
const STORAGE_KEY = 'cosmo_demo_tasks';

/**
 * Priorité de 0 (« sans priorité », la valeur par défaut de la fiche) à 5,
 * comme `createTaskSchema`. Trouvé par la suite de contrat (V12.2) : la démo
 * acceptait 6 ou -1. 0 = « aucune priorité », admis des deux côtés : c'est le
 * CHECK 0 à 5 de la mig. 249 (ancienne divergence PAR-01).
 */
function assertPriorityInRange(priority: number | undefined): void {
  // Absente, la base prend son défaut : rien à refuser.
  if (priority === undefined) return;
  if (!Number.isInteger(priority) || priority < 0 || priority > 5) throw makeApiError('invalid_input');
}

export class LocalStorageTasksRepository implements ITasksRepository {
  private getTasks(): Task[] {
    const stored = safeParseArray<Task>(safeGetItem(STORAGE_KEY));
    // Corrompu ou stockage indisponible : on re-seme plutot que de faire
    // tomber la page (regle B14, helper `safeParseArray`).
    if (!stored) {
      const seeded = localizedDemoTasks();
      this.saveTasks(seeded);
      return seeded;
    }
    return stored;
  }

  private saveTasks(tasks: Task[]): void {
    writeJsonOrThrow(STORAGE_KEY, tasks);
  }

  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS (Phase 1)
  // ═══════════════════════════════════════════════════════════════════

  async getAll(): Promise<Task[]> {
    return this.getTasks();
  }

  /**
   * Mode démo : le partage cross-compte n'existe pas en LocalStorage, la
   * boîte de réception démo s'appuie sur `task.sharedBy` + les acquittements
   * locaux (cf. InboxMenu). Rien à renvoyer ici.
   */
  async getPendingSharedTasks(): Promise<Task[]> {
    return [];
  }

  async getById(id: string): Promise<Task | null> {
    const tasks = this.getTasks();
    return tasks.find(t => t.id === id) || null;
  }

  async getByDate(date: string): Promise<Task[]> {
    const tasks = this.getTasks();
    // `.split('T')[0]` rendait le jour UTC des deux côtés : deux instants du
    // même jour vécu pouvaient ne pas se répondre (risque R-01).
    const targetDate = deadlineDayKey(date);
    return tasks.filter(t => deadlineDayKey(t.deadline) === targetDate);
  }

  async getFiltered(filters: TaskFilters): Promise<Task[]> {
    let tasks = this.getTasks();

    if (filters.completed !== undefined) {
      tasks = tasks.filter(t => t.completed === filters.completed);
    }

    if (filters.bookmarked !== undefined) {
      tasks = tasks.filter(t => t.bookmarked === filters.bookmarked);
    }

    if (filters.category) {
      tasks = tasks.filter(t => t.category === filters.category);
    }

    if (filters.priorityMin !== undefined) {
      tasks = tasks.filter(t => t.priority >= filters.priorityMin!);
    }

    if (filters.priorityMax !== undefined) {
      tasks = tasks.filter(t => t.priority <= filters.priorityMax!);
    }

    // Comparaison de JOURS, jamais de chaînes hétérogènes : `t.deadline` est un
    // instant ISO, `deadlineBefore` une clé de jour. `' T22:00:00.000Z'
    // <= '<jour ISO>'` est vrai par hasard lexicographique, et faux dès que
    // l'instant du 3 est stocké en heure locale négative.
    if (filters.deadlineBefore) {
      tasks = tasks.filter(t => !!t.deadline && deadlineDayKey(t.deadline) <= filters.deadlineBefore!);
    }

    if (filters.deadlineAfter) {
      tasks = tasks.filter(t => !!t.deadline && deadlineDayKey(t.deadline) >= filters.deadlineAfter!);
    }

    return tasks;
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS (Phase 2)
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateTaskInput, options?: CreateOptions): Promise<Task> {
    assertPriorityInRange(input.priority);
    const tasks = this.getTasks();
    // Mig. 214 : même règle que le trigger à l'INSERT. Une tâche née cochée
    // est `done`, une tâche née `done` est cochée.
    const synced = applyStatusSync({}, {
      ...input,
      status: input.status ?? (input.completed ? 'done' : 'todo'),
    });
    const newTask: Task = {
      ...synced,
      // Parite avec le repository Supabase : `restoreId` vient d'un
      // « Annuler », jamais d'un formulaire (R-08).
      id: options?.restoreId ?? crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      bookmarked: input.bookmarked ?? false,
      completed: synced.completed ?? false,
      isCollaborative: input.isCollaborative ?? false,
      pendingInvites: input.pendingInvites ?? [],
    };
    this.saveTasks([newTask, ...tasks]);
    return newTask;
  }

  async update(id: string, updates: UpdateTaskInput): Promise<Task> {
    if (updates.priority !== undefined) assertPriorityInRange(updates.priority);
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === id);
    
    if (index === -1) {
      throw makeApiError('not_found');
    }
    
    // Mig. 214 : `status` et `completed` restent d'accord, comme sous le trigger.
    const updatedTask: Task = { ...tasks[index], ...applyStatusSync(tasks[index], updates) };
    tasks[index] = updatedTask;
    this.saveTasks(tasks);
    return updatedTask;
  }

  async delete(id: string): Promise<void> {
    const tasks = this.getTasks();
    const filtered = tasks.filter(t => t.id !== id);
    
    if (filtered.length === tasks.length) {
      throw makeApiError('not_found');
    }
    
    this.saveTasks(filtered);
    // Parité avec le `ON DELETE CASCADE` de la mig. 132 : sans ça, une arête
    // survit à sa tâche et le graphe compte une dépendance qui n'existe plus.
    const deps = this.getDependencyEdges();
    const kept = deps.filter(d => d.taskId !== id && d.dependsOnId !== id);
    if (kept.length !== deps.length) this.saveDependencyEdges(kept);
  }

  /**
   * Bascule la complétion, et génère/retire l'occurrence récurrente suivante.
   *
   * ⚠️ PARITÉ OBLIGATOIRE avec `toggle_task_complete_v2` (mig. 086) — même
   * règle que `recordKRCompletion` (cf. CLAUDE.md) : une règle métier qui
   * n'existe que dans un des deux repositories diverge en silence. Ici,
   * l'invariant à préserver est l'IDEMPOTENCE : recocher deux fois la même
   * tâche ne doit jamais produire deux occurrences.
   *
   * Côté serveur, l'index unique `ux_tasks_recurrence_parent` la garantit.
   * Côté LocalStorage, elle est obtenue par la recherche d'un enfant existant
   * (`recurrenceParentId === id`) avant toute création.
   */
  async toggleComplete(id: string, nextDeadline?: string | null): Promise<ToggleCompleteResult> {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === id);

    if (index === -1) {
      throw makeApiError('not_found');
    }

    const task = tasks[index];
    const updatedTask: Task = {
      ...task,
      completed: !task.completed,
      completedAt: !task.completed ? new Date().toISOString() : undefined,
      // Mig. 214 : décocher une tâche `done` la rend `todo` ; décocher une
      // tâche restée dans un statut ouvert (cas impossible en base) le garde.
      status: !task.completed ? 'done' : (effectiveStatus(task) === 'done' ? 'todo' : effectiveStatus(task)),
    };
    tasks[index] = updatedTask;

    let spawned: Task | null = null;
    const existingChild = tasks.find(t => t.recurrenceParentId === id);

    if (
      updatedTask.completed &&
      (updatedTask.recurrence ?? 'none') !== 'none' &&
      nextDeadline &&
      !existingChild // ← garde d'idempotence (pendant serveur : ON CONFLICT DO NOTHING)
    ) {
      spawned = {
        ...task,
        id: crypto.randomUUID(),
        deadline: nextDeadline,
        completed: false,
        completedAt: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subtasks: (task.subtasks ?? []).map(s => ({ ...s, completed: false })),
        // Parité avec l'INSERT de `toggle_task_complete_v2` : sa liste de
        // colonnes n'a ni `status` ni `health`, l'occurrence naît `todo`.
        status: 'todo',
        health: undefined,
        // Le partage ne se propage pas à l'occurrence suivante.
        isCollaborative: undefined,
        pendingInvites: undefined,
        sharedBy: undefined,
        recurrenceParentId: id,
      };
      tasks.unshift(spawned);
    } else if (!updatedTask.completed && existingChild) {
      // Dé-validation : on retire l'occurrence générée SI elle est intacte
      // (non complétée, jamais modifiée). Sinon elle appartient désormais à
      // l'utilisateur — on la détache seulement. Miroir exact du SQL.
      const untouched =
        !existingChild.completed && existingChild.updatedAt === existingChild.createdAt;
      if (untouched) {
        const childIndex = tasks.findIndex(t => t.id === existingChild.id);
        if (childIndex !== -1) tasks.splice(childIndex, 1);
      } else {
        const childIndex = tasks.findIndex(t => t.id === existingChild.id);
        if (childIndex !== -1) {
          tasks[childIndex] = { ...existingChild, recurrenceParentId: undefined };
        }
      }
    }

    this.saveTasks(tasks);
    return { task: updatedTask, spawned };
  }

  async toggleBookmark(id: string): Promise<Task> {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === id);

    if (index === -1) {
      throw makeApiError('not_found');
    }

    const task = tasks[index];
    const updatedTask: Task = {
      ...task,
      bookmarked: !task.bookmarked,
    };
    tasks[index] = updatedTask;
    this.saveTasks(tasks);
    return updatedTask;
  }

  // ═══════════════════════════════════════════════════════════════════
  // LECTURES PAR SOUS-ENSEMBLE (V14.1, PER-01) : même contrat que Supabase
  // ═══════════════════════════════════════════════════════════════════
  //
  // Même filtre (`matchesTaskQuery`), même ordre (`created_at` puis `id`
  // décroissants), même curseur de clé. L'ancienne version paginait par
  // POSITION dans le tableau stocké : une tâche créée entre deux pages (posée
  // en tête du tableau) ne décalait rien par chance, mais une tâche supprimée
  // avant le curseur, si, et l'ordre n'était pas celui de la production.

  private selectSorted(query: TaskQuery): Task[] {
    assertSupportedTaskQuery(query);
    if (isEmptyTaskQuery(query)) return [];
    return sortByTaskKeyset(this.getTasks().filter((t) => matchesTaskQuery(t, query)));
  }

  async listAll(query: TaskQuery = {}): Promise<Task[]> {
    return this.selectSorted(query);
  }

  async count(query: TaskQuery = {}): Promise<number> {
    return this.selectSorted(query).length;
  }

  async getPage(params: TaskPageParams = {}): Promise<PaginatedResult<Task>> {
    const limit = params.limit ?? DEFAULT_PAGE_SIZE;
    let rows = this.selectSorted(params.query ?? {});
    if (params.cursor) {
      const cursor = { id: params.cursor, createdAt: params.cursorDate ?? '' };
      rows = rows.filter((t) => isAfterCursor(t, cursor));
    }
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    return {
      data: items,
      hasMore,
      nextCursor: hasMore && last ? last.id : null,
      nextCursorDate: hasMore && last ? last.createdAt ?? '' : null,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // DÉPENDANCES (parité avec la mig. 132)
  // ═══════════════════════════════════════════════════════════════════
  //
  // ⚠️ PARITÉ OBLIGATOIRE avec les triggers `validate_task_dependency` et
  // `prevent_task_dependency_cycle` — même règle que `recordKRCompletion`
  // (cf. CLAUDE.md) : un invariant qui n'existe que d'un côté diverge en
  // silence, et c'est le mode démo qui laisse alors créer un graphe que la
  // production refuserait.

  private getDependencyEdges(): TaskDependency[] {
    const raw = safeGetItem(TASK_DEPENDENCIES_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as TaskDependency[]) : [];
    } catch {
      // Donnée corrompue : on repart d'un graphe vide plutôt que de faire
      // planter toute la page Tâches (garde-fou B14).
      return [];
    }
  }

  private saveDependencyEdges(edges: TaskDependency[]): void {
    writeJsonOrThrow(TASK_DEPENDENCIES_STORAGE_KEY, edges);
  }

  async getDependencies(): Promise<TaskDependency[]> {
    return this.getDependencyEdges();
  }

  async addDependency(taskId: string, dependsOnId: string): Promise<void> {
    // C-48 — les refus passent par un IDENTIFIANT catalogue, jamais par une
    // phrase anglaise : elle ne matchait pas `BUSINESS_CODE_RE` en prod (refus
    // generique) et arrivait telle quelle dans un gabarit francais en demo.
    // Une auto-dependance EST un cycle de longueur 1 : meme identifiant que la
    // contrainte `task_dependencies_no_self` de la mig. 132.
    if (taskId === dependsOnId) {
      throw makeDependencyError(DEPENDENCY_ERRORS.cycle);
    }
    const tasks = this.getTasks();
    if (!tasks.some(t => t.id === taskId) || !tasks.some(t => t.id === dependsOnId)) {
      throw makeDependencyError(DEPENDENCY_ERRORS.taskMissing);
    }
    const edges = this.getDependencyEdges();
    if (edges.some(d => d.taskId === taskId && d.dependsOnId === dependsOnId)) return;
    // Le cycle se teste depuis la BLOQUANTE : si elle dépend déjà, même
    // indirectement, de la bloquée, l'arête refermerait la boucle.
    if (reachableSets(edges, dependsOnId).upstream.has(taskId)) {
      throw makeDependencyError(DEPENDENCY_ERRORS.cycle);
    }
    this.saveDependencyEdges([...edges, { taskId, dependsOnId }]);
  }

  async removeDependency(taskId: string, dependsOnId: string): Promise<void> {
    const edges = this.getDependencyEdges();
    this.saveDependencyEdges(
      edges.filter(d => !(d.taskId === taskId && d.dependsOnId === dependsOnId)),
    );
  }
}
