// ═══════════════════════════════════════════════════════════════════
// LISTS MODULE - Supabase Repository Implementation
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { IListsRepository } from './repository';
import { TaskList, CreateListInput, UpdateListInput } from './types';
import { warnIfTruncated } from '@/lib/pagination.warning';

// ═══════════════════════════════════════════════════════════════════
// DB ROW TYPES (snake_case - matches Supabase table schema)
// ═══════════════════════════════════════════════════════════════════

/**
 * Supabase DB row type for lists table
 */
interface ListRow {
  id: string;
  name: string;
  color: string;
  task_ids: string[];
  user_id?: string;
  created_at?: string;
}

/**
 * DB input type for insert/update operations
 */
interface ListDbInput {
  name?: string;
  color?: string;
  task_ids?: string[];
  user_id?: string;
}

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export class SupabaseListsRepository implements IListsRepository {
  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async getAll(): Promise<TaskList[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .order('name', { ascending: true })
      .limit(200); // Sécurité — les listes ne devraient jamais dépasser 200

    if (error) throw normalizeApiError(error);
    return warnIfTruncated(data || [], 200, 'lists').map(this.mapFromDb);
  }

  async getById(id: string): Promise<TaskList | null> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw normalizeApiError(error);
    }
    return data ? this.mapFromDb(data) : null;
  }

  async getByTaskId(taskId: string): Promise<TaskList[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .contains('task_ids', [taskId]);

    if (error) throw normalizeApiError(error);
    return (data || []).map(this.mapFromDb);
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateListInput): Promise<TaskList> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const dbInput: ListDbInput = {
      ...this.mapToDb(input),
      task_ids: [],
      user_id: user.id,
    };

    const { data, error } = await supabase
      .from('lists')
      .insert([dbInput])
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return this.mapFromDb(data);
  }

  async update(id: string, updates: UpdateListInput): Promise<TaskList> {
    if (!supabase) throw new Error('Supabase not configured');
    const dbUpdates = this.mapToDb(updates);

    const { data, error } = await supabase
      .from('lists')
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
      .from('lists')
      .delete()
      .eq('id', id);

    if (error) throw normalizeApiError(error);
  }

  // ═══════════════════════════════════════════════════════════════════
  // TASK ASSOCIATION OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async addTaskToList(taskId: string, listId: string): Promise<TaskList> {
    // First get current list
    const list = await this.getById(listId);
    if (!list) {
      throw new Error(`List with id ${listId} not found`);
    }

    // Add task if not already present
    if (!list.taskIds.includes(taskId)) {
      const newTaskIds = [...list.taskIds, taskId];
      return this.update(listId, { taskIds: newTaskIds });
    }

    return list;
  }

  async removeTaskFromList(taskId: string, listId: string): Promise<TaskList> {
    // First get current list
    const list = await this.getById(listId);
    if (!list) {
      throw new Error(`List with id ${listId} not found`);
    }

    // Remove task
    const newTaskIds = list.taskIds.filter(id => id !== taskId);
    return this.update(listId, { taskIds: newTaskIds });
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAPPING (snake_case <-> camelCase)
  // ═══════════════════════════════════════════════════════════════════

  private mapFromDb(row: ListRow): TaskList {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      taskIds: row.task_ids || [],
    };
  }

  private mapToDb(input: Partial<TaskList>): ListDbInput {
    const result: ListDbInput = {};
    if (input.name !== undefined) result.name = input.name;
    if (input.color !== undefined) result.color = input.color;
    if (input.taskIds !== undefined) result.task_ids = input.taskIds;
    return result;
  }
}
