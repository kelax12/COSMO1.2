import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseFriendsRepository } from './supabase.repository';

const repo = new SupabaseFriendsRepository();
const ME = () => supabaseMock.user?.id;

const friendRow = {
  id: 'f1', name: 'Alice', email: 'alice@test.dev',
  friend_user_id: 'alice-uid', user_id: 'u1',
};

beforeEach(() => supabaseMock.reset());

describe('SupabaseFriendsRepository — lecture', () => {
  it('getAll: enriches via profiles batched .in(), no RPC fallback when friend_user_id is canonical', async () => {
    supabaseMock.queueTable('friends', { data: [friendRow] });
    supabaseMock.queueTable('profiles', { data: [{ id: 'alice-uid', email: 'alice@test.dev', avatar_url: 'a.png' }] });

    const result = await repo.getAll();

    expect(supabaseMock.argsOf('profiles', 'in')).toEqual(['email', ['alice@test.dev']]);
    expect(result[0]).toMatchObject({ userId: 'alice-uid', avatar: 'a.png' });
    expect(supabaseMock.rpcCalls).toHaveLength(0); // pas de fallback nécessaire
  });

  it('getAll: falls back to resolve_profiles_by_emails (BATCH, un seul appel) when profiles RLS hides the row (N12)', async () => {
    supabaseMock.queueTable('friends', { data: [{ ...friendRow, friend_user_id: undefined }] });
    supabaseMock.queueTable('profiles', { data: [] }); // RLS a tout masqué
    supabaseMock.queueRpc('resolve_profiles_by_emails', { data: [{ email: 'alice@test.dev', id: 'alice-uid' }] });

    const result = await repo.getAll();

    // UN SEUL aller-retour RPC pour tous les emails non résolus (plus de N+1).
    expect(supabaseMock.rpcCalls).toEqual([
      { fn: 'resolve_profiles_by_emails', args: { p_emails: ['alice@test.dev'] } },
    ]);
    expect(result[0].userId).toBe('alice-uid');
  });

  it('getAll: un seul appel batch même avec plusieurs amis non résolus (anti N+1)', async () => {
    supabaseMock.queueTable('friends', {
      data: [
        { ...friendRow, id: 'f1', email: 'alice@test.dev', friend_user_id: undefined },
        { ...friendRow, id: 'f2', email: 'bob@test.dev', friend_user_id: undefined },
      ],
    });
    supabaseMock.queueTable('profiles', { data: [] });
    supabaseMock.queueRpc('resolve_profiles_by_emails', {
      data: [
        { email: 'alice@test.dev', id: 'alice-uid' },
        { email: 'bob@test.dev', id: 'bob-uid' },
      ],
    });

    const result = await repo.getAll();

    expect(supabaseMock.rpcCalls).toHaveLength(1); // <-- pas N appels
    expect(supabaseMock.rpcCalls[0].fn).toBe('resolve_profiles_by_emails');
    expect(result.find((f) => f.id === 'f1')?.userId).toBe('alice-uid');
    expect(result.find((f) => f.id === 'f2')?.userId).toBe('bob-uid');
  });

  it('getByEmail: L-9 boundary guard — empty/oversized/no-@ inputs return null with ZERO query', async () => {
    expect(await repo.getByEmail('')).toBeNull();
    expect(await repo.getByEmail('a'.repeat(321) + '@x.y')).toBeNull();
    expect(await repo.getByEmail('not-an-email')).toBeNull();
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('getByEmail: N4 — exact lowercased .eq, never ILIKE (pattern injection)', async () => {
    supabaseMock.queueTable('friends', { data: friendRow });
    supabaseMock.queueRpc('resolve_profile_by_email', { data: 'alice-uid' });
    await repo.getByEmail('ALICE%@Test.dev');

    const calls = supabaseMock.callsFor('friends');
    expect(calls.some((c) => c.method === 'ilike' || c.method === 'like')).toBe(false);
    expect(calls.find((c) => c.method === 'eq')?.args).toEqual(['email', 'alice%@test.dev']);
  });

  it('getPendingRequests: only pending requests RECEIVED by me, [] when logged out', async () => {
    supabaseMock.queueTable('friend_requests', { data: [] });
    await repo.getPendingRequests();
    const eqs = supabaseMock.callsFor('friend_requests').filter((c) => c.method === 'eq');
    expect(eqs.map((c) => c.args)).toEqual([['status', 'pending'], ['receiver_id', ME()]]);

    supabaseMock.reset();
    supabaseMock.user = null;
    expect(await repo.getPendingRequests()).toEqual([]);
    expect(supabaseMock.queries).toHaveLength(0);
  });
});

describe('SupabaseFriendsRepository — écriture & confiance', () => {
  it('sendFriendRequest: dedup guard — returns the existing pending request without inserting', async () => {
    const existing = {
      id: 'r1', email: 'bob@test.dev', status: 'pending',
      sent_at: '2026-06-01T00:00:00.000Z', sender_id: ME(),
    };
    supabaseMock.queueTable('friend_requests', { data: existing });

    const result = await repo.sendFriendRequest({ email: 'BOB@test.dev' });

    expect(result.id).toBe('r1');
    // Une seule requête friend_requests (le pre-check), pas d'INSERT
    expect(supabaseMock.queries.filter((q) => q.table === 'friend_requests')).toHaveLength(1);
    expect(supabaseMock.argsOf('friend_requests', 'insert')).toBeUndefined();
  });

  it('sendFriendRequest: insert carries sender_id from auth and NO receiver_id (trigger-filled)', async () => {
    supabaseMock.queueTable('friend_requests', { data: null }); // pre-check: rien
    supabaseMock.queueTable('friend_requests', {
      data: { id: 'r2', email: 'bob@test.dev', status: 'pending', sent_at: 'now', sender_id: ME() },
    });

    await repo.sendFriendRequest({ email: 'bob@test.dev' });

    const inserted = (supabaseMock.argsOf('friend_requests', 'insert', 1)?.[0] as Record<string, unknown>[])[0];
    expect(inserted.sender_id).toBe(ME());
    expect(inserted.email).toBe('bob@test.dev');
    expect('receiver_id' in inserted).toBe(false); // rempli par trg_set_receiver_id
  });

  it('acceptFriendRequest / removeFriend: atomic SECURITY DEFINER RPCs (RACE-5 / N13)', async () => {
    supabaseMock.queueRpc('accept_friend_request_v2', { data: friendRow });
    const friend = await repo.acceptFriendRequest('r1');
    expect(friend.id).toBe('f1');

    supabaseMock.queueRpc('remove_friendship', { data: null });
    await repo.removeFriend('f1');

    expect(supabaseMock.rpcCalls).toEqual([
      { fn: 'accept_friend_request_v2', args: { request_id: 'r1' } },
      { fn: 'remove_friendship', args: { p_friend_row_id: 'f1' } },
    ]);
    // Jamais de DELETE direct sur friends (le no-op réciproque silencieux N13)
    expect(supabaseMock.queries.filter((q) => q.table === 'friends')).toHaveLength(0);
  });

  it('shareTask: resolves friend uid via RPC, upserts with shared_by = MY auth uid', async () => {
    supabaseMock.queueRpc('resolve_profile_by_email', { data: 'bob-uid' });
    supabaseMock.queueTable('shared_tasks', { data: null });

    await repo.shareTask({ taskId: 't1', friendId: 'row-id', friendEmail: 'Bob@Test.dev', role: 'editor' });

    expect(supabaseMock.rpcCalls[0]).toEqual({
      fn: 'resolve_profile_by_email', args: { p_email: 'bob@test.dev' },
    });
    const upserted = (supabaseMock.argsOf('shared_tasks', 'upsert')?.[0] as Record<string, unknown>[])[0];
    expect(upserted).toEqual({ task_id: 't1', friend_id: 'bob-uid', shared_by: ME(), role: 'editor' });
    expect(supabaseMock.argsOf('shared_tasks', 'upsert')?.[1]).toEqual({ onConflict: 'task_id,friend_id' });
  });

  it('shareTask: maps 23503 (FK) and 42501 (RLS) to friendly French messages, no raw leak', async () => {
    supabaseMock.queueTable('shared_tasks', { data: null, error: { code: '23503', message: 'fk violation raw' } });
    await expect(repo.shareTask({ taskId: 't1', friendId: 'x' })).rejects.toThrow(/pas \(encore\) inscrit/);

    supabaseMock.queueTable('shared_tasks', { data: null, error: { code: '42501', message: 'rls raw' } });
    await expect(repo.shareTask({ taskId: 't1', friendId: 'x' })).rejects.toThrow(/demande d'ami/);
  });

  it('getRelatedTaskShares: .or() interpolates ONLY the trusted auth uid', async () => {
    supabaseMock.queueTable('shared_tasks', { data: [] });
    await repo.getRelatedTaskShares();
    expect(supabaseMock.argsOf('shared_tasks', 'or')?.[0]).toBe(
      `shared_by.eq.${ME()},friend_id.eq.${ME()}`
    );
    expect(supabaseMock.argsOf('shared_tasks', 'limit')).toEqual([500]);
  });
});
