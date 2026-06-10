import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseTasksRepository } from './supabase.repository';
import type { UpdateTaskInput } from './types';

const repo = new SupabaseTasksRepository();
const ME = () => supabaseMock.user?.id;

const VALID_UUID = '22222222-2222-4222-8222-222222222222';
const VALID_ISO = '2026-01-01T00:00:00.000Z';

const ownRow = {
  id: 't1', name: 'Ma tâche', priority: 3, category: 'c1',
  deadline: '2026-06-15T23:59:59.000Z', estimated_time: 30,
  created_at: '2026-06-01T00:00:00.000Z', bookmarked: false, completed: false,
  user_id: '11111111-1111-4111-8111-111111111111', // = mock user par défaut
};
const sharedRow = { ...ownRow, id: 't2', name: 'Partagée', user_id: 'owner-uid' };

beforeEach(() => supabaseMock.reset());

describe('SupabaseTasksRepository — lecture', () => {
  it('getAll: list reads use the trimmed column set (no description / collaborator_validations)', async () => {
    supabaseMock.queueTable('tasks', { data: [ownRow] });
    await repo.getAll();

    const select = supabaseMock.argsOf('tasks', 'select')?.[0] as string;
    expect(select).not.toContain('description');
    expect(select).not.toContain('collaborator_validations');
    expect(select).not.toBe('*');
    // Colonnes indispensables aux vues liste
    for (const col of ['id', 'name', 'priority', 'deadline', 'completed', 'user_id']) {
      expect(select).toContain(col);
    }
  });

  it('getByDate / getFiltered: same trimmed columns as getAll (audit scalabilité)', async () => {
    supabaseMock.queueTable('tasks', { data: [] });
    await repo.getByDate('2026-06-15');
    expect(supabaseMock.argsOf('tasks', 'select')?.[0]).not.toBe('*');

    supabaseMock.reset();
    supabaseMock.queueTable('tasks', { data: [] });
    await repo.getFiltered({ completed: false });
    expect(supabaseMock.argsOf('tasks', 'select')?.[0]).not.toBe('*');
  });

  it('getById: keeps select(*) — the TaskModal needs the full payload', async () => {
    supabaseMock.queueTable('tasks', { data: ownRow });
    await repo.getById('t1');
    expect(supabaseMock.argsOf('tasks', 'select')?.[0]).toBe('*');
  });

  it('enrichSharedBy: marks foreign-owner rows as shared, resolves the sharer name in ONE batched query', async () => {
    supabaseMock.queueTable('tasks', { data: [ownRow, sharedRow] });
    supabaseMock.queueTable('profiles', {
      data: [{ id: 'owner-uid', display_name: 'Bob', email: 'bob@test.dev' }],
    });

    const result = await repo.getAll();

    expect(supabaseMock.argsOf('profiles', 'in')).toEqual(['id', ['owner-uid']]);
    const shared = result.find((t) => t.id === 't2');
    expect(shared).toMatchObject({ isCollaborative: true, sharedBy: 'Bob' });
    const own = result.find((t) => t.id === 't1');
    expect(own?.sharedBy).toBeUndefined();
  });

  it('enrichSharedBy: zero extra query when every task is mine', async () => {
    supabaseMock.queueTable('tasks', { data: [ownRow] });
    await repo.getAll();
    expect(supabaseMock.queries.filter((q) => q.table === 'profiles')).toHaveLength(0);
  });

  it('getPage: FORGED cursor rejected before any .or() (H-1 regression guard)', async () => {
    supabaseMock.queueTable('tasks', { data: [] });
    await expect(
      repo.getPage({ cursor: 'x,user_id.neq.0', cursorDate: VALID_ISO }),
    ).rejects.toBeTruthy();
    expect(supabaseMock.argsOf('tasks', 'or')).toBeUndefined();
  });

  it('getPage: valid cursor emits the exact keyset filter', async () => {
    supabaseMock.queueTable('tasks', { data: [] });
    await repo.getPage({ cursor: VALID_UUID, cursorDate: VALID_ISO });
    expect(supabaseMock.argsOf('tasks', 'or')?.[0]).toBe(
      `created_at.lt.${VALID_ISO},and(created_at.eq.${VALID_ISO},id.lt.${VALID_UUID})`
    );
  });
});

describe('SupabaseTasksRepository — écriture', () => {
  it('create: user_id injected from auth (V1), rejects unauthenticated', async () => {
    supabaseMock.queueTable('tasks', { data: ownRow });
    await repo.create({
      name: 'X', priority: 3, category: 'c1', deadline: '', estimatedTime: 0,
      bookmarked: false, completed: false,
    });
    const inserted = (supabaseMock.argsOf('tasks', 'insert')?.[0] as Record<string, unknown>[])[0];
    expect(inserted.user_id).toBe(ME());

    supabaseMock.reset();
    supabaseMock.user = null;
    await expect(
      repo.create({ name: 'X', priority: 3, category: 'c', deadline: '', estimatedTime: 0, bookmarked: false, completed: false }),
    ).rejects.toThrow('Not authenticated');
  });

  it('update: mapTaskToDb whitelist drops forged user_id (anti-mass-assignment V1)', async () => {
    supabaseMock.queueTable('tasks', { data: ownRow });
    const forged = { name: 'New', user_id: 'attacker' } as unknown as UpdateTaskInput;
    await repo.update('t1', forged);

    const payload = supabaseMock.argsOf('tasks', 'update')?.[0] as Record<string, unknown>;
    expect(payload.user_id).toBeUndefined();
    expect(payload.name).toBe('New');
  });

  it('update: empty deadline is normalized to NULL (timestamp column)', async () => {
    supabaseMock.queueTable('tasks', { data: ownRow });
    await repo.update('t1', { deadline: '' });
    const payload = supabaseMock.argsOf('tasks', 'update')?.[0] as Record<string, unknown>;
    expect(payload.deadline).toBeNull();
  });

  it('toggleComplete / toggleBookmark: atomic RPCs (TOCTOU-3), no read-then-write', async () => {
    supabaseMock.queueRpc('toggle_task_complete', { data: { ...ownRow, completed: true } });
    const toggled = await repo.toggleComplete('t1');
    expect(toggled.completed).toBe(true);

    supabaseMock.queueRpc('toggle_task_bookmark', { data: { ...ownRow, bookmarked: true } });
    await repo.toggleBookmark('t1');

    expect(supabaseMock.rpcCalls).toEqual([
      { fn: 'toggle_task_complete', args: { p_task_id: 't1' } },
      { fn: 'toggle_task_bookmark', args: { p_task_id: 't1' } },
    ]);
    expect(supabaseMock.queries.filter((q) => q.table === 'tasks')).toHaveLength(0);
  });
});
