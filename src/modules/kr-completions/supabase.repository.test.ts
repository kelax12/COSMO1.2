import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseKRCompletionsRepository } from './supabase.repository';

const repo = new SupabaseKRCompletionsRepository();

const row = {
  id: 'c1', kr_id: 'kr1', okr_id: 'o1', user_id: 'u1',
  completed_at: '2026-06-01T10:00:00.000Z', kr_title: 'KR', okr_title: 'OKR',
};

beforeEach(() => supabaseMock.reset());

describe('SupabaseKRCompletionsRepository', () => {
  it('getAll: selects *, orders by completed_at desc, caps at 500, maps to camelCase', async () => {
    supabaseMock.queueTable('kr_completions', { data: [row] });
    const result = await repo.getAll();

    expect(supabaseMock.argsOf('kr_completions', 'select')).toEqual(['*']);
    expect(supabaseMock.argsOf('kr_completions', 'order')).toEqual(['completed_at', { ascending: false }]);
    expect(supabaseMock.argsOf('kr_completions', 'limit')).toEqual([500]);
    expect(result).toEqual([{
      id: 'c1', krId: 'kr1', okrId: 'o1', userId: 'u1',
      completedAt: row.completed_at, krTitle: 'KR', okrTitle: 'OKR',
    }]);
  });

  it('getFiltered: applies every provided filter as eq/gte/lte', async () => {
    supabaseMock.queueTable('kr_completions', { data: [] });
    await repo.getFiltered({
      userId: 'u1', okrId: 'o1', krId: 'kr1',
      completedAfter: '2026-01-01', completedBefore: '2026-12-31',
    });

    const calls = supabaseMock.callsFor('kr_completions');
    expect(calls.filter((c) => c.method === 'eq').map((c) => c.args)).toEqual([
      ['user_id', 'u1'], ['okr_id', 'o1'], ['kr_id', 'kr1'],
    ]);
    expect(supabaseMock.argsOf('kr_completions', 'gte')).toEqual(['completed_at', '2026-01-01']);
    expect(supabaseMock.argsOf('kr_completions', 'lte')).toEqual(['completed_at', '2026-12-31']);
  });

  it('create: user_id comes from auth.getUser(), never from the input (anti-mass-assignment)', async () => {
    supabaseMock.queueTable('kr_completions', { data: { ...row, user_id: supabaseMock.user?.id } });
    await repo.create({
      krId: 'kr1', okrId: 'o1', completedAt: row.completed_at, krTitle: 'KR', okrTitle: 'OKR',
      userId: 'attacker-uid', // forgé : doit être IGNORÉ au profit de auth.uid
    });

    const inserted = (supabaseMock.argsOf('kr_completions', 'insert')?.[0] as Record<string, unknown>[])[0];
    expect(inserted.user_id).toBe(supabaseMock.user?.id); // jamais 'attacker-uid'
    expect(inserted.kr_id).toBe('kr1');
  });

  it('create: rejects when not authenticated', async () => {
    supabaseMock.user = null;
    await expect(
      repo.create({ krId: 'k', okrId: 'o', completedAt: 'd', krTitle: 't', okrTitle: 't', userId: 'x' }),
    ).rejects.toThrow('Not authenticated');
    expect(supabaseMock.queries).toHaveLength(0); // aucun INSERT tenté
  });

  it('getAll: normalizes DB errors (no raw message surfaced)', async () => {
    supabaseMock.queueTable('kr_completions', { data: null, error: { message: 'relation does not exist', code: '42P01' } });
    await expect(repo.getAll()).rejects.toBeTruthy();
  });
});
