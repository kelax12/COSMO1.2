// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const fakeRepo = {
  getAll: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  updateKeyResult: vi.fn(),
};

vi.mock('@/lib/repository.factory', () => ({ getOKRsRepository: () => fakeRepo }));
vi.mock('@/lib/app-mode.store', () => ({ useIsDemo: () => true }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { useOkrs, useCreateOkr, useDeleteOkr, useUpdateKeyResult } from './hooks';
import type { OKR } from './types';

const okr: OKR = {
  id: 'o1', title: 'Culture', description: '', category: 'perso',
  progress: 50, completed: false, keyResults: [],
  startDate: '2026-01-01', endDate: '2026-12-31',
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
  fakeRepo.delete.mockReset();
  fakeRepo.updateKeyResult.mockReset();
});

describe('useOkrs', () => {
  it('fetches OKRs from the repository', async () => {
    fakeRepo.getAll.mockResolvedValue([okr]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOkrs(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([okr]);
  });
});

describe('useCreateOkr — garde zod UX', () => {
  it('rejects an obviously invalid input (empty title) BEFORE any network call', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateOkr(), { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          title: '', description: '', category: 'c',
          startDate: '2026-01-01', endDate: '2026-12-31', keyResults: [],
        } as never),
      ).rejects.toBeTruthy();
    });
    expect(fakeRepo.create).not.toHaveBeenCalled();
  });

  it('passes a valid input through to the repository', async () => {
    fakeRepo.create.mockResolvedValue(okr);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateOkr(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        title: 'Culture', description: '', category: 'perso', progress: 0,
        completed: false, startDate: '2026-01-01', endDate: '2026-12-31', keyResults: [],
      } as never);
    });
    expect(fakeRepo.create).toHaveBeenCalledTimes(1);
  });
});

describe('useUpdateKeyResult', () => {
  it('forwards okrId / keyResultId / updates to the repository', async () => {
    fakeRepo.updateKeyResult.mockResolvedValue(okr);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateKeyResult(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        okrId: 'o1', keyResultId: 'kr1', updates: { currentValue: 7 },
      });
    });
    expect(fakeRepo.updateKeyResult).toHaveBeenCalledWith('o1', 'kr1', { currentValue: 7 });
  });
});

describe('useDeleteOkr', () => {
  it('calls repo.delete with the id', async () => {
    fakeRepo.delete.mockResolvedValue(undefined);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteOkr(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('o1');
    });
    expect(fakeRepo.delete).toHaveBeenCalledWith('o1');
  });
});
