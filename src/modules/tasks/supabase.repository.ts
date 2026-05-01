import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { ITasksRepository } from './repository';
import { Task, CreateTaskInput, UpdateTaskInput, TaskFilters } from './types';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE } from '@/lib/pagination.types';
import { warnIfTruncated } from '@/lib/pagination.warning';

/**
 * Supabase DB row type for tasks table (snake_case)
 */
interface TaskRow {
  id: string;
  name: string;
  description?: string;
  priority: number;
  category: string;
  deadline: string;
  estimated_time: number;
  created_at?: string;
  bookmarked?: boolean;
  completed?: boolean;
  completed_at?: string;
  is_collaborative?: boolean;
  collaborators?: string[];
  pending_invites?: string[];
  collaborator_validations?: Record<string, boolean>;
  user_id?: string;
}

/**
 * DB input type for insert/update operations (snake_case)
 */
interface TaskDbInput {
  name?: string;
  description?: string;
  priority?: number;
  category?: string;
  deadline?: string;
  estimated_time?: number;
  bookmarked?: boolean;
  completed?: boolean;
  completed_at?: string;
  is_collaborative?: boolean;
  collaborators?: string[];
  pending_invites?: string[];
  collaborator_validations?: Record<string, boolean>;
  user_id?: string;
}

/** Fields the client is allowed to set on insert (user_id is added server-side from auth.uid()). */
type TaskDbCreateInput = Omit<TaskDbInput, 'user_id'> & { user_id: string };

export class SupabaseTasksRepository implements ITasksRepository {
  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async getAll(): Promise<Task[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw normalizeApiError(error);
    return warnIfTruncated(data || [], 500, 'tasks').map(this.mapFromDb);
  }

  async getPage(params: PaginationParams = {}): Promise<PaginatedResult<Task>> {
    if (!supabase) throw new Error('Supabase not configured');

    const limit = params.limit ?? DEFAULT_PAGE_SIZE;

    let query = supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1); // +1 pour détecter s'il y a une page suivante

    // Applique le cursor si fourni (pagination cursor-based)
    if (params.cursor && params.cursorDate) {
      query = query.or(
        `created_at.lt.${params.cursorDate},and(created_at.eq.${params.cursorDate},id.lt.${params.cursor})`
      );
    }

    const { data, error } = await query;
    if (error) throw normalizeApiError(error);

    const rows = data || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = items[items.length - 1];

    return {
      data: items.map(this.mapFromDb),
      hasMore,
      nextCursor: hasMore && lastItem ? lastItem.id : null,
      nextCursorDate: hasMore && lastItem ? lastItem.created_at : null,
    };
  }

  async getById(id: string): Promise<Task | null> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw normalizeApiError(error);
    }
    return data ? this.mapFromDb(data) : null;
  }

  async getByDate(date: string): Promise<Task[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const targetDate = date.split('T')[0];
    const startOfDay = `${targetDate}T00:00:00.000Z`;
    const endOfDay = `${targetDate}T23:59:59.999Z`;

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .gte('deadline', startOfDay)
      .lte('deadline', endOfDay)
      .order('deadline', { ascending: true });

    if (error) throw normalizeApiError(error);
    return (data || []).map(this.mapFromDb);
  }

  async getFiltered(filters: TaskFilters): Promise<Task[]> {
    if (!supabase) throw new Error('Supabase not configured');
    let query = supabase.from('tasks').select('*');

    if (filters.completed !== undefined) {
      query = query.eq('completed', filters.completed);
    }

    if (filters.bookmarked !== undefined) {
      query = query.eq('bookmarked', filters.bookmarked);
    }

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.priorityMin !== undefined) {
      query = query.gte('priority', filters.priorityMin);
    }

    if (filters.priorityMax !== undefined) {
      query = query.lte('priority', filters.priorityMax);
    }

    if (filters.deadlineBefore) {
      query = query.lte('deadline', filters.deadlineBefore);
    }

    if (filters.deadlineAfter) {
      query = query.gte('deadline', filters.deadlineAfter);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw normalizeApiError(error);
    return (data || []).map(this.mapFromDb);
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateTaskInput): Promise<Task> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const dbInput: TaskDbCreateInput = { ...this.mapToDb(input), user_id: user.id };

    const { data, error } = await supabase
      .from('tasks')
      .insert([dbInput])
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return this.mapFromDb(data);
  }

  async update(id: string, updates: UpdateTaskInput): Promise<Task> {
    if (!supabase) throw new Error('Supabase not configured');
    const dbUpdates = this.mapToDb(updates);

    const { data, error } = await supabase
      .from('tasks')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return this.mapFromDb(data);
  }

  async delete(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw normalizeApiError(error);
  }

  async toggleComplete(id: string): Promise<Task> {
    if (!supabase) throw new Error('Supabase not configured');
    const task = await this.getById(id);
    if (!task) throw new Error(`Task ${id} not found`);

    const newCompleted = !task.completed;
    const updates: TaskDbInput = {
      completed: newCompleted,
      completed_at: newCompleted ? new Date().toISOString() : undefined,
    };

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return this.mapFromDb(data);
  }

  async toggleBookmark(id: string): Promise<Task> {
    if (!supabase) throw new Error('Supabase not configured');
    const task = await this.getById(id);
    if (!task) throw new Error(`Task ${id} not found`);

    const { data, error } = await supabase
      .from('tasks')
      .update({ bookmarked: !task.bookmarked })
      .eq('id', id)
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return this.mapFromDb(data);
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAPPING (snake_case <-> camelCase)
  // ═══════════════════════════════════════════════════════════════════
  private mapFromDb(row: TaskRow): Task {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      priority: row.priority,
      category: row.category,
      deadline: row.deadline,
      estimatedTime: row.estimated_time,
      createdAt: row.created_at,
      bookmarked: row.bookmarked ?? false,
      completed: row.completed ?? false,
      completedAt: row.completed_at,
      isCollaborative: row.is_collaborative ?? false,
      collaborators: row.collaborators || [],
      pendingInvites: row.pending_invites || [],
      collaboratorValidations: row.collaborator_validations || {},
      userId: row.user_id,
    };
  }

  private mapToDb(input: Partial<Task>): TaskDbInput {
    const result: TaskDbInput = {};
    if (input.name !== undefined) result.name = input.name;
    if (input.description !== undefined) result.description = input.description;
    if (input.priority !== undefined) result.priority = input.priority;
    if (input.category !== undefined) result.category = input.category;
    if (input.deadline !== undefined) result.deadline = input.deadline;
    if (input.estimatedTime !== undefined) result.estimated_time = input.estimatedTime;
    if (input.bookmarked !== undefined) result.bookmarked = input.bookmarked;
    if (input.completed !== undefined) result.completed = input.completed;
    if (input.completedAt !== undefined) result.completed_at = input.completedAt;
    if (input.isCollaborative !== undefined) result.is_collaborative = input.isCollaborative;
    if (input.collaborators !== undefined) result.collaborators = input.collaborators;
    if (input.pendingInvites !== undefined) result.pending_invites = input.pendingInvites;
    if (input.collaboratorValidations !== undefined) result.collaborator_validations = input.collaboratorValidations;
    return result;
  }
}
