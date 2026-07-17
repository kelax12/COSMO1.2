import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseEventsRepository } from './supabase.repository';
import type { UpdateEventInput } from './types';

const repo = new SupabaseEventsRepository();

const row = {
  id: 'e1', title: 'Réunion',
  start_time: '2026-06-10T10:00:00.000Z', end_time: '2026-06-10T11:00:00.000Z',
  color: '#3B82F6', user_id: 'u1',
};

const VALID_UUID = '22222222-2222-4222-8222-222222222222';
const VALID_ISO = '2026-01-01T00:00:00.000Z';

beforeEach(() => supabaseMock.reset());

describe('SupabaseEventsRepository', () => {
  it('getAll: paginates via range ordered by start_time + id tiebreak', async () => {
    supabaseMock.queueTable('events', { data: [row] });
    const result = await repo.getAll();

    const orders = supabaseMock.callsFor('events').filter((c) => c.method === 'order');
    expect(orders.map((c) => c.args)).toEqual([
      ['start_time', { ascending: true }],
      ['id', { ascending: true }],
    ]);
    expect(supabaseMock.argsOf('events', 'range')).toEqual([0, 999]);
    expect(result[0].id).toBe('e1');
  });

  it('getPage with FORGED cursor: rejects before any .or() reaches PostgREST (N6/H-1)', async () => {
    supabaseMock.queueTable('events', { data: [] });
    await expect(
      repo.getPage({ cursor: "1') OR ('1'='1", cursorDate: VALID_ISO }),
    ).rejects.toBeTruthy();
    expect(supabaseMock.argsOf('events', 'or')).toBeUndefined();
  });

  it('getPage with valid cursor: emits the keyset .or() filter', async () => {
    supabaseMock.queueTable('events', { data: [] });
    await repo.getPage({ cursor: VALID_UUID, cursorDate: VALID_ISO });
    const orArg = supabaseMock.argsOf('events', 'or')?.[0] as string;
    expect(orArg).toBe(
      `start_time.lt.${VALID_ISO},and(start_time.eq.${VALID_ISO},id.lt.${VALID_UUID})`
    );
  });

  it('getFiltered: maps each filter to the right column/operator', async () => {
    supabaseMock.queueTable('events', { data: [] });
    await repo.getFiltered({
      taskId: 't1', startAfter: 'A', startBefore: 'B', endAfter: 'C', endBefore: 'D',
    });
    const calls = supabaseMock.callsFor('events');
    const eqArgs = calls.filter((c) => c.method === 'eq').map((c) => c.args);
    // Lecture personnelle : filtre user_id = self (mig. 077) + task_id du filtre.
    expect(eqArgs).toContainEqual(['user_id', supabaseMock.user?.id]);
    expect(eqArgs).toContainEqual(['task_id', 't1']);
    expect(calls.filter((c) => c.method === 'gte').map((c) => c.args)).toEqual([
      ['start_time', 'A'], ['end_time', 'C'],
    ]);
    expect(calls.filter((c) => c.method === 'lte').map((c) => c.args)).toEqual([
      ['start_time', 'B'], ['end_time', 'D'],
    ]);
  });

  it('create: user_id injected from auth, rejects unauthenticated', async () => {
    supabaseMock.queueTable('events', { data: row });
    await repo.create({ title: 'X', start: row.start_time, end: row.end_time });
    const inserted = (supabaseMock.argsOf('events', 'insert')?.[0] as Record<string, unknown>[])[0];
    expect(inserted.user_id).toBe(supabaseMock.user?.id);

    supabaseMock.reset();
    supabaseMock.user = null;
    await expect(repo.create({ title: 'X', start: 'a', end: 'b' })).rejects.toThrow('Not authenticated');
  });

  it('update: mapEventToDb whitelist drops forged user_id (anti-mass-assignment V1)', async () => {
    supabaseMock.queueTable('events', { data: row });
    const forged = { title: 'New', user_id: 'attacker' } as unknown as UpdateEventInput;
    await repo.update('e1', forged);

    const payload = supabaseMock.argsOf('events', 'update')?.[0] as Record<string, unknown>;
    expect(payload.user_id).toBeUndefined();
    expect(payload.title).toBe('New');
    expect(supabaseMock.argsOf('events', 'eq')).toEqual(['id', 'e1']);
  });

  it('getById: PGRST116 → null, other errors → normalized throw', async () => {
    supabaseMock.queueTable('events', { data: null, error: { code: 'PGRST116' } });
    expect(await repo.getById('missing')).toBeNull();

    supabaseMock.queueTable('events', { data: null, error: { code: '42501', message: 'denied' } });
    await expect(repo.getById('e1')).rejects.toBeTruthy();
  });
});
