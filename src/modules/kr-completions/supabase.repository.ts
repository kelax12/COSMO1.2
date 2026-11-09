// ═══════════════════════════════════════════════════════════════════
// KR-COMPLETIONS MODULE - Supabase Repository Implementation
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import { IKRCompletionsRepository } from './repository';
import { KRCompletion, CreateKRCompletionInput, KRCompletionFilters } from './types';
import { warnIfTruncated } from '@/lib/pagination.warning';
import { fetchAllPages, MAX_ROWS } from '@/lib/fetch-all-pages';

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
    const client = supabase;

    // COSMO-40 : un `.limit(500)` sec coupait le journal d'un compte actif, et
    // avec lui le graphique « KR réalisés », l'historique OKR et /statistics.
    // Même pagination que les autres getAll() ; `id` départage deux complétions
    // horodatées à l'identique, sans quoi une ligne peut sauter entre deux pages.
    const rows = await fetchAllPages<KRCompletionRow>(async (from, to) => {
      const { data, error } = await client
        .from('kr_completions')
        .select('*')
        .order('completed_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);
      if (error) throw normalizeApiError(error);
      return (data || []) as KRCompletionRow[];
    });
    return warnIfTruncated(rows, MAX_ROWS, 'kr_completions').map(mapFromDb);
  }

  async getAllForExport(): Promise<KRCompletion[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const client = supabase;
    const user = await getCurrentUser();
    if (!user) throw makeApiError('not_authenticated');

    // La RLS borne déjà à `auth.uid() = user_id` ; le filtre explicite garde
    // l'export juste même si une policy d'équipe s'ajoutait un jour.
    const rows = await fetchAllPages<KRCompletionRow>(async (from, to) => {
      const { data, error } = await client
        .from('kr_completions')
        .select('*')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .range(from, to);
      if (error) throw normalizeApiError(error);
      return (data || []) as KRCompletionRow[];
    });
    return warnIfTruncated(rows, MAX_ROWS, 'kr_completions').map(mapFromDb);
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

    const user = await getCurrentUser();
    if (!user) throw makeApiError('not_authenticated');

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
