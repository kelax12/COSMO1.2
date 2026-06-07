// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Fake repository — only the methods exercised here.
const fakeRepo = {
  getAll: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/lib/repository.factory', () => ({ getTasksRepository: () => fakeRepo }));
vi.mock('@/lib/app-mode.store', () => ({ useIsDemo: () => true }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { useTasks, useCreateTask, useDeleteTask } from './hooks';
import { taskKeys } from './constants';
import type { Task } from './types';

const sampleTask: Task = {
  id: '1', name: 'A', priority: 3, category: 'c', deadline: '', estimatedTime: 0,
  bookmarked: false, completed: false,
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
});

describe('useTasks', () => {
  it('fetches tasks from the repository', async () => {
    fakeRepo.getAll.mockResolvedValue([sampleTask]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTasks(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleTask]);
    expect(fakeRepo.getAll).toHaveBeenCalledTimes(1);
  });

  it('does not fetch when disabled', () => {
    fakeRepo.getAll.mockResolvedValue([]);
    const { wrapper } = makeWrapper();
    renderHook(() => useTasks({ enabled: false }), { wrapper });
    expect(fakeRepo.getAll).not.toHaveBeenCalled();
  });
});

describe('useCreateTask', () => {
  it('validates, calls repo.create, and injects the result at the top of the cache', async () => {
    const created: Task = { ...sampleTask, id: '99', name: 'New' };
    fakeRepo.create.mockResolvedValue(created);
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(taskKeys.lists(), [sampleTask]);

    const { result } = renderHook(() => useCreateTask(), { wrapper });
    await result.current.mutateAsync({
      name: 'New', priority: 3, category: 'c', deadline: '', estimatedTime: 0, bookmarked: false, completed: false,
    });

    expect(fakeRepo.create).toHaveBeenCalledTimes(1);
    const cached = qc.getQueryData<Task[]>(taskKeys.lists());
    expect(cached?.[0]).toEqual(created); // new task prepended
    expect(cached).toHaveLength(2);
  });

  it('rejects invalid input before hitting the repository (zod guard)', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateTask(), { wrapper });
    await expect(
      result.current.mutateAsync({
        name: '', priority: 3, category: 'c', deadline: '', estimatedTime: 0, bookmarked: false, completed: false,
      }),
    ).rejects.toBeTruthy();
    expect(fakeRepo.create).not.toHaveBeenCalled();
  });
});

describe('useDeleteTask', () => {
  it('calls repo.delete with the id', async () => {
    fakeRepo.delete.mockResolvedValue(undefined);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteTask(), { wrapper });
    await result.current.mutateAsync('1');
    expect(fakeRepo.delete).toHaveBeenCalledWith('1');
  });
});
