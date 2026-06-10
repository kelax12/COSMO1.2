// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const fakeRepo = {
  getAll: vi.fn(),
  getPendingRequests: vi.fn(),
  sendFriendRequest: vi.fn(),
  acceptFriendRequest: vi.fn(),
  removeFriend: vi.fn(),
  shareTask: vi.fn(),
};

vi.mock('@/lib/repository.factory', () => ({ getFriendsRepository: () => fakeRepo }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import {
  useFriends, useFriendRequests, useSendFriendRequest,
  useAcceptFriendRequest, useRemoveFriend, useShareTask, useFriendCount,
} from './hooks';
import type { Friend } from './types';

const friend: Friend = { id: 'f1', name: 'Alice', email: 'alice@test.dev', userId: 'alice-uid' };

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => {
  Object.values(fakeRepo).forEach((fn) => fn.mockReset());
});

describe('useFriends / useFriendCount', () => {
  it('fetches friends and derives the count', async () => {
    fakeRepo.getAll.mockResolvedValue([friend]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => ({ friends: useFriends(), count: useFriendCount() }), { wrapper });
    await waitFor(() => expect(result.current.friends.isSuccess).toBe(true));
    expect(result.current.friends.data).toEqual([friend]);
    expect(result.current.count).toBe(1);
  });
});

describe('useFriendRequests', () => {
  it('fetches pending requests', async () => {
    fakeRepo.getPendingRequests.mockResolvedValue([{ id: 'r1', email: 'bob@x.y', status: 'pending', sentAt: 'now' }]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useFriendRequests(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

describe('mutations sociales', () => {
  it('useSendFriendRequest forwards the input', async () => {
    fakeRepo.sendFriendRequest.mockResolvedValue({ id: 'r1', email: 'bob@x.y', status: 'pending', sentAt: 'now' });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSendFriendRequest(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ email: 'bob@x.y' });
    });
    expect(fakeRepo.sendFriendRequest).toHaveBeenCalledWith({ email: 'bob@x.y' });
  });

  it('useAcceptFriendRequest forwards the request id', async () => {
    fakeRepo.acceptFriendRequest.mockResolvedValue(friend);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAcceptFriendRequest(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('r1');
    });
    expect(fakeRepo.acceptFriendRequest).toHaveBeenCalledWith('r1');
  });

  it('useRemoveFriend forwards the row id (RPC remove_friendship côté repo)', async () => {
    fakeRepo.removeFriend.mockResolvedValue(undefined);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRemoveFriend(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('f1');
    });
    expect(fakeRepo.removeFriend).toHaveBeenCalledWith('f1');
  });

  it('useShareTask forwards the share input and surfaces repo errors', async () => {
    fakeRepo.shareTask.mockRejectedValue(new Error("Envoie d'abord une demande d'ami"));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useShareTask(), { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ taskId: 't1', friendId: 'alice-uid', role: 'editor' }),
      ).rejects.toThrow(/demande d'ami/);
    });
    expect(fakeRepo.shareTask).toHaveBeenCalledWith({ taskId: 't1', friendId: 'alice-uid', role: 'editor' });
  });
});
