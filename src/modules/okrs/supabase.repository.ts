// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - Supabase Repository Implementation
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { IOKRsRepository } from './repository';
import { OKR, CreateOKRInput, UpdateOKRInput, UpdateKeyResultInput, OKRFilters, KeyResult } from './types';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE } from '@/lib/pagination.types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (id: string): boolean => UUID_REGEX.test(id);

// ─── DB row types ────────────────────────────────────────────────────────────

interface OKRRow {
  id: string;
  title: string;
  description: string;
  category: string;
  progress: number;
  completed: boolean;
  key_results: KeyResult[]; // JSONB — kept for backward compat
  start_date: string;
  end_date: string;
  user_id?: string;
  created_at?: string;
}

interface KRRow {
  id: string;
  okr_id: string;
  user_id: string;
  title: string;
  unit: string;
  current_value: number;
  target_value: number;
  estimated_time: number;
  completed: boolean;
  completed_at: string | null;
}

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mapKRFromDb = (row: KRRow): KeyResult => ({
  id: row.id,
  title: row.title,
  unit: row.unit,
  currentValue: Number(row.current_value),
  targetValue: Number(row.target_value),
  estimatedTime: row.estimated_time,
  completed: row.completed,
  completedAt: row.completed_at ?? null,
});

const mapKRToDb = (kr: KeyResult, okrId: string, userId: string) => ({
  id: kr.id,
  okr_id: okrId,
  user_id: userId,
  title: kr.title,
  unit: kr.unit,
  current_value: kr.currentValue,
  target_value: kr.targetValue,
  estimated_time: kr.estimatedTime,
  completed: kr.completed,
});

const recalcProgress = (keyResults: KeyResult[]): { progress: number; completed: boolean } => {
  if (keyResults.length === 0) return { progress: 0, completed: false };
  const total = keyResults.reduce((sum, kr) => sum + Math.min((kr.currentValue / kr.targetValue) * 100, 100), 0);
  const progress = Math.round(total / keyResults.length);
  const completed = keyResults.every(kr => kr.currentValue >= kr.targetValue);
  return { progress, completed };
};

export class SupabaseOKRsRepository implements IOKRsRepository {

  // ─── Fetch KRs from dedicated table, fallback to JSONB ──────────────────

  private async fetchKRsForOkrs(okrRows: OKRRow[]): Promise<Map<string, KeyResult[]>> {
    if (!supabase || okrRows.length === 0) return new Map();

    const okrIds = okrRows.map(r => r.id);
    const { data, error } = await supabase
      .from('key_results')
      .select('*')
      .in('okr_id', okrIds)
      .order('created_at', { ascending: true });

    const krMap = new Map<string, KeyResult[]>();

    if (error || !data || data.length === 0) {
      // Fallback: use JSONB data from okrs table
      for (const row of okrRows) {
        krMap.set(row.id, row.key_results || []);
      }
      return krMap;
    }

    for (const kr of data as KRRow[]) {
      const list = krMap.get(kr.okr_id) ?? [];
      list.push(mapKRFromDb(kr));
      krMap.set(kr.okr_id, list);
    }

    // For OKRs with no rows in key_results table, fallback to JSONB
    for (const row of okrRows) {
      if (!krMap.has(row.id)) {
        krMap.set(row.id, row.key_results || []);
      }
    }

    return krMap;
  }

  private mapFromDb(row: OKRRow, keyResults: KeyResult[]): OKR {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      progress: row.progress,
      completed: row.completed,
      keyResults,
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

  // ─── Sync KRs to dedicated table (upsert) ───────────────────────────────

  private async syncKRsToTable(okrId: string, userId: string, keyResults: KeyResult[]): Promise<void> {
    if (!supabase || keyResults.length === 0) return;

    const rows = keyResults.map(kr => mapKRToDb(kr, okrId, userId));
    const { error } = await supabase
      .from('key_results')
      .upsert(rows, { onConflict: 'id' });

    if (error) throw normalizeApiError(error);
  }

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
    const rows = (data || []) as OKRRow[];
    const krMap = await this.fetchKRsForOkrs(rows);
    return rows.map(row => this.mapFromDb(row, krMap.get(row.id) ?? []));
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

    const rows = (data || []) as OKRRow[];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = items[items.length - 1];
    const krMap = await this.fetchKRsForOkrs(items);

    return {
      data: items.map(row => this.mapFromDb(row, krMap.get(row.id) ?? [])),
      hasMore,
      nextCursor: hasMore && lastItem ? lastItem.id : null,
      nextCursorDate: hasMore && lastItem ? lastItem.created_at ?? null : null,
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
    if (!data) return null;

    const row = data as OKRRow;
    const krMap = await this.fetchKRsForOkrs([row]);
    return this.mapFromDb(row, krMap.get(row.id) ?? []);
  }

  async getByCategory(category: string): Promise<OKR[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('okrs')
      .select('*')
      .eq('category', category)
      .order('created_at', { ascending: false });

    if (error) throw normalizeApiError(error);
    const rows = (data || []) as OKRRow[];
    const krMap = await this.fetchKRsForOkrs(rows);
    return rows.map(row => this.mapFromDb(row, krMap.get(row.id) ?? []));
  }

  async getFiltered(filters: OKRFilters): Promise<OKR[]> {
    if (!supabase) throw new Error('Supabase not configured');
    let query = supabase.from('okrs').select('*');

    if (filters.category) query = query.eq('category', filters.category);
    if (filters.completed !== undefined) query = query.eq('completed', filters.completed);
    if (filters.startAfter) query = query.gte('start_date', filters.startAfter);
    if (filters.endBefore) query = query.lte('end_date', filters.endBefore);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw normalizeApiError(error);

    const rows = (data || []) as OKRRow[];
    const krMap = await this.fetchKRsForOkrs(rows);
    return rows.map(row => this.mapFromDb(row, krMap.get(row.id) ?? []));
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateOKRInput): Promise<OKR> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const dbInput = { ...this.mapToDb(input), user_id: user.id };

    const { data, error } = await supabase
      .from('okrs')
      .insert([dbInput])
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    const row = data as OKRRow;

    // Sync KRs to dedicated table
    if (input.keyResults?.length) {
      await this.syncKRsToTable(row.id, user.id, input.keyResults);

      // Journal append-only : enregistre toute KR créée déjà complétée
      for (const kr of input.keyResults) {
        if (kr.completed) {
          await this.recordKRCompletion(row.id, kr, row.title);
        }
      }
    }

    return this.mapFromDb(row, input.keyResults ?? []);
  }

  async update(id: string, updates: UpdateOKRInput): Promise<OKR> {
    if (!supabase) throw new Error('Supabase not configured');

    // ── Snapshot AVANT update : pour détecter les transitions de KR ──
    let previousKRsById = new Map<string, KeyResult>();
    if (updates.keyResults) {
      const previous = await this.getById(id);
      if (previous) {
        previousKRsById = new Map(previous.keyResults.map(kr => [kr.id, kr]));
      }
    }

    const dbUpdates = this.mapToDb(updates);

    const { data, error } = await supabase
      .from('okrs')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    const row = data as OKRRow;

    // If keyResults were updated, sync to dedicated table
    if (updates.keyResults) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await this.syncKRsToTable(id, user.id, updates.keyResults);
      }

      // Journal append-only : enregistre les transitions completed false→true
      for (const kr of updates.keyResults) {
        const previous = previousKRsById.get(kr.id);
        const wasCompleted = previous?.completed ?? false;
        if (kr.completed && !wasCompleted) {
          await this.recordKRCompletion(id, kr, row.title);
        }
      }
    }

    const krMap = await this.fetchKRsForOkrs([row]);
    return this.mapFromDb(row, krMap.get(row.id) ?? []);
  }

  async delete(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    // key_results rows deleted by CASCADE
    const { error } = await supabase.from('okrs').delete().eq('id', id);
    if (error) throw normalizeApiError(error);
  }

  // ═══════════════════════════════════════════════════════════════════
  // KEY RESULT OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async updateKeyResult(okrId: string, keyResultId: string, updates: UpdateKeyResultInput): Promise<OKR> {
    if (!supabase) throw new Error('Supabase not configured');

    // KR avec ancien id non-UUID (héritage avant fix `${Date.now()}-${i}`) :
    // on ne peut pas requêter la table key_results avec ça → fallback JSONB
    // qui régénère un UUID et resynchronise.
    if (!isUuid(keyResultId)) {
      return this.updateKeyResultViaJsonb(okrId, keyResultId, updates);
    }

    // ── Snapshot AVANT update : pour détecter les transitions completed false→true ──
    // Si le KR n'existe pas encore dans la table dédiée (cas d'OKR créés
    // avant la table, JSONB-only), on bascule directement sur le fallback
    // JSONB — sinon l'UPDATE ne touche rien (0 row, pas d'erreur), le SELECT
    // suivant retourne [], et la JSONB serait écrasée avec un tableau vide.
    let wasPreviouslyCompleted = false;
    {
      const { data: existing } = await supabase
        .from('key_results')
        .select('*')
        .eq('id', keyResultId)
        .eq('okr_id', okrId)
        .maybeSingle();

      if (!existing) {
        return this.updateKeyResultViaJsonb(okrId, keyResultId, updates);
      }

      wasPreviouslyCompleted = mapKRFromDb(existing as KRRow).completed;
    }

    // Build DB update object (only updatable fields)
    const krDbUpdates: Partial<{
      title: string;
      unit: string;
      current_value: number;
      target_value: number;
      estimated_time: number;
      completed: boolean;
    }> = {};
    if (updates.title !== undefined) krDbUpdates.title = updates.title;
    if (updates.unit !== undefined) krDbUpdates.unit = updates.unit;
    if (updates.currentValue !== undefined) krDbUpdates.current_value = updates.currentValue;
    if (updates.targetValue !== undefined) krDbUpdates.target_value = updates.targetValue;
    if (updates.estimatedTime !== undefined) krDbUpdates.estimated_time = updates.estimatedTime;
    if (updates.completed !== undefined) krDbUpdates.completed = updates.completed;

    // Update in key_results table (trigger sets completed_at automatically)
    const { error: krError } = await supabase
      .from('key_results')
      .update(krDbUpdates)
      .eq('id', keyResultId)
      .eq('okr_id', okrId);

    if (krError) {
      // KR not yet in table — fallback to JSONB path
      return this.updateKeyResultViaJsonb(okrId, keyResultId, updates);
    }

    // Fetch fresh KRs to recalculate progress
    const { data: krData, error: fetchError } = await supabase
      .from('key_results')
      .select('*')
      .eq('okr_id', okrId);

    if (fetchError) throw normalizeApiError(fetchError);

    const keyResults = ((krData ?? []) as KRRow[]).map(mapKRFromDb);
    const { progress, completed } = recalcProgress(keyResults);

    // Update OKR progress + JSONB for backward compat
    const { data, error } = await supabase
      .from('okrs')
      .update({ progress, completed, key_results: keyResults })
      .eq('id', okrId)
      .select()
      .single();

    if (error) throw normalizeApiError(error);

    // ── Append-only journal : enregistre une complétion à chaque transition false→true ──
    const updatedKr = keyResults.find(kr => kr.id === keyResultId);
    if (updatedKr && updatedKr.completed && !wasPreviouslyCompleted) {
      await this.recordKRCompletion(okrId, updatedKr, (data as OKRRow).title);
    }

    return this.mapFromDb(data as OKRRow, keyResults);
  }

  /**
   * Append-only : enregistre la complétion d'un KR dans kr_completions.
   * N'échoue jamais silencieusement — les erreurs sont propagées pour visibilité.
   */
  private async recordKRCompletion(okrId: string, kr: KeyResult, okrTitle: string): Promise<void> {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('kr_completions')
      .insert([{
        user_id: user.id,
        kr_id: kr.id,
        okr_id: okrId,
        completed_at: kr.completedAt ?? new Date().toISOString(),
        kr_title: kr.title,
        okr_title: okrTitle,
      }]);

    if (error) throw normalizeApiError(error);
  }

  // Fallback: update KR in JSONB when it's not yet in key_results table
  // Régénère aussi les ids non-UUID en UUID pour qu'ils deviennent compatibles
  // avec la table dédiée key_results lors du prochain sync.
  private async updateKeyResultViaJsonb(okrId: string, keyResultId: string, updates: UpdateKeyResultInput): Promise<OKR> {
    if (!supabase) throw new Error('Supabase not configured');

    const okr = await this.getById(okrId);
    if (!okr) throw new Error(`OKR with id ${okrId} not found`);

    const krIndex = okr.keyResults.findIndex(kr => kr.id === keyResultId);
    if (krIndex === -1) throw new Error(`KeyResult with id ${keyResultId} not found`);

    const wasPreviouslyCompleted = okr.keyResults[krIndex].completed;

    // Migration silencieuse : remplace tous les ids non-UUID par des UUID propres
    okr.keyResults = okr.keyResults.map(kr =>
      isUuid(kr.id) ? kr : { ...kr, id: crypto.randomUUID() }
    );
    // Le krIndex ne change pas (même position dans le tableau)
    okr.keyResults[krIndex] = { ...okr.keyResults[krIndex], ...updates };
    if (updates.completed) okr.keyResults[krIndex].completedAt = new Date().toISOString();
    if (updates.completed === false) okr.keyResults[krIndex].completedAt = null;

    const { progress, completed } = recalcProgress(okr.keyResults);

    // Sync to key_results table for future reads (ids sont maintenant tous des UUID)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await this.syncKRsToTable(okrId, user.id, okr.keyResults);

    const { data, error } = await supabase
      .from('okrs')
      .update({ key_results: okr.keyResults, progress, completed })
      .eq('id', okrId)
      .select()
      .single();

    if (error) throw normalizeApiError(error);

    // ── Append-only journal (chemin JSONB aussi) ──
    const updatedKr = okr.keyResults[krIndex];
    if (updatedKr.completed && !wasPreviouslyCompleted) {
      await this.recordKRCompletion(okrId, updatedKr, (data as OKRRow).title);
    }

    return this.mapFromDb(data as OKRRow, okr.keyResults);
  }
}
