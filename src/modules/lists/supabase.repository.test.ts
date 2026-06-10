import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseListsRepository } from './supabase.repository';

const repo = new SupabaseListsRepository();

const row = {
  id: 'l1', name: 'Courses', color: 'blue', task_ids: ['t1'],
  user_id: 'u1', type: null, smart_rule: null, is_default: null, position: null,
};

beforeEach(() => supabaseMock.reset());

describe('SupabaseListsRepository', () => {
  it('getAll: orders by position (NULLS LAST) then name, caps at 200, applies row defaults', async () => {
    supabaseMock.queueTable('lists', { data: [row] });
    const result = await repo.getAll();

    const orders = supabaseMock.callsFor('lists').filter((c) => c.method === 'order');
    expect(orders.map((c) => c.args)).toEqual([
      ['position', { ascending: true, nullsFirst: false }],
      ['name', { ascending: true }],
    ]);
    expect(supabaseMock.argsOf('lists', 'limit')).toEqual([200]);
    // Défauts rétro-compat migration 021
    expect(result[0]).toMatchObject({ type: 'manual', isDefault: false, taskIds: ['t1'] });
    expect(result[0].position).toBeUndefined();
  });

  it('getById: defense-in-depth — scopes by id AND user_id (V15), null when logged out', async () => {
    supabaseMock.queueTable('lists', { data: row });
    await repo.getById('l1');
    const eqs = supabaseMock.callsFor('lists').filter((c) => c.method === 'eq');
    expect(eqs.map((c) => c.args)).toEqual([
      ['id', 'l1'],
      ['user_id', supabaseMock.user?.id],
    ]);

    supabaseMock.reset();
    supabaseMock.user = null;
    expect(await repo.getById('l1')).toBeNull();
    expect(supabaseMock.queries).toHaveLength(0); // aucune requête sans session
  });

  it('create: forces empty task_ids and auth-derived user_id (anti-mass-assignment)', async () => {
    supabaseMock.queueTable('lists', { data: row });
    await repo.create({ name: 'X', color: 'red', taskIds: ['evil'] } as never);

    const inserted = (supabaseMock.argsOf('lists', 'insert')?.[0] as Record<string, unknown>[])[0];
    expect(inserted.task_ids).toEqual([]); // toujours vide à la création
    expect(inserted.user_id).toBe(supabaseMock.user?.id);
  });

  it('update: whitelists fields, drops forged user_id, double-scopes id+user_id', async () => {
    supabaseMock.queueTable('lists', { data: row });
    await repo.update('l1', { name: 'Y', user_id: 'attacker' } as never);

    const payload = supabaseMock.argsOf('lists', 'update')?.[0] as Record<string, unknown>;
    expect(Object.keys(payload)).toEqual(['name']);
    const eqs = supabaseMock.callsFor('lists').filter((c) => c.method === 'eq');
    expect(eqs.map((c) => c.args)).toEqual([['id', 'l1'], ['user_id', supabaseMock.user?.id]]);
  });

  it('addTaskToList / removeTaskFromList: atomic RPCs only (TOCTOU-2), zero direct table access', async () => {
    supabaseMock.queueRpc('add_task_to_list', { data: { ...row, task_ids: ['t1', 't2'] } });
    const updated = await repo.addTaskToList('t2', 'l1');
    expect(updated.taskIds).toEqual(['t1', 't2']);

    supabaseMock.queueRpc('remove_task_from_list', { data: { ...row, task_ids: [] } });
    await repo.removeTaskFromList('t1', 'l1');

    expect(supabaseMock.rpcCalls).toEqual([
      { fn: 'add_task_to_list', args: { p_task_id: 't2', p_list_id: 'l1' } },
      { fn: 'remove_task_from_list', args: { p_task_id: 't1', p_list_id: 'l1' } },
    ]);
    expect(supabaseMock.queries).toHaveLength(0); // pas de SELECT→push→UPDATE
  });

  it('delete: requires auth and double-scopes (V15)', async () => {
    supabaseMock.user = null;
    await expect(repo.delete('l1')).rejects.toThrow('Not authenticated');
  });
});
