import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { IHabitsRepository } from './repository';
import { Habit, CreateHabitInput, UpdateHabitInput } from './types';
import { HabitRow, mapHabitFromDb, mapHabitToDb } from './mappers';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE, assertValidCursor } from '@/lib/pagination.types';
import { warnIfTruncated } from '@/lib/pagination.warning';
import { fetchAllPages, MAX_ROWS } from '@/lib/fetch-all-pages';

export class SupabaseHabitsRepository implements IHabitsRepository {
  async fetchHabits(): Promise<Habit[]> {
    // Auto-pagination : plus de troncature silencieuse au-delà de 500 items.
    const rows = await fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);
      if (error) throw normalizeApiError(error);
      return data || [];
    });

    // Map snake_case to camelCase
    return warnIfTruncated(rows, MAX_ROWS, 'habits').map(mapHabitFromDb);
  }

  async getPage(params: PaginationParams = {}): Promise<PaginatedResult<Habit>> {
    if (!supabase) throw new Error('Supabase not configured');

    const limit = params.limit ?? DEFAULT_PAGE_SIZE;

    let query = supabase
      .from('habits')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    if (params.cursor && params.cursorDate) {
      assertValidCursor(params.cursor, params.cursorDate);
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
      data: items.map(mapHabitFromDb),
      hasMore,
      nextCursor: hasMore && lastItem ? lastItem.id : null,
      nextCursorDate: hasMore && lastItem ? lastItem.created_at : null,
    };
  }

  async getById(id: string): Promise<Habit | null> {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw normalizeApiError(error);
    }
    return data ? mapHabitFromDb(data) : null;
  }

  async createHabit(input: CreateHabitInput): Promise<Habit> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const dbInput = { ...mapHabitToDb(input), user_id: user.id };

    const { data, error } = await supabase
      .from('habits')
      .insert([dbInput])
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return mapHabitFromDb(data);
  }

  async updateHabit(id: string, updates: UpdateHabitInput): Promise<Habit> {
    const dbUpdates = mapHabitToDb(updates);
    
    const { data, error } = await supabase
      .from('habits')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return mapHabitFromDb(data);
  }

  async deleteHabit(id: string): Promise<void> {
    const { error } = await supabase
      .from('habits')
      .delete()
      .eq('id', id);

    if (error) throw normalizeApiError(error);
  }

  async toggleCompletion(id: string, date: string): Promise<Habit> {
    // Atomic toggle via RPC (migration 023, faille TOCTOU-1). L'ancien code
    // faisait SELECT completions → mutate JS → UPDATE — un autre tab/device
    // pouvait écrire entre les deux et perdre ses changements.
    const { data, error } = await supabase.rpc('toggle_habit_completion', {
      p_habit_id: id,
      p_date: date,
    });

    if (error) throw normalizeApiError(error);
    return mapHabitFromDb(data as HabitRow);
  }

}
