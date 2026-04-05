import { Task, CreateTaskInput, UpdateTaskInput, TaskFilters } from './types';
import { PaginationParams, PaginatedResult } from '@/lib/pagination.types';

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
   * Toggle task completion status
   */
  toggleComplete(id: string): Promise<Task>;
  
  /**
   * Toggle task bookmark status
   */
  toggleBookmark(id: string): Promise<Task>;

  /**
   * Fetch a page of tasks (cursor-based pagination)
   */
  getPage(params?: PaginationParams): Promise<PaginatedResult<Task>>;
}
