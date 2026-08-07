import { Task, CreateTaskInput, UpdateTaskInput, TaskFilters } from './types';
import { PaginationParams, PaginatedResult } from '@/lib/pagination.types';

/**
 * Résultat d'un basculement de complétion.
 *
 * `spawned` porte l'occurrence récurrente éventuellement générée par la MÊME
 * opération (audit archi 2026-08-07, H1). Avant, cette création était un
 * `create()` fire-and-forget dans le `onSuccess` du hook : elle se perdait
 * silencieusement si l'onglet se fermait, et se dupliquait si l'utilisateur
 * décochait puis recochait. La génération est désormais atomique et idempotente
 * (mig. 086), et son résultat remonte ici pour la mise à jour du cache.
 *
 * `spawned` vaut `null` quand rien n'a été généré : tâche non récurrente,
 * dé-validation, ou occurrence déjà existante (rejeu idempotent).
 */
export interface ToggleCompleteResult {
  task: Task;
  spawned: Task | null;
}

/**
 * Interface for Tasks Repository
 * Phase 1: READ-ONLY operations
 * Phase 2: WRITE operations (create/update/delete/toggle)
 */
export interface ITasksRepository {
  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS (Phase 1)
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Fetch all tasks
   */
  getAll(): Promise<Task[]>;
  
  /**
   * Fetch a single task by ID
   */
  getById(id: string): Promise<Task | null>;
  
  /**
   * Fetch tasks by date (deadline)
   */
  getByDate(date: string): Promise<Task[]>;
  
  /**
   * Fetch tasks with filters
   */
  getFiltered(filters: TaskFilters): Promise<Task[]>;

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS (Phase 2)
  // ═══════════════════════════════════════════════════════════════════
  
  /**
   * Create a new task
   */
  create(input: CreateTaskInput): Promise<Task>;
  
  /**
   * Update an existing task
   */
  update(id: string, updates: UpdateTaskInput): Promise<Task>;
  
  /**
   * Delete a task
   */
  delete(id: string): Promise<void>;
  
  /**
   * Bascule l'état de complétion.
   *
   * @param nextDeadline Échéance (YYYY-MM-DD, date LOCALE de l'utilisateur) de
   *   l'occurrence suivante à générer si la tâche devient complétée et qu'elle
   *   est récurrente. Calculée par l'appelant via `nextOccurrenceDeadline()` —
   *   le serveur ne connaît pas le fuseau de l'utilisateur. `null`/omis = ne
   *   rien générer.
   */
  toggleComplete(id: string, nextDeadline?: string | null): Promise<ToggleCompleteResult>;
  
  /**
   * Toggle task bookmark status
   */
  toggleBookmark(id: string): Promise<Task>;

  /**
   * Fetch a page of tasks (cursor-based pagination)
   */
  getPage(params?: PaginationParams): Promise<PaginatedResult<Task>>;
}
