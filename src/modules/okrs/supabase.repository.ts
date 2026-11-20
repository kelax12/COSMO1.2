// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - Supabase Repository Implementation
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth-user';
import { normalizeApiError, makeApiError } from '@/lib/normalizeApiError';
import { IOKRsRepository } from './repository';
import { OKR, CreateOKRInput, UpdateOKRInput, UpdateKeyResultInput, OKRFilters, KeyResult } from './types';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE } from '@/lib/pagination.types';
import { warnIfTruncated } from '@/lib/pagination.warning';
import { fetchKRsForOkrs, syncKRsToTable } from './key-results.supabase.repository';
import { recordKRReps, removeKRReps, restoreCompletions } from './kr-journal.supabase.repository';
import { fetchAllPages, MAX_ROWS } from '@/lib/fetch-all-pages';
// Source unique du calcul de progression OKR — fonction pure testable.
import { recalcProgress } from './progress';
import type { CreateOptions } from '@/lib/restore-id';
import {
  OKRRow,
  KRRow,
  mapKRFromDb,
  mapOkrFromDb,
  mapOkrToDb,
} from './mappers';
import type { KRCompletion } from '@/modules/kr-completions/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (id: string): boolean => UUID_REGEX.test(id);

// Row types + mappers (mapKRFromDb/mapKRToDb/mapOkrFromDb/mapOkrToDb) extraits
// dans ./mappers. recalcProgress = fonction pure dans ./progress.

export class SupabaseOKRsRepository implements IOKRsRepository {

  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async getAll(): Promise<OKR[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const db = supabase;
    // Auto-pagination : plus de troncature silencieuse au-delà de 500 items.
    const raw = await fetchAllPages(async (from, to) => {
      const { data, error } = await db
        .from('okrs')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);
      if (error) throw normalizeApiError(error);
      return (data || []) as OKRRow[];
    });

    const rows = warnIfTruncated(raw, MAX_ROWS, 'okrs');
    const krMap = await fetchKRsForOkrs(rows);
    return rows.map(row => mapOkrFromDb(row, krMap.get(row.id) ?? []));
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
      // Validate cursor params before template-interpolating them into the
      // PostgREST `.or()` filter — comma/paren/operator injection would let
      // a malicious caller (e.g. someone crafting a URL search param) bypass
      // the cursor cutoff or perturb the query. Faille N6.
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;
      if (!UUID_RE.test(params.cursor) || !ISO_RE.test(params.cursorDate)) {
        throw makeApiError('invalid_input');
      }
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
    const krMap = await fetchKRsForOkrs(items);

    return {
      data: items.map(row => mapOkrFromDb(row, krMap.get(row.id) ?? [])),
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
    const krMap = await fetchKRsForOkrs([row]);
    return mapOkrFromDb(row, krMap.get(row.id) ?? []);
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
    const krMap = await fetchKRsForOkrs(rows);
    return rows.map(row => mapOkrFromDb(row, krMap.get(row.id) ?? []));
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
    const krMap = await fetchKRsForOkrs(rows);
    return rows.map(row => mapOkrFromDb(row, krMap.get(row.id) ?? []));
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateOKRInput, options?: CreateOptions): Promise<OKR> {
    if (!supabase) throw new Error('Supabase not configured');
    const user = await getCurrentUser();
    if (!user) throw makeApiError('not_authenticated');

    // `options.restoreId` ne vient JAMAIS d'un payload de formulaire :
    // c'est un second argument, reserve aux « Annuler » (R-08). La
    // whitelist `mapToDb` et le `user_id` pose depuis la session sont
    // inchanges.
    const dbInput = {
      ...mapOkrToDb(input),
      user_id: user.id,
      ...(options?.restoreId ? { id: options.restoreId } : {}),
    };

    const { data, error } = await supabase
      .from('okrs')
      .insert([dbInput])
      .select()
      .single();

    if (error) throw normalizeApiError(error);
    const row = data as OKRRow;

    // Sync KRs to dedicated table
    if (input.keyResults?.length) {
      await syncKRsToTable(row.id, user.id, input.keyResults);

      // Journal append-only : on N'enregistre PAS la valeur initiale d'un KR à
      // la création. `currentValue` de départ = état de base (progression
      // antérieure au suivi dans l'app), pas des reps « réalisées aujourd'hui » —
      // sinon créer un KR à 32/100 gonfle le graphe dashboard de 32 ce jour-là.
      // Seuls les incréments ultérieurs (update/updateKeyResult) sont journalisés.
    }

    return mapOkrFromDb(row, input.keyResults ?? []);
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

    const dbUpdates = mapOkrToDb(updates);

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
      const user = await getCurrentUser();
      if (user) {
        await syncKRsToTable(id, user.id, updates.keyResults);
      }

      // Journal append-only : 1 ligne = 1 rep. Enregistre delta reps pour
      // chaque KR dont currentValue a augmenté (ex: 5 → 7 = +2 reps).
      for (const kr of updates.keyResults) {
        const previous = previousKRsById.get(kr.id);
        const previousValue = previous?.currentValue ?? 0;
        const delta = Math.round(kr.currentValue - previousValue);
        if (delta > 0) {
          await recordKRReps(id, kr, row.title, delta);
        } else if (delta < 0) {
          await removeKRReps(kr.id, -delta);
        }
      }
    }

    const krMap = await fetchKRsForOkrs([row]);
    return mapOkrFromDb(row, krMap.get(row.id) ?? []);
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

    // ── Snapshot AVANT update : pour calculer le delta de reps ──
    // Si le KR n'existe pas encore dans la table dédiée (cas d'OKR créés
    // avant la table, JSONB-only), on bascule directement sur le fallback
    // JSONB — sinon l'UPDATE ne touche rien (0 row, pas d'erreur), le SELECT
    // suivant retourne [], et la JSONB serait écrasée avec un tableau vide.
    let previousCurrentValue: number;
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

      previousCurrentValue = mapKRFromDb(existing as KRRow).currentValue;
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

    // ── Append-only journal : 1 ligne = 1 rep ──
    // Si currentValue a augmenté de N (ex: 5 → 7 → +2), insère N lignes.
    const updatedKr = keyResults.find(kr => kr.id === keyResultId);
    if (updatedKr) {
      const delta = Math.round(updatedKr.currentValue - previousCurrentValue);
      if (delta > 0) {
        await recordKRReps(okrId, updatedKr, (data as OKRRow).title, delta);
      } else if (delta < 0) {
        await removeKRReps(updatedKr.id, -delta);
      }
    }

    return mapOkrFromDb(data as OKRRow, keyResults);
  }

  /** C-01 : voir `kr-journal.supabase.repository.ts` (contrat dans `IOKRsRepository.restoreCompletions`). */
  async restoreCompletions(completions: KRCompletion[]): Promise<void> {
    return restoreCompletions(completions);
  }

  // Fallback: update KR in JSONB when it's not yet in key_results table
  // Régénère aussi les ids non-UUID en UUID pour qu'ils deviennent compatibles
  // avec la table dédiée key_results lors du prochain sync.
  private async updateKeyResultViaJsonb(okrId: string, keyResultId: string, updates: UpdateKeyResultInput): Promise<OKR> {
    if (!supabase) throw new Error('Supabase not configured');

    const okr = await this.getById(okrId);
    if (!okr) throw makeApiError('not_found');

    const krIndex = okr.keyResults.findIndex(kr => kr.id === keyResultId);
    if (krIndex === -1) throw makeApiError('not_found');

    const previousCurrentValue = okr.keyResults[krIndex].currentValue;

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
    const user = await getCurrentUser();
    if (user) await syncKRsToTable(okrId, user.id, okr.keyResults);

    const { data, error } = await supabase
      .from('okrs')
      .update({ key_results: okr.keyResults, progress, completed })
      .eq('id', okrId)
      .select()
      .single();

    if (error) throw normalizeApiError(error);

    // ── Journal : delta de reps (1 ligne = 1 rep), symétrique ± ──
    const updatedKr = okr.keyResults[krIndex];
    const delta = Math.round(updatedKr.currentValue - previousCurrentValue);
    if (delta > 0) {
      await recordKRReps(okrId, updatedKr, (data as OKRRow).title, delta);
    } else if (delta < 0) {
      await removeKRReps(updatedKr.id, -delta);
    }

    return mapOkrFromDb(data as OKRRow, okr.keyResults);
  }
}
