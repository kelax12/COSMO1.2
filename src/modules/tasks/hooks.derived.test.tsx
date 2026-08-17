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
  useTasksByCategory, useTasksByPriority, useTasksDueWithinDays,
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

describe('useTasksByCategory', () => {
  it('groupe par catégorie, terminées comprises', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTasksByCategory(), { wrapper });
    await waitFor(() => expect(Object.keys(result.current.data)).toHaveLength(3));

    expect(result.current.data.work.map((t) => t.id)).toEqual(['t1']);
    expect(result.current.data.home.map((t) => t.id)).toEqual(['t2']);
    expect(result.current.data.health.map((t) => t.id)).toEqual(['t3']);
  });

  it('catégorie absente ou vide → seau « uncategorized »', async () => {
    fakeRepo.getAll.mockResolvedValue([
      { ...tasks[0], id: 'a', category: '' },
      { ...tasks[0], id: 'b', category: undefined },
    ] as Task[]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTasksByCategory(), { wrapper });

    await waitFor(() => expect(result.current.data.uncategorized).toHaveLength(2));
    expect(Object.keys(result.current.data)).toEqual(['uncategorized']);
  });
});

describe('useTasksByPriority', () => {
  it('groupe par priorité en gardant les cinq seaux, même vides', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTasksByPriority(), { wrapper });
    await waitFor(() => expect(result.current.data[1]).toHaveLength(1));

    expect(Object.keys(result.current.data)).toEqual(['1', '2', '3', '4', '5']);
    expect(result.current.data[3].map((t) => t.id)).toEqual(['t2', 't3']);
    expect(result.current.data[2]).toEqual([]);
  });

  it('priorité absente → seau 3 par défaut ; priorité hors 1-5 → ignorée', async () => {
    fakeRepo.getAll.mockResolvedValue([
      { ...tasks[0], id: 'sans', priority: undefined },
      { ...tasks[0], id: 'hors', priority: 9 },
    ] as Task[]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTasksByPriority(), { wrapper });

    await waitFor(() => expect(result.current.data[3]).toHaveLength(1));
    expect(result.current.data[3][0].id).toBe('sans');
    expect(Object.values(result.current.data).flat().map((t) => t.id)).toEqual(['sans']);
  });
});

describe('useTasksDueWithinDays', () => {
  it('ne retient que les échéances à venir dans la fenêtre', async () => {
    const inThreeDays = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const inThirtyDays = new Date(Date.now() + 30 * 86_400_000).toISOString();
    fakeRepo.getAll.mockResolvedValue([
      { ...tasks[0], id: 'proche', deadline: inThreeDays, completed: false },
      { ...tasks[0], id: 'loin', deadline: inThirtyDays, completed: false },
    ] as Task[]);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTasksDueWithinDays(7), { wrapper });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data[0].id).toBe('proche');
  });

  it('exclut le passé, les tâches terminées et celles sans échéance', async () => {
    const bientot = new Date(Date.now() + 86_400_000).toISOString();
    fakeRepo.getAll.mockResolvedValue([
      { ...tasks[0], id: 'passe', deadline: PAST, completed: false },
      { ...tasks[0], id: 'faite', deadline: bientot, completed: true },
      { ...tasks[0], id: 'sans-date', deadline: '', completed: false },
      { ...tasks[0], id: 'garde', deadline: bientot, completed: false },
    ] as Task[]);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTasksDueWithinDays(7), { wrapper });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data[0].id).toBe('garde');
  });
});
