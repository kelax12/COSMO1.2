// @vitest-environment jsdom
// Couverture métier (audit P0a) : logique dérivée Habits — streaks,
// completion rates, regroupement par fréquence, stats, attention. Lit le champ
// canonique `completions: Record<string, boolean>` (faille B5).
//
// Dates RELATIVES au « maintenant » réel (en-CA local, comme le code) → pas de
// fake timers (qui dead-lockent le waitFor de React Query).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const fakeRepo = { fetchHabits: vi.fn() };
vi.mock('@/lib/repository.factory', () => ({ getHabitsRepository: () => fakeRepo }));
vi.mock('@/lib/app-mode.store', () => ({ useIsDemo: () => true }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import {
  useHabitsWithStats,
  useHabitsByFrequency,
  useHabitStats,
  useHabitsNeedingAttention,
  useTodaysHabitStatus,
} from './hooks.derived';
import type { Habit } from './types';

// Date locale en-CA à J-n (même convention que le code).
const rel = (n: number): string => {
  const x = new Date();
  x.setDate(x.getDate() - n);
  return x.toLocaleDateString('en-CA');
};
const TODAY = rel(0);
const D1 = rel(1);
const D2 = rel(2);

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h' + Math.random().toString(36).slice(2, 7),
  name: 'Habit', frequency: 'daily', estimatedTime: 10, color: '#fff', icon: 'x',
  completions: {}, ...over,
});

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { wrapper };
}

beforeEach(() => {
  fakeRepo.fetchHabits.mockReset();
});

describe('useHabitsWithStats', () => {
  it('calcule streak courant et taux de complétion 7j', async () => {
    // 3 jours consécutifs finissant aujourd'hui → streak 3 ; un false ignoré (B5).
    fakeRepo.fetchHabits.mockResolvedValue([
      habit({ id: 'streak', completions: { [TODAY]: true, [D1]: true, [D2]: true, [rel(8)]: false } }),
    ]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useHabitsWithStats(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    const h = result.current.data[0];
    expect(h.currentStreak).toBe(3);
    expect(h.totalCompletions).toBe(3);
    // 3 complétions sur 7 jours → 43 %.
    expect(h.completionRate7Days).toBe(43);
  });

  it('streak 0 si la dernière complétion est trop ancienne', async () => {
    fakeRepo.fetchHabits.mockResolvedValue([habit({ completions: { [rel(14)]: true } })]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useHabitsWithStats(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data[0].currentStreak).toBe(0);
  });
});

describe('useHabitsByFrequency', () => {
  it('regroupe par fréquence avec défaut daily', async () => {
    fakeRepo.fetchHabits.mockResolvedValue([
      habit({ id: 'a', frequency: 'weekly' }),
      habit({ id: 'b', frequency: 'monthly' }),
      habit({ id: 'c', frequency: 'daily' }),
    ]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useHabitsByFrequency(), { wrapper });
    await waitFor(() => expect(result.current.data.daily).toHaveLength(1));
    expect(result.current.data.weekly.map((h) => h.id)).toEqual(['a']);
    expect(result.current.data.monthly.map((h) => h.id)).toEqual(['b']);
    expect(result.current.data.daily.map((h) => h.id)).toEqual(['c']);
  });
});

describe('useHabitStats', () => {
  it('agrège complétions du jour, streaks moyen/max et taux 7j', async () => {
    fakeRepo.fetchHabits.mockResolvedValue([
      habit({ id: 'a', completions: { [TODAY]: true, [D1]: true } }), // streak 2
      habit({ id: 'b', completions: { [D1]: true } }),                 // streak 1 (hier)
      habit({ id: 'c', completions: {} }),                             // streak 0
    ]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useHabitStats(), { wrapper });
    await waitFor(() => expect(result.current.data.total).toBe(3));
    const s = result.current.data;
    expect(s.completedToday).toBe(1);
    expect(s.completionRateToday).toBe(33);
    expect(s.totalCompletions).toBe(3);
    expect(s.longestStreak).toBe(2);
    // streaks 2,1,0 → moyenne 1.
    expect(s.avgStreak).toBe(1);
  });

  it('stats neutres sur liste vide', async () => {
    fakeRepo.fetchHabits.mockResolvedValue([]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useHabitStats(), { wrapper });
    await waitFor(() => expect(result.current.data.total).toBe(0));
    expect(result.current.data.avgStreak).toBe(0);
    expect(result.current.data.completionRateToday).toBe(0);
  });
});

describe('useHabitsNeedingAttention', () => {
  it('retient les habitudes sous le seuil de complétion 7j', async () => {
    fakeRepo.fetchHabits.mockResolvedValue([
      habit({ id: 'low', completions: { [TODAY]: true } }), // ~14 %
      habit({ id: 'high', completions: { [TODAY]: true, [D1]: true, [D2]: true, [rel(3)]: true, [rel(4)]: true } }), // ~71 %
    ]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useHabitsNeedingAttention(50), { wrapper });
    await waitFor(() => expect(result.current.data.map((h) => h.id)).toEqual(['low']));
  });
});

describe('useTodaysHabitStatus', () => {
  it('expose id/nom/couleur + complété aujourd’hui + streak', async () => {
    fakeRepo.fetchHabits.mockResolvedValue([
      habit({ id: 'a', name: 'Sport', color: '#abc', completions: { [TODAY]: true, [D1]: true } }),
    ]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTodaysHabitStatus(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data[0]).toMatchObject({
      id: 'a', name: 'Sport', color: '#abc', isCompletedToday: true, currentStreak: 2,
    });
  });
});
