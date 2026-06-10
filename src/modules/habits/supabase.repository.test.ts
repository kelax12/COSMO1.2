import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseHabitsRepository } from './supabase.repository';

const repo = new SupabaseHabitsRepository();

const row = {
  id: 'h1', name: 'Lire', description: 'desc', frequency: 'daily',
  estimated_time: 30, color: 'blue', icon: 'book', completions: {},
  created_at: '2026-06-01T00:00:00.000Z', user_id: 'u1',
};

const VALID_UUID = '22222222-2222-4222-8222-222222222222';
const VALID_ISO = '2026-01-01T00:00:00.000Z';

beforeEach(() => supabaseMock.reset());

describe('SupabaseHabitsRepository', () => {
  it('fetchHabits: paginates via range with stable id tiebreak ordering', async () => {
    supabaseMock.queueTable('habits', { data: [row] });
    const result = await repo.fetchHabits();

    const orders = supabaseMock.callsFor('habits').filter((c) => c.method === 'order');
    expect(orders.map((c) => c.args)).toEqual([
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ]);
    expect(supabaseMock.argsOf('habits', 'range')).toEqual([0, 999]);
    expect(result[0].id).toBe('h1');
    expect(result[0].name).toBe('Lire');
  });

  it('getPage without cursor: never emits a .or() filter', async () => {
    supabaseMock.queueTable('habits', { data: [row] });
    await repo.getPage({ limit: 10 });
    expect(supabaseMock.argsOf('habits', 'or')).toBeUndefined();
    expect(supabaseMock.argsOf('habits', 'limit')).toEqual([11]); // +1 pour hasMore
  });

  it('getPage with VALID cursor: interpolates only after assertValidCursor passes', async () => {
    supabaseMock.queueTable('habits', { data: [] });
    await repo.getPage({ cursor: VALID_UUID, cursorDate: VALID_ISO });
    const orArg = supabaseMock.argsOf('habits', 'or')?.[0] as string;
    expect(orArg).toContain(VALID_ISO);
    expect(orArg).toContain(VALID_UUID);
  });

  it('getPage with FORGED cursor: rejects (N6/H-1 injection guard) and sends no .or()', async () => {
    supabaseMock.queueTable('habits', { data: [] });
    await expect(
      repo.getPage({ cursor: 'x,id.gt.0', cursorDate: VALID_ISO }),
    ).rejects.toBeTruthy();
    expect(supabaseMock.argsOf('habits', 'or')).toBeUndefined();
  });

  it('createHabit: user_id injected from auth session, not from input', async () => {
    supabaseMock.queueTable('habits', { data: row });
    await repo.createHabit({
      name: 'Lire', frequency: 'daily', estimatedTime: 30, color: 'blue', icon: 'book',
    });
    const inserted = (supabaseMock.argsOf('habits', 'insert')?.[0] as Record<string, unknown>[])[0];
    expect(inserted.user_id).toBe(supabaseMock.user?.id);
  });

  it('createHabit: rejects when not authenticated', async () => {
    supabaseMock.user = null;
    await expect(
      repo.createHabit({ name: 'X', frequency: 'daily', estimatedTime: 0, color: 'c', icon: 'i' }),
    ).rejects.toThrow('Not authenticated');
  });

  it('getById: PGRST116 → null', async () => {
    supabaseMock.queueTable('habits', { data: null, error: { code: 'PGRST116' } });
    expect(await repo.getById('missing')).toBeNull();
  });

  it('toggleCompletion: goes through the atomic RPC (TOCTOU-1), not a read-then-write', async () => {
    supabaseMock.queueRpc('toggle_habit_completion', { data: { ...row, completions: { '2026-06-10': true } } });
    const result = await repo.toggleCompletion('h1', '2026-06-10');

    expect(supabaseMock.rpcCalls).toEqual([
      { fn: 'toggle_habit_completion', args: { p_habit_id: 'h1', p_date: '2026-06-10' } },
    ]);
    expect(supabaseMock.queries).toHaveLength(0); // zéro SELECT/UPDATE direct
    expect(result.completions['2026-06-10']).toBe(true);
  });

  it('deleteHabit: surfaces normalized error on failure', async () => {
    supabaseMock.queueTable('habits', { data: null, error: { message: 'permission denied', code: '42501' } });
    await expect(repo.deleteHabit('h1')).rejects.toBeTruthy();
  });
});
