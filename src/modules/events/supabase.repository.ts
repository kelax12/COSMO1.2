// ═══════════════════════════════════════════════════════════════════
// EVENTS MODULE - Supabase Repository Implementation
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { IEventsRepository } from './repository';
import { CalendarEvent, CreateEventInput, UpdateEventInput, EventFilters } from './types';
import { mapEventFromDb, mapEventToDb } from './mappers';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE, assertValidCursor } from '@/lib/pagination.types';
import { warnIfTruncated } from '@/lib/pagination.warning';
import { fetchAllPages, MAX_ROWS } from '@/lib/fetch-all-pages';
import { buildWindowOrFilter } from './window';

export class SupabaseEventsRepository implements IEventsRepository {
  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async getAll(): Promise<CalendarEvent[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const db = supabase;
    // Auto-pagination : plus de troncature silencieuse au-delà de 500 items.
    const rows = await fetchAllPages(async (from, to) => {
      const { data, error } = await db
        .from('events')
        .select('*')
        .order('start_time', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to);
      if (error) throw normalizeApiError(error);
      return data || [];
    });
    return warnIfTruncated(rows, MAX_ROWS, 'events').map(mapEventFromDb);
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
      assertValidCursor(params.cursor, params.cursorDate);
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
      data: items.map(mapEventFromDb),
      hasMore,
      nextCursor: hasMore && lastItem ? lastItem.id : null,
      nextCursorDate: hasMore && lastItem ? lastItem.start_time : null,
    };
  }

  async getWindow(startISO: string, endISO: string): Promise<CalendarEvent[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const db = supabase;
    const orFilter = buildWindowOrFilter(startISO, endISO);
    // Récurrents (toujours) + non-récurrents chevauchant la fenêtre. Auto-paginé
    // (une fenêtre chargée reste petite, mais on garde la garantie anti-troncature).
    const rows = await fetchAllPages(async (from, to) => {
      const { data, error } = await db
        .from('events')
        .select('*')
        .or(orFilter)
        .order('start_time', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to);
      if (error) throw normalizeApiError(error);
      return data || [];
    });
    return warnIfTruncated(rows, MAX_ROWS, 'events:window').map(mapEventFromDb);
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
    return data ? mapEventFromDb(data) : null;
  }

  async getByTaskId(taskId: string): Promise<CalendarEvent[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('task_id', taskId)
      .order('start_time', { ascending: true });

    if (error) throw normalizeApiError(error);
    return (data || []).map(mapEventFromDb);
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
    return (data || []).map(mapEventFromDb);
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateEventInput): Promise<CalendarEvent> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const dbInput = { ...mapEventToDb(input), user_id: user.id };

    const { data, error } = await supabase
      .from('events')
      .insert([dbInput])
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return mapEventFromDb(data);
  }

  async update(id: string, updates: UpdateEventInput): Promise<CalendarEvent> {
    if (!supabase) throw new Error('Supabase not configured');
    const dbUpdates = mapEventToDb(updates);

    const { data, error } = await supabase
      .from('events')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return mapEventFromDb(data);
  }

  async delete(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) throw normalizeApiError(error);
  }

}
