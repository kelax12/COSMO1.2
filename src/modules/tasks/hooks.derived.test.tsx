// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const fakeRepo = { getAll: vi.fn() };

vi.mock('@/lib/repository.factory', () => ({ getTasksRepository: () => fakeRepo }));
vi.mock('@/lib/app-mode.store', () => ({ useIsDemo: () => true }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import {
  useTasksByStatus, useTaskStats, useSearchTasks, useTaskLookup, useTasksInPriorityRange,
} from './hooks.derived';
import type { Task } from './types';

const PAST = '2020-01-01T00:00:00.000Z';   // toujours en retard
const FUTURE = '2099-01-01T00:00:00.000Z'; // jamais en retard

const tasks: Task[] = [
  { id: 't1', name: 'Rapport', priority: 1, category: 'work', deadline: PAST, estimatedTime: 30, bookmarked: true, completed: false },
  { id: 't2', name: 'Courses', priority: 3, category: 'home', deadline: FUTURE, estimatedTime: 15, bookmarked: false, completed: false, description: 'acheter du pain' },
  { id: 't3', name: 'Sport', priority: 3, category: 'health', deadline: '', estimatedTime: 60, bookmarked: false, completed: true },
];

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => {
  fakeRepo.getAll.mockReset();
  fakeRepo.getAll.mockResolvedValue(tasks);
});

describe('useTaskStats', () => {
  it('computes totals, overdue, completion rate and priority histogram', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTaskStats(), { wrapper });
    await waitFor(() => expect(result.current.data.total).toBe(3));

    expect(result.current.data).toMatchObject({
      total: 3,
      completed: 1,
      todo: 2,
      bookmarked: 1,
      overdue: 1, // t1 (PAST, non complétée) ; t3 complétée exclue
      completionRate: 33,
    });
    expect(result.current.data.byPriority).toEqual({ 1: 1, 3: 2 });
  });
});

describe('useTasksByStatus', () => {
  it('groups by completed / todo using the canonical field (B6)', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTasksByStatus(), { wrapper });
    await waitFor(() => expect(result.current.data.completed).toHaveLength(1));
    expect(result.current.data.todo.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(result.current.data.completed[0].id).toBe('t3');
  });
});

describe('useSearchTasks', () => {
  it('matches on name OR description, case-insensitive; empty term returns all', async () => {
    const { wrapper } = makeWrapper();
    const { result, rerender } = renderHook(({ term }) => useSearchTasks(term), {
      wrapper, initialProps: { term: 'PAIN' },
    });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data[0].id).toBe('t2'); // matché via description

    rerender({ term: '  ' });
    expect(result.current.data).toHaveLength(3);
  });
});

describe('useTasksInPriorityRange', () => {
  it('filters inclusively on [min, max]', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTasksInPriorityRange(1, 2), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data[0].id).toBe('t1');
  });
});

describe('useTaskLookup', () => {
  it('builds an id→task map with a stable getter', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTaskLookup(), { wrapper });
    await waitFor(() => expect(result.current.getTask('t2')?.name).toBe('Courses'));
    expect(result.current.getTask('nope')).toBeUndefined();
  });
});
