// ═══════════════════════════════════════════════════════════════════
// KR-COMPLETIONS MODULE - Supabase Repository Implementation
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import { IKRCompletionsRepository } from './repository';
import { KRCompletion, CreateKRCompletionInput, KRCompletionFilters } from './types';
import { fetchAllByCursor } from '@/lib/fetch-all-pages';
import { assertValidCursor } from '@/lib/pagination.types';

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

interface KRCursor {
  id: string;
  completedAt: string;
}

const KR_PAGE_SIZE = 1000;

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

  /**
   * Le journal filtré, par pages de CLÉ `(completed_at, id)` décroissantes,
   * jusqu'à la dernière, SANS plafond (PER-01). Chaque lecture est bornée par
   * son filtre (fenêtre de dates, un OKR, la personne pour l'export), jamais
   * par un nombre de lignes : un plafond referait la troncature silencieuse.
   * `id` départage deux complétions horodatées à l'identique (COSMO-40).
   */
  private async readAll(filters: KRCompletionFilters): Promise<KRCompletion[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const client = supabase;
    const rows = await fetchAllByCursor<KRCompletionRow, KRCursor>(
      async (cursor) => {
        let query = client.from('kr_completions').select('*');
        if (filters.userId) query = query.eq('user_id', filters.userId);
        if (filters.okrId) query = query.eq('okr_id', filters.okrId);
        if (filters.krId) query = query.eq('kr_id', filters.krId);
        if (filters.completedAfter) query = query.gte('completed_at', filters.completedAfter);
        if (filters.completedBefore) query = query.lte('completed_at', filters.completedBefore);
        if (cursor) {
          // Validé AVANT d'être interpolé dans `.or()` (faille N6).
          assertValidCursor(cursor.id, cursor.completedAt);
          query = query.or(
            `completed_at.lt.${cursor.completedAt},and(completed_at.eq.${cursor.completedAt},id.lt.${cursor.id})`,
          );
        }
        const { data, error } = await query
          .order('completed_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(KR_PAGE_SIZE + 1); // +1 pour savoir s'il y a une page suivante
        if (error) throw normalizeApiError(error);
        const all = (data || []) as KRCompletionRow[];
        const hasMore = all.length > KR_PAGE_SIZE;
        const page = hasMore ? all.slice(0, KR_PAGE_SIZE) : all;
        const last = page[page.length - 1];
        return { rows: page, next: hasMore && last ? { id: last.id, completedAt: last.completed_at } : null };
      },
      (a, b) => a.id === b.id && a.completedAt === b.completedAt,
    );
    return rows.map(mapFromDb);
  }

  async getSince(sinceISO: string): Promise<KRCompletion[]> {
    // La RLS borne à la personne ; la fenêtre borne le volume (index
    // `idx_kr_completions_completed_at`, mig. 009).
    return this.readAll({ completedAfter: sinceISO });
  }

  async getAllForExport(): Promise<KRCompletion[]> {
    const user = await getCurrentUser();
    if (!user) throw makeApiError('not_authenticated');
    // La RLS borne déjà à `auth.uid() = user_id` ; le filtre explicite garde
    // l'export juste même si une policy d'équipe s'ajoutait un jour.
    return this.readAll({ userId: user.id });
  }

  async getFiltered(filters: KRCompletionFilters): Promise<KRCompletion[]> {
    return this.readAll(filters);
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
