import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseOKRsRepository } from './supabase.repository';
import type { KeyResult } from './types';

const repo = new SupabaseOKRsRepository();
const ME = () => supabaseMock.user?.id;

const KR_UUID = '33333333-3333-4333-8333-333333333333';
const VALID_ISO = '2026-01-01T00:00:00.000Z';

const krRow = {
  id: KR_UUID, okr_id: 'okr1', user_id: 'u1', title: 'Lire 10 livres',
  unit: 'livres', current_value: 5, target_value: 10,
  estimated_time: 60, completed: false, completed_at: null,
};

const okrRow = {
  id: 'okr1', title: 'Culture', description: '', category: 'perso',
  progress: 50, completed: false, key_results: [],
  start_date: '2026-01-01', end_date: '2026-12-31',
};

const jsonbKR: KeyResult = {
  id: KR_UUID, title: 'KR JSONB', unit: 'x', currentValue: 1, targetValue: 2,
  estimatedTime: 0, completed: false, completedAt: null,
};

beforeEach(() => supabaseMock.reset());

describe('SupabaseOKRsRepository — lecture', () => {
  it('getAll: batches KRs via .in(okr_id) and falls back to JSONB when the table is empty', async () => {
    supabaseMock.queueTable('okrs', { data: [{ ...okrRow, key_results: [jsonbKR] }] });
    supabaseMock.queueTable('key_results', { data: [] }); // table vide → fallback

    const result = await repo.getAll();

    expect(supabaseMock.argsOf('key_results', 'in')).toEqual(['okr_id', ['okr1']]);
    expect(result[0].keyResults).toEqual([jsonbKR]); // JSONB préservé
  });

  it('getAll: prefers the dedicated table over JSONB and coerces numerics', async () => {
    supabaseMock.queueTable('okrs', { data: [{ ...okrRow, key_results: [jsonbKR] }] });
    supabaseMock.queueTable('key_results', { data: [{ ...krRow, current_value: '5' }] });

    const result = await repo.getAll();
    expect(result[0].keyResults[0].currentValue).toBe(5); // Number(), pas '5'
    expect(result[0].keyResults[0].title).toBe('Lire 10 livres');
  });

  it('getPage: FORGED cursor rejected before any .or() (N6 injection guard)', async () => {
    supabaseMock.queueTable('okrs', { data: [] });
    await expect(
      repo.getPage({ cursor: 'aaa","bbb")', cursorDate: VALID_ISO }),
    ).rejects.toThrow('Invalid pagination cursor');
    expect(supabaseMock.argsOf('okrs', 'or')).toBeUndefined();
  });
});

describe('SupabaseOKRsRepository — syncKRsToTable (M-1)', () => {
  it('create: rejects a non-UUID KR id before it reaches the not.in() filter', async () => {
    supabaseMock.queueTable('okrs', { data: okrRow });        // INSERT okr
    supabaseMock.queueTable('key_results', { data: null });   // upsert OK

    await expect(
      repo.create({
        title: 'X', description: '', category: 'c',
        startDate: '2026-01-01', endDate: '2026-12-31',
        keyResults: [{ ...jsonbKR, id: 'aaa","bbb")', currentValue: 0 }],
      } as never),
    ).rejects.toThrow('Invalid key result id');

    // upsert a eu lieu (1 requête key_results), mais JAMAIS le delete not.in
    const krQueries = supabaseMock.queries.filter((q) => q.table === 'key_results');
    expect(krQueries).toHaveLength(1);
    expect(krQueries[0].calls.some((c) => c.method === 'not')).toBe(false);
  });

  it('create: ne journalise PAS la valeur initiale du KR (état de base, pas des reps du jour)', async () => {
    supabaseMock.queueTable('okrs', { data: okrRow });
    supabaseMock.queueTable('key_results', { data: null }); // upsert
    supabaseMock.queueTable('key_results', { data: null }); // delete not.in

    await repo.create({
      title: 'X', description: '', category: 'c',
      startDate: '2026-01-01', endDate: '2026-12-31',
      keyResults: [{ ...jsonbKR, currentValue: 3 }],
    } as never);

    // Créer un KR à 3/N ne doit insérer AUCUNE ligne kr_completions — sinon le
    // dashboard afficherait « 3 KR réalisés aujourd'hui » à la création.
    expect(supabaseMock.argsOf('kr_completions', 'insert')).toBeUndefined();
  });
});

describe('SupabaseOKRsRepository — updateKeyResult & journal append-only', () => {
  function queueUpdateKRSequence(freshCurrentValue: number) {
    supabaseMock.queueTable('key_results', { data: krRow });          // snapshot maybeSingle (current 5)
    supabaseMock.queueTable('key_results', { data: null });           // UPDATE kr
    supabaseMock.queueTable('key_results', {                          // re-fetch frais
      data: [{ ...krRow, current_value: freshCurrentValue }],
    });
    supabaseMock.queueTable('okrs', { data: okrRow });                // UPDATE okrs progress
  }

  it('delta positif: inserts exactly delta rows in kr_completions (1 ligne = 1 rep)', async () => {
    queueUpdateKRSequence(7); // 5 → 7 = +2
    supabaseMock.queueTable('kr_completions', { data: null });

    await repo.updateKeyResult('okr1', KR_UUID, { currentValue: 7 });

    const rows = supabaseMock.argsOf('kr_completions', 'insert')?.[0] as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kr_id: KR_UUID, okr_id: 'okr1', user_id: ME() });
  });

  it('B18: clamps the journal write at 100 rows even for a huge delta', async () => {
    queueUpdateKRSequence(100_000); // delta 99 995 → clamp 100
    supabaseMock.queueTable('kr_completions', { data: null });

    await repo.updateKeyResult('okr1', KR_UUID, { currentValue: 100_000 });

    const rows = supabaseMock.argsOf('kr_completions', 'insert')?.[0] as Record<string, unknown>[];
    expect(rows).toHaveLength(100);
  });

  it('delta négatif: removes the most recent reps instead of inserting', async () => {
    queueUpdateKRSequence(3); // 5 → 3 = -2
    supabaseMock.queueTable('kr_completions', { data: [{ id: 'c1' }, { id: 'c2' }] }); // select récents
    supabaseMock.queueTable('kr_completions', { data: null });                          // delete

    await repo.updateKeyResult('okr1', KR_UUID, { currentValue: 3 });

    expect(supabaseMock.argsOf('kr_completions', 'order')).toEqual(['completed_at', { ascending: false }]);
    expect(supabaseMock.argsOf('kr_completions', 'limit')).toEqual([2]);
    expect(supabaseMock.argsOf('kr_completions', 'in', 1)).toEqual(['id', ['c1', 'c2']]);
  });

  it('non-UUID KR id routes to the JSONB fallback path (legacy ids)', async () => {
    // Le fallback commence par getById(okrId) → on renvoie "introuvable"
    supabaseMock.queueTable('okrs', { data: null, error: { code: 'PGRST116' } });
    await expect(
      repo.updateKeyResult('okr1', 'legacy-123', { currentValue: 1 }),
    ).rejects.toThrow('OKR with id okr1 not found');
    // Preuve du routage : aucune requête key_results directe (chemin table UUID)
    expect(supabaseMock.queries[0].table).toBe('okrs');
  });
});
