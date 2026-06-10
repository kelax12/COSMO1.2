// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Fake repository — only the methods exercised here.
const fakeRepo = {
  fetchHabits: vi.fn(),
  createHabit: vi.fn(),
  deleteHabit: vi.fn(),
  toggleCompletion: vi.fn(),
};

vi.mock('@/lib/repository.factory', () => ({ getHabitsRepository: () => fakeRepo }));
vi.mock('@/lib/app-mode.store', () => ({ useIsDemo: () => true }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { useHabits, useCreateHabit, useDeleteHabit, useToggleHabitCompletion } from './hooks';
import type { Habit } from './types';

const sampleHabit: Habit = {
  id: 'h1', name: 'Lire', frequency: 'daily', estimatedTime: 30,
  color: 'blue', icon: 'book', completions: {},
};

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => {
  fakeRepo.fetchHabits.mockReset();
  fakeRepo.createHabit.mockReset();
  fakeRepo.deleteHabit.mockReset();
  fakeRepo.toggleCompletion.mockReset();
});

describe('useHabits', () => {
  it('fetches habits from the repository', async () => {
    fakeRepo.fetchHabits.mockResolvedValue([sampleHabit]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useHabits(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleHabit]);
    expect(fakeRepo.fetchHabits).toHaveBeenCalledTimes(1);
  });
});

describe('useCreateHabit', () => {
  it('calls repo.createHabit with the input', async () => {
    fakeRepo.createHabit.mockResolvedValue({ ...sampleHabit, id: 'h2' });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateHabit(), { wrapper });
    const input = { name: 'Sport', frequency: 'daily' as const, estimatedTime: 20, color: 'red', icon: 'dumbbell' };
    await result.current.mutateAsync(input);
    expect(fakeRepo.createHabit).toHaveBeenCalledWith(input);
  });
});

describe('useToggleHabitCompletion', () => {
  it('calls repo.toggleCompletion with id and date', async () => {
    fakeRepo.toggleCompletion.mockResolvedValue({ ...sampleHabit, completions: { '2026-06-10': true } });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useToggleHabitCompletion(), { wrapper });
    await result.current.mutateAsync({ id: 'h1', date: '2026-06-10' });
    expect(fakeRepo.toggleCompletion).toHaveBeenCalledWith('h1', '2026-06-10');
  });
});

describe('useDeleteHabit', () => {
  it('calls repo.deleteHabit with the id', async () => {
    fakeRepo.deleteHabit.mockResolvedValue(undefined);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteHabit(), { wrapper });
    await result.current.mutateAsync('h1');
    expect(fakeRepo.deleteHabit).toHaveBeenCalledWith('h1');
  });
});
