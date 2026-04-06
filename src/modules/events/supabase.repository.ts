// ═══════════════════════════════════════════════════════════════════
// EVENTS MODULE - Supabase Repository Implementation
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { IEventsRepository } from './repository';
import { CalendarEvent, CreateEventInput, UpdateEventInput, EventFilters } from './types';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE } from '@/lib/pagination.types';

/**
 * Supabase DB row type for events table (snake_case)
 */
interface EventRow {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color?: string;
  description?: string;
  notes?: string;
  task_id?: string;
  user_id?: string;
  created_at?: string;
}

/**
 * DB input type for insert/update operations (snake_case)
 */
interface EventDbInput {
  title?: string;
  start_time?: string;
  end_time?: string;
  color?: string;
  description?: string;
  notes?: string;
  task_id?: string;
  user_id?: string;
}

export class SupabaseEventsRepository implements IEventsRepository {
  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async getAll(): Promise<CalendarEvent[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('start_time', { ascending: true })
      .limit(500);

    if (error) throw normalizeApiError(error);
    return (data || []).map(this.mapFromDb);
  }

  async getPage(params: PaginationParams = {}): Promise<PaginatedResult<CalendarEvent>> {
    if (!supabase) throw new Error('Supabase not configured');

    const limit = params.limit ?? DEFAULT_PAGE_SIZE;

    let query = supabase
      .from('events')
      .select('*')
      .order('start_time', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    if (params.cursor && params.cursorDate) {
      query = query.or(
        `start_time.lt.${params.cursorDate},and(start_time.eq.${params.cursorDate},id.lt.${params.cursor})`
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
      nextCursorDate: hasMore && lastItem ? lastItem.start_time : null,
    };
  }

  async getById(id: string): Promise<CalendarEvent | null> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw normalizeApiError(error);
    }
    return data ? this.mapFromDb(data) : null;
  }

  async getByTaskId(taskId: string): Promise<CalendarEvent[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('task_id', taskId)
      .order('start_time', { ascending: true });

    if (error) throw normalizeApiError(error);
    return (data || []).map(this.mapFromDb);
  }

  async getFiltered(filters: EventFilters): Promise<CalendarEvent[]> {
    if (!supabase) throw new Error('Supabase not configured');
    let query = supabase.from('events').select('*');

    if (filters.taskId) {
      query = query.eq('task_id', filters.taskId);
    }

    if (filters.startAfter) {
      query = query.gte('start_time', filters.startAfter);
    }

    if (filters.startBefore) {
      query = query.lte('start_time', filters.startBefore);
    }

    if (filters.endAfter) {
      query = query.gte('end_time', filters.endAfter);
    }

    if (filters.endBefore) {
      query = query.lte('end_time', filters.endBefore);
    }

    const { data, error } = await query.order('start_time', { ascending: true });

    if (error) throw normalizeApiError(error);
    return (data || []).map(this.mapFromDb);
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateEventInput): Promise<CalendarEvent> {
    if (!supabase) throw new Error('Supabase not configured');
    const dbInput = this.mapToDb(input);

    const { data, error } = await supabase
      .from('events')
      .insert([dbInput])
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return this.mapFromDb(data);
  }

  async update(id: string, updates: UpdateEventInput): Promise<CalendarEvent> {
    if (!supabase) throw new Error('Supabase not configured');
    const dbUpdates = this.mapToDb(updates);

    const { data, error } = await supabase
      .from('events')
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
      .from('events')
      .delete()
      .eq('id', id);

    if (error) throw normalizeApiError(error);
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAPPING (snake_case <-> camelCase)
  // ═══════════════════════════════════════════════════════════════════

  private mapFromDb(row: EventRow): CalendarEvent {
    return {
      id: row.id,
      title: row.title,
      start: row.start_time,
      end: row.end_time,
      color: row.color,
      description: row.description,
      notes: row.notes,
      taskId: row.task_id,
    };
  }

  private mapToDb(input: Partial<CalendarEvent>): EventDbInput {
    const result: EventDbInput = {};
    if (input.title !== undefined) result.title = input.title;
    if (input.start !== undefined) result.start_time = input.start;
    if (input.end !== undefined) result.end_time = input.end;
    if (input.color !== undefined) result.color = input.color;
    if (input.description !== undefined) result.description = input.description;
    if (input.notes !== undefined) result.notes = input.notes;
    if (input.taskId !== undefined) result.task_id = input.taskId;
    return result;
  }
}
