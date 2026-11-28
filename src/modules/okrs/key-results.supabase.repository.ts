// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - Lecture et synchronisation de la table key_results
// (extrait de supabase.repository.ts : déplacement pur, aucun changement)
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError, makeApiError } from '@/lib/normalizeApiError';
import { warnIfTruncated } from '@/lib/pagination.warning';
import { fetchAllPages, MAX_ROWS } from '@/lib/fetch-all-pages';
import type { KeyResult } from './types';
import { OKRRow, KRRow, mapKRFromDb, mapKRToDb } from './mappers';
import { fromJson } from '@/lib/db-contract';

// ─── Fetch KRs from dedicated table, fallback to JSONB ──────────────────

export async function fetchKRsForOkrs(okrRows: OKRRow[]): Promise<Map<string, KeyResult[]>> {
  if (!supabase || okrRows.length === 0) return new Map();

  const db = supabase;
  const okrIds = okrRows.map(r => r.id);
  // PER-01 : par pages `.range`. Sans elles, PostgREST plafonne en silence à
  // son `max-rows` (1 000) et des KR disparaissaient sans erreur ; le plafond
  // `MAX_ROWS` est signalé par `warnIfTruncated`. Une erreur garde le repli.
  let data: KRRow[] | null;
  try {
    const raw = await fetchAllPages(async (from, to) => {
      const { data: page, error } = await db
        .from('key_results')
        .select('*')
        .in('okr_id', okrIds)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to);
      if (error) throw error;
      return (page || []) as KRRow[];
    });
    data = warnIfTruncated(raw, MAX_ROWS, 'key_results');
  } catch {
    data = null;
  }

  const krMap = new Map<string, KeyResult[]>();

  if (!data || data.length === 0) {
    // Fallback: use JSONB data from okrs table
    for (const row of okrRows) {
      krMap.set(row.id, fromJson<KeyResult[] | null>(row.key_results) || []);
    }
    return krMap;
  }

  for (const kr of data as KRRow[]) {
    const list = krMap.get(kr.okr_id) ?? [];
    list.push(mapKRFromDb(kr));
    krMap.set(kr.okr_id, list);
  }

  // For OKRs with no rows in key_results table, fallback to JSONB.
  // KR créés ensemble partagent `created_at` : le départage par `id` (uuid)
  // est aléatoire, l'ordre saisi est celui du JSONB `okrs.key_results`.
  for (const row of okrRows) {
    const list = krMap.get(row.id);
    const jsonbKRs = fromJson<KeyResult[] | null>(row.key_results);
    if (list && jsonbKRs?.length) {
      const pos = new Map(jsonbKRs.map((k, i) => [k.id, i]));
      list.sort((x, y) => (pos.get(x.id) ?? Infinity) - (pos.get(y.id) ?? Infinity));
    }
    if (!krMap.has(row.id)) {
      krMap.set(row.id, fromJson<KeyResult[] | null>(row.key_results) || []);
    }
  }

  return krMap;
}

// ─── Sync KRs to dedicated table (upsert) ───────────────────────────────

export async function syncKRsToTable(okrId: string, userId: string, keyResults: KeyResult[]): Promise<void> {
  if (!supabase) return;

  // Faille B6 — `upsert` alone never DELETEs KRs removed client-side; the
  // orphaned rows then reappear on the next read via `fetchKRsForOkrs`.
  // Mirror the canonical state: (1) upsert the new/updated rows, then
  // (2) delete any rows in `key_results` whose id is no longer present.
  if (keyResults.length > 0) {
    const rows = keyResults.map(kr => mapKRToDb(kr, okrId, userId));
    const { error: upsertError } = await supabase
      .from('key_results')
      .upsert(rows, { onConflict: 'id' });
    if (upsertError) throw normalizeApiError(upsertError);

    // M-1 — Validate every KR id is a UUID before interpolating into the
    // PostgREST `not.in.(...)` filter. A crafted id like `aaa","bbb")` would
    // break the closing paren and either neutralize the filter (orphans
    // never deleted) or tautologize it (data loss). RLS scopes us to our
    // own rows so impact is auto-DoS, but the contract is "never inline
    // client-controlled strings into PostgREST filters".
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const keepIds = keyResults.map(kr => kr.id);
    if (keepIds.some(id => !UUID_RE.test(id))) {
      throw makeApiError('invalid_input');
    }
    const { error: deleteError } = await supabase
      .from('key_results')
      .delete()
      .eq('okr_id', okrId)
      .eq('user_id', userId)
      .not('id', 'in', `(${keepIds.map(id => `"${id}"`).join(',')})`);
    if (deleteError) throw normalizeApiError(deleteError);
  } else {
    // All KRs removed → drop every row for this OKR.
    const { error } = await supabase
      .from('key_results')
      .delete()
      .eq('okr_id', okrId)
      .eq('user_id', userId);
    if (error) throw normalizeApiError(error);
  }
}
