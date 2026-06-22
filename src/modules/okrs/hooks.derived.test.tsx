// @vitest-environment jsdom
// Couverture métier (audit P0a) : logique dérivée OKR — progression, statut
// dérivé (completed/at_risk/not_started/in_progress), stats agrégées, KR plats
// et complétés.
//
// Dates RELATIVES au « maintenant » réel → pas de fake timers (qui dead-lockent
// le waitFor de React Query).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const fakeRepo = { getAll: vi.fn() };
vi.mock('@/lib/repository.factory', () => ({ getOKRsRepository: () => fakeRepo }));
vi.mock('@/lib/app-mode.store', () => ({ useIsDemo: () => true }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import {
  useOkrsWithProgress,
  useOkrsByStatus,
  useOkrStats,
  useOkrsEndingSoon,
  useAtRiskOkrs,
  useKeyResults,
  useCompletedKeyResults,
} from './hooks.derived';
import type { OKR, KeyResult } from './types';

// ISO date à J+n (négatif = passé).
const relDate = (n: number): string => {
  const x = new Date();
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};
const PAST = relDate(-100); // début 100 j avant
const FUTURE = relDate(100); // fin 100 j après → ~50 % du temps écoulé

const kr = (over: Partial<KeyResult> = {}): KeyResult => ({
  id: 'k' + Math.random().toString(36).slice(2, 7),
  title: 'KR', currentValue: 0, targetValue: 100, unit: '', completed: false,
  estimatedTime: 0, completedAt: null, ...over,
});

// completed → statut completed.
const done: OKR = {
  id: 'done', title: 'Fini', description: '', category: 'perso', progress: 100,
  completed: true, startDate: PAST, endDate: FUTURE,
  keyResults: [kr({ currentValue: 100, targetValue: 100, completed: true, completedAt: '2026-03-01' })],
};
// ~50 % du temps écoulé, progression 0 → at_risk (0 < 50-20).
const late: OKR = {
  id: 'late', title: 'Retard', description: '', category: 'perso', progress: 0,
  completed: false, startDate: PAST, endDate: FUTURE,
  keyResults: [kr({ currentValue: 0, targetValue: 100 })],
};
// pas de dates, progression 0 → not_started.
const fresh: OKR = {
  id: 'fresh', title: 'Neuf', description: '', category: 'perso', progress: 0,
  completed: false, startDate: '', endDate: '',
  keyResults: [kr({ currentValue: 0, targetValue: 50 })],
};
// 50 % vs ~50 % attendu → in_progress (pas at_risk).
const ongoing: OKR = {
  id: 'ongoing', title: 'En cours', description: '', category: 'perso', progress: 50,
  completed: false, startDate: PAST, endDate: FUTURE,
  keyResults: [kr({ currentValue: 50, targetValue: 100 })],
};

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { wrapper };
}

beforeEach(() => {
  fakeRepo.getAll.mockReset();
  fakeRepo.getAll.mockResolvedValue([done, late, fresh, ongoing]);
});

describe('useOkrsWithProgress', () => {
  it('calcule la progression OKR et par KR (clamp 100, guard targetValue=0)', async () => {
    fakeRepo.getAll.mockResolvedValue([
      { ...ongoing, keyResults: [kr({ currentValue: 200, targetValue: 100 }), kr({ currentValue: 0, targetValue: 0 })] },
    ]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOkrsWithProgress(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    const o = result.current.data[0];
    // KR1 clampé à 100, KR2 targetValue=0 → 0 ; moyenne = 50.
    expect(o.keyResults[0].progress).toBe(100);
    expect(o.keyResults[1].progress).toBe(0);
    expect(o.progress).toBe(50);
  });

  it('progression 0 quand pas de key results', async () => {
    fakeRepo.getAll.mockResolvedValue([{ ...fresh, keyResults: [] }]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOkrsWithProgress(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data[0].progress).toBe(0);
  });
});

describe('useOkrsByStatus', () => {
  it('range chaque OKR dans son statut dérivé', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOkrsByStatus(), { wrapper });
    await waitFor(() => expect(result.current.data.completed).toHaveLength(1));
    expect(result.current.data.completed.map((o) => o.id)).toEqual(['done']);
    expect(result.current.data.at_risk.map((o) => o.id)).toEqual(['late']);
    expect(result.current.data.not_started.map((o) => o.id)).toEqual(['fresh']);
    expect(result.current.data.in_progress.map((o) => o.id)).toEqual(['ongoing']);
  });
});

describe('useOkrStats', () => {
  it('agrège total, statuts, progression moyenne et complétion KR', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOkrStats(), { wrapper });
    await waitFor(() => expect(result.current.data.total).toBe(4));
    const s = result.current.data;
    expect(s.completed).toBe(1);
    expect(s.atRisk).toBe(1);
    expect(s.notStarted).toBe(1);
    expect(s.inProgress).toBe(1);
    expect(s.totalKeyResults).toBe(4);
    // KR complétés (currentValue >= targetValue) : seul done (100/100).
    expect(s.completedKeyResults).toBe(1);
    expect(s.keyResultCompletionRate).toBe(25);
    // Progression KR : 100 + 0 + 0 + 50 = 150 / 4 ≈ 38.
    expect(s.avgProgress).toBe(38);
  });

  it('stats neutres sur liste vide', async () => {
    fakeRepo.getAll.mockResolvedValue([]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOkrStats(), { wrapper });
    await waitFor(() => expect(result.current.data.total).toBe(0));
    expect(result.current.data.avgProgress).toBe(0);
    expect(result.current.data.keyResultCompletionRate).toBe(0);
  });
});

describe('useOkrsEndingSoon', () => {
  it('ne retient que les OKR non terminés se terminant dans la fenêtre', async () => {
    const soon: OKR = { ...ongoing, id: 'soon', endDate: relDate(3), completed: false };
    const far: OKR = { ...ongoing, id: 'far', endDate: relDate(100), completed: false };
    const soonButDone: OKR = { ...ongoing, id: 'sd', endDate: relDate(3), completed: true };
    fakeRepo.getAll.mockResolvedValue([soon, far, soonButDone]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOkrsEndingSoon(7), { wrapper });
    await waitFor(() => expect(result.current.data.map((o) => o.id)).toEqual(['soon']));
  });
});

describe('useAtRiskOkrs', () => {
  it('retient les OKR ≥20% en retard sur le planning attendu', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAtRiskOkrs(), { wrapper });
    await waitFor(() => expect(result.current.data.map((o) => o.id)).toEqual(['late']));
  });
});

describe('useKeyResults / useCompletedKeyResults', () => {
  it('aplatit les KR avec leur okrId parent', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKeyResults(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(4));
    expect(result.current.data.every((k) => typeof k.okrId === 'string')).toBe(true);
  });

  it('ne garde que les KR completed avec completedAt non nul', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCompletedKeyResults(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data[0].okrId).toBe('done');
    expect(result.current.data[0].completedAt).toBe('2026-03-01');
  });
});
