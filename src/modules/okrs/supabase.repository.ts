// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - Supabase Repository Implementation
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { IOKRsRepository } from './repository';
import { OKR, CreateOKRInput, UpdateOKRInput, UpdateKeyResultInput, OKRFilters, KeyResult } from './types';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE } from '@/lib/pagination.types';

/**
 * Supabase DB row type for okrs table (snake_case)
 */
interface OKRRow {
  id: string;
  title: string;
  description: string;
  category: string;
  progress: number;
  completed: boolean;
  key_results: KeyResult[];
  start_date: string;
  end_date: string;
  user_id?: string;
  created_at?: string;
}

/**
 * DB input type for insert/update operations (snake_case)
 */
interface OKRDbInput {
  title?: string;
  description?: string;
  category?: string;
  progress?: number;
  completed?: boolean;
  key_results?: KeyResult[];
  start_date?: string;
  end_date?: string;
  user_id?: string;
}

export class SupabaseOKRsRepository implements IOKRsRepository {
  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async getAll(): Promise<OKR[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('okrs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw normalizeApiError(error);
    return (data || []).map(this.mapFromDb);
  }

  async getPage(params: PaginationParams = {}): Promise<PaginatedResult<OKR>> {
    if (!supabase) throw new Error('Supabase not configured');

    const limit = params.limit ?? DEFAULT_PAGE_SIZE;

    let query = supabase
      .from('okrs')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

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

  async getById(id: string): Promise<OKR | null> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('okrs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw normalizeApiError(error);
    }
    return data ? this.mapFromDb(data) : null;
  }

  async getByCategory(category: string): Promise<OKR[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('okrs')
      .select('*')
      .eq('category', category)
      .order('created_at', { ascending: false });

    if (error) throw normalizeApiError(error);
    return (data || []).map(this.mapFromDb);
  }

  async getFiltered(filters: OKRFilters): Promise<OKR[]> {
    if (!supabase) throw new Error('Supabase not configured');
    let query = supabase.from('okrs').select('*');

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.completed !== undefined) {
      query = query.eq('completed', filters.completed);
    }

    if (filters.startAfter) {
      query = query.gte('start_date', filters.startAfter);
    }

    if (filters.endBefore) {
      query = query.lte('end_date', filters.endBefore);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw normalizeApiError(error);
    return (data || []).map(this.mapFromDb);
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateOKRInput): Promise<OKR> {
    if (!supabase) throw new Error('Supabase not configured');
    const dbInput = this.mapToDb(input);

    const { data, error } = await supabase
      .from('okrs')
      .insert([dbInput])
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return this.mapFromDb(data);
  }

  async update(id: string, updates: UpdateOKRInput): Promise<OKR> {
    if (!supabase) throw new Error('Supabase not configured');
    const dbUpdates = this.mapToDb(updates);

    const { data, error } = await supabase
      .from('okrs')
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
      .from('okrs')
      .delete()
      .eq('id', id);

    if (error) throw normalizeApiError(error);
  }

  // ═══════════════════════════════════════════════════════════════════
  // KEY RESULT OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async updateKeyResult(okrId: string, keyResultId: string, updates: UpdateKeyResultInput): Promise<OKR> {
    // Fetch current OKR
    const okr = await this.getById(okrId);
    if (!okr) {
      throw new Error(`OKR with id ${okrId} not found`);
    }

    const krIndex = okr.keyResults.findIndex(kr => kr.id === keyResultId);
    if (krIndex === -1) {
      throw new Error(`KeyResult with id ${keyResultId} not found`);
    }

    // Update the key result
    okr.keyResults[krIndex] = { ...okr.keyResults[krIndex], ...updates };

    // Recalculate OKR progress
    const totalProgress = okr.keyResults.reduce((sum, kr) => {
      return sum + Math.min((kr.currentValue / kr.targetValue) * 100, 100);
    }, 0);
    const newProgress = Math.round(totalProgress / okr.keyResults.length);

    // Check if all key results are completed
    const newCompleted = okr.keyResults.every(kr => kr.currentValue >= kr.targetValue);

    // Update in database
    return this.update(okrId, {
      keyResults: okr.keyResults,
      progress: newProgress,
      completed: newCompleted,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAPPING (snake_case <-> camelCase)
  // ═══════════════════════════════════════════════════════════════════

  private mapFromDb(row: OKRRow): OKR {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      progress: row.progress,
      completed: row.completed,
      keyResults: row.key_results || [],
      startDate: row.start_date,
      endDate: row.end_date,
    };
  }

  private mapToDb(input: Partial<OKR>): OKRDbInput {
    const result: OKRDbInput = {};
    if (input.title !== undefined) result.title = input.title;
    if (input.description !== undefined) result.description = input.description;
    if (input.category !== undefined) result.category = input.category;
    if (input.progress !== undefined) result.progress = input.progress;
    if (input.completed !== undefined) result.completed = input.completed;
    if (input.keyResults !== undefined) result.key_results = input.keyResults;
    if (input.startDate !== undefined) result.start_date = input.startDate;
    if (input.endDate !== undefined) result.end_date = input.endDate;
    return result;
  }
}
