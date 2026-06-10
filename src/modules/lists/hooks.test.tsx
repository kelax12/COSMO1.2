// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const fakeRepo = {
  getAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/lib/repository.factory', () => ({ getListsRepository: () => fakeRepo }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { useLists, useCreateList, useUpdateList, useDeleteList } from './hooks';
import { listKeys } from './constants';
import type { TaskList } from './types';

const list: TaskList = { id: 'l1', name: 'Courses', color: 'blue', taskIds: [], type: 'manual', isDefault: false };

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
  fakeRepo.update.mockReset();
  fakeRepo.delete.mockReset();
});

describe('useLists', () => {
  it('fetches lists from the repository', async () => {
    fakeRepo.getAll.mockResolvedValue([list]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useLists(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([list]);
  });
});

describe('useCreateList', () => {
  it('appends the created list to the cache', async () => {
    const created = { ...list, id: 'l2', name: 'Sport' };
    fakeRepo.create.mockResolvedValue(created);
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(listKeys.lists(), [list]);

    const { result } = renderHook(() => useCreateList(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: 'Sport', color: 'red' });
    });

    const cached = qc.getQueryData<TaskList[]>(listKeys.lists());
    expect(cached).toHaveLength(2);
    expect(cached?.[1]).toEqual(created);
  });
});

describe('useUpdateList — optimistic + rollback', () => {
  it('patches the cache immediately and rolls back on failure', async () => {
    fakeRepo.update.mockRejectedValue(new Error('rls'));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(listKeys.lists(), [list]);

    const { result } = renderHook(() => useUpdateList(), { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 'l1', updates: { name: 'X' } }),
      ).rejects.toThrow('rls');
    });

    expect(qc.getQueryData<TaskList[]>(listKeys.lists())?.[0].name).toBe('Courses');
  });
});

describe('useDeleteList — optimistic removal + rollback', () => {
  it('restores the cache when the deletion fails', async () => {
    fakeRepo.delete.mockRejectedValue(new Error('denied'));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(listKeys.lists(), [list]);

    const { result } = renderHook(() => useDeleteList(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync('l1')).rejects.toThrow('denied');
    });

    expect(qc.getQueryData<TaskList[]>(listKeys.lists())).toEqual([list]);
  });
});
