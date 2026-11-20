// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - Journal append-only kr_completions (écriture Supabase)
// (extrait de supabase.repository.ts : déplacement pur, aucun changement)
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth-user';
import { normalizeApiError, makeApiError } from '@/lib/normalizeApiError';
import { MAX_REPS_PER_WRITE } from '@/modules/kr-completions/constants';
import type { KRCompletion } from '@/modules/kr-completions/types';
import type { KeyResult } from './types';

/**
 * Append-only : enregistre `count` reps réalisées pour ce KR dans
 * kr_completions. 1 ligne = 1 rep ; toutes timestampées à l'instant
 * de l'update (pas de notion d'historique fin-grained par rep).
 * Les erreurs sont propagées pour visibilité.
 */
export async function recordKRReps(okrId: string, kr: KeyResult, okrTitle: string, count: number): Promise<void> {
  if (!supabase || count <= 0) return;
  // Clamp the row count: a client setting currentValue to e.g. 100_000 would
  // otherwise insert 100k rows in one call (storage abuse + dashboard
  // overcount). Faille B18. La borne est PARTAGEE avec le repository
  // localStorage (`@/modules/kr-completions/constants`) : elle avait diverge,
  // seul ce chemin-ci clampait (audit A-2).
  const safeCount = Math.min(count, MAX_REPS_PER_WRITE);
  const user = await getCurrentUser();
  if (!user) {
    console.warn('recordKRReps: no auth user; KR journal entry skipped');
    return;
  }

  const completedAt = new Date().toISOString();
  const rows = Array.from({ length: safeCount }, () => ({
    user_id: user.id,
    kr_id: kr.id,
    okr_id: okrId,
    completed_at: completedAt,
    kr_title: kr.title,
    okr_title: okrTitle,
  }));

  const { error } = await supabase.from('kr_completions').insert(rows);
  if (error) throw normalizeApiError(error);
}

/**
 * C-01 — rejoue le journal d'un OKR restauré. Contrat et raison dans
 * `IOKRsRepository.restoreCompletions`.
 *
 * ⚠️ Les horodatages d'ORIGINE sont conservés, contrairement à
 * `recordKRReps` qui timestampe à l'instant : c'est tout l'intérêt. Les
 * réécrire à `now()` remettrait les N points d'un coup sur aujourd'hui, ce
 * qui n'est pas restaurer un graphique mais en inventer un autre.
 *
 * ⚠️ `user_id` vient de la SESSION, jamais du tableau : restaurer ne doit
 * pas devenir un chemin pour écrire dans le journal de quelqu'un d'autre.
 * La RLS le vérifie de toute façon.
 */
export async function restoreCompletions(completions: KRCompletion[]): Promise<void> {
  if (!supabase || completions.length === 0) return;
  const user = await getCurrentUser();
  // C-62 — identifiant CATALOGUE, pas un littéral anglais. Les voisins de ce
  // fichier écrivent encore `throw makeApiError('not_authenticated')`, et c'est
  // exactement le tuyau que C-62 doit fermer : le message atterrit tel quel
  // dans le gabarit français `mutation.*`. Ne pas en ajouter un de plus par
  // \« parité \» avec un défaut.
  if (!user) throw makeApiError('not_authenticated');

  // Même borne que l'écriture normale (faille B18).
  const rows = completions.slice(0, MAX_REPS_PER_WRITE).map((c) => ({
    user_id: user.id,
    kr_id: c.krId,
    okr_id: c.okrId,
    completed_at: c.completedAt,
    kr_title: c.krTitle,
    okr_title: c.okrTitle,
  }));

  const { error } = await supabase.from('kr_completions').insert(rows);
  if (error) throw normalizeApiError(error);
}

/**
 * Symétrique de recordKRReps : retire les `count` reps les plus récentes
 * pour ce KR (ORDER BY completed_at DESC, LIMIT count). Appelé quand
 * currentValue diminue, pour que le graphique dashboard reflète bien
 * la décrémentation.
 */
export async function removeKRReps(krId: string, count: number): Promise<void> {
  if (!supabase || count <= 0) return;
  const safeCount = Math.min(count, MAX_REPS_PER_WRITE);
  const user = await getCurrentUser();
  if (!user) return;

  const { data: rows, error: selectErr } = await supabase
    .from('kr_completions')
    .select('id')
    .eq('user_id', user.id)
    .eq('kr_id', krId)
    .order('completed_at', { ascending: false })
    .limit(safeCount);
  if (selectErr) throw normalizeApiError(selectErr);
  if (!rows || rows.length === 0) return;

  const ids = rows.map((r: { id: string }) => r.id);
  const { error: deleteErr } = await supabase
    .from('kr_completions')
    .delete()
    .in('id', ids)
    .eq('user_id', user.id);
  if (deleteErr) throw normalizeApiError(deleteErr);
}
