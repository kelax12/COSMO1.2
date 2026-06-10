// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const fakeRepo = {
  getAll: vi.fn(),
  create: vi.fn(),
};

vi.mock('@/lib/repository.factory', () => ({ getKRCompletionsRepository: () => fakeRepo }));
vi.mock('@/lib/app-mode.store', () => ({ useIsDemo: () => true }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { useKRCompletions, useCreateKRCompletion } from './hooks';
import { krCompletionKeys } from './constants';
import type { KRCompletion } from './types';

const completion: KRCompletion = {
  id: 'c1', krId: 'kr1', okrId: 'o1', userId: 'u1',
  completedAt: '2026-06-01T10:00:00.000Z', krTitle: 'KR', okrTitle: 'OKR',
};

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => {
  fakeRepo.getAll.mockReset();
  fakeRepo.create.mockReset();
});

describe('useKRCompletions', () => {
  it('fetches the append-only journal', async () => {
    fakeRepo.getAll.mockResolvedValue([completion]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKRCompletions(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([completion]);
  });

  it('does not fetch when disabled', () => {
    fakeRepo.getAll.mockResolvedValue([]);
    const { wrapper } = makeWrapper();
    renderHook(() => useKRCompletions({ enabled: false }), { wrapper });
    expect(fakeRepo.getAll).not.toHaveBeenCalled();
  });
});

describe('useCreateKRCompletion — optimistic dashboard feedback', () => {
  it('adds an optimistic entry instantly, rolls back on error', async () => {
    fakeRepo.create.mockRejectedValue(new Error('network'));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(krCompletionKeys.lists(), [completion]);

    const { result } = renderHook(() => useCreateKRCompletion(), { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          krId: 'kr2', okrId: 'o1', userId: 'u1',
          completedAt: '2026-06-02T00:00:00.000Z', krTitle: 'B', okrTitle: 'OKR',
        }),
      ).rejects.toThrow('network');
    });

    // Rollback : la ligne optimiste a été retirée
    expect(qc.getQueryData<KRCompletion[]>(krCompletionKeys.lists())).toEqual([completion]);
  });

  it('persists via the repository on success', async () => {
    fakeRepo.create.mockResolvedValue({ ...completion, id: 'c2', krId: 'kr2' });
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(krCompletionKeys.lists(), [completion]);

    const { result } = renderHook(() => useCreateKRCompletion(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        krId: 'kr2', okrId: 'o1', userId: 'u1',
        completedAt: '2026-06-02T00:00:00.000Z', krTitle: 'B', okrTitle: 'OKR',
      });
    });
    expect(fakeRepo.create).toHaveBeenCalledTimes(1);
  });
});
