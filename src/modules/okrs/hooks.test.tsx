// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const fakeRepo = {
  getAll: vi.fn(),
  getFiltered: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  updateKeyResult: vi.fn(),
};

vi.mock('@/lib/repository.factory', () => ({ getOKRsRepository: () => fakeRepo }));
// `appModeStore` est requis en plus de `useIsDemo` : les hooks de création
// comptent l'engagement démo (src/lib/demo-engagement.ts), qui lit le store
// directement. Un mock partiel casserait l'import du module testé.
vi.mock('@/lib/app-mode.store', () => ({
  useIsDemo: () => true,
  appModeStore: { isDemo: true, setDemo: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import {
  useOkrs, useActiveOkrs, useCreateOkr, useDeleteOkr, useUpdateKeyResult,
} from './hooks';
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

// ═══════════════════════════════════════════════════════════════════
// OKR actifs / terminés : dérivés, jamais refetchés
//
// `useWeeklyCheckin()` est monté par le tableau de bord à CHAQUE ouverture et
// ne se sert de cette liste que pour tester `length > 0`, un lundi ou un mardi.
// Quand elle passait par `useFilteredOkrs`, cela coûtait DEUX requêtes de plus
// tous les jours : `okrs`, puis `key_results` pour hydrater ce qu'on venait
// de lire. Ces tests échouent si quelqu'un les rebranche sur le réseau.
// ═══════════════════════════════════════════════════════════════════
// `useCompletedOkrs` a été supprimé le 2026-09-05 (C-49), sans consommateur.
// `useActiveOkrs`, lui, est monté par `ActiveOKRs` : c'est LUI que ce test
// protège, et l'assertion qui compte reste la même — filtrer en mémoire, sans
// seconde requête.
describe('useActiveOkrs', () => {
  const fini: OKR = { ...okr, id: 'o2', title: 'Fini', completed: true };

  it('filtre en mémoire SANS seconde requête', async () => {
    fakeRepo.getAll.mockResolvedValue([okr, fini]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => ({ tous: useOkrs(), actifs: useActiveOkrs() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.tous.isSuccess).toBe(true));

    expect(result.current.actifs.data.map((o: OKR) => o.id)).toEqual(['o1']);
    // Une seule lecture pour les deux hooks, et jamais le chemin filtré.
    expect(fakeRepo.getAll).toHaveBeenCalledTimes(1);
    expect(fakeRepo.getFiltered).not.toHaveBeenCalled();
  });

  it('rendent [] tant que la liste n’est pas chargée, sans planter', () => {
    fakeRepo.getAll.mockReturnValue(new Promise(() => {}));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useActiveOkrs(), { wrapper });
    expect(result.current.data).toEqual([]);
  });
});
