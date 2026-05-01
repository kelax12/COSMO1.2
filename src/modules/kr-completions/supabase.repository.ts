// ═══════════════════════════════════════════════════════════════════
// KR-COMPLETIONS MODULE - Supabase Repository Implementation
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { IKRCompletionsRepository } from './repository';
import { KRCompletion, CreateKRCompletionInput, KRCompletionFilters } from './types';
import { warnIfTruncated } from '@/lib/pagination.warning';

// ─── DB row type ────────────────────────────────────────────────────

interface KRCompletionRow {
  id: string;
  kr_id: string;
  okr_id: string;
  user_id: string;
  completed_at: string;
  kr_title: string;
  okr_title: string;
  created_at?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

const mapFromDb = (row: KRCompletionRow): KRCompletion => ({
  id: row.id,
  krId: row.kr_id,
  okrId: row.okr_id,
  userId: row.user_id,
  completedAt: row.completed_at,
  krTitle: row.kr_title,
  okrTitle: row.okr_title,
});

// ═══════════════════════════════════════════════════════════════════
// SUPABASE IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export class SupabaseKRCompletionsRepository implements IKRCompletionsRepository {

  async getAll(): Promise<KRCompletion[]> {
    if (!supabase) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('kr_completions')
      .select('*')
      .order('completed_at', { ascending: false })
      .limit(500);

    if (error) throw normalizeApiError(error);
    return warnIfTruncated((data || []) as KRCompletionRow[], 500, 'kr_completions').map(mapFromDb);
  }

  async getFiltered(filters: KRCompletionFilters): Promise<KRCompletion[]> {
    if (!supabase) throw new Error('Supabase not configured');

    let query = supabase.from('kr_completions').select('*');

    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.okrId) query = query.eq('okr_id', filters.okrId);
    if (filters.krId) query = query.eq('kr_id', filters.krId);
    if (filters.completedAfter) query = query.gte('completed_at', filters.completedAfter);
    if (filters.completedBefore) query = query.lte('completed_at', filters.completedBefore);

    const { data, error } = await query.order('completed_at', { ascending: false }).limit(500);
    if (error) throw normalizeApiError(error);
    return ((data || []) as KRCompletionRow[]).map(mapFromDb);
  }

  async create(input: CreateKRCompletionInput): Promise<KRCompletion> {
    if (!supabase) throw new Error('Supabase not configured');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('kr_completions')
      .insert([{
        kr_id: input.krId,
        okr_id: input.okrId,
        user_id: user.id,
        completed_at: input.completedAt,
        kr_title: input.krTitle,
        okr_title: input.okrTitle,
      }])
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    return mapFromDb(data as KRCompletionRow);
  }
}
