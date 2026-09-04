// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// C-01 — « Annuler » une suppression d'OKR rend AUSSI son journal
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI. `kr_completions` cascade depuis `okrs` ET `key_results`.
// `useRestoreOkr` ramenait l'objectif, ses KR et les `task.krId` qui les
// visent — mais pas le journal. Le graphique « KR réalisés » du tableau de
// bord gardait son trou, DÉFINITIVEMENT, alors que la personne venait
// justement de dire qu'elle ne voulait PAS supprimer.
//
// C'était documenté comme une limite (CLAUDE.md § R-08, commentaire de
// `OKRPage`) et jamais traité. Une limite écrite reste une perte de données.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const okrRepo = { create: vi.fn(), delete: vi.fn(), getAll: vi.fn() };
const journalRepo = { create: vi.fn(), getAll: vi.fn() };

vi.mock('@/lib/repository.factory', () => ({
  getOKRsRepository: () => okrRepo,
  getKRCompletionsRepository: () => journalRepo,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

import { useRestoreOkrWithJournal } from './restore-journal.hooks';
import { MAX_REPS_PER_WRITE } from '@/modules/kr-completions/constants';
import type { OKR } from './types';
import type { KRCompletion } from '@/modules/kr-completions/types';

const okr = {
  id: 'okr-1',
  title: 'Lancer COSMO',
  keyResults: [{ id: 'kr-1', title: 'Dix clients', currentValue: 3, targetValue: 10, completed: false }],
} as unknown as OKR;

const completion = (i: number): KRCompletion => ({
  id: `c-${i}`,
  krId: 'kr-1',
  okrId: 'okr-1',
  userId: 'u-1',
  completedAt: `2026-09-0${(i % 9) + 1}T10:00:00.000Z`,
  krTitle: 'Dix clients',
  okrTitle: 'Lancer COSMO',
});

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  okrRepo.create.mockReset().mockResolvedValue(okr);
  journalRepo.create.mockReset().mockImplementation(async (input) => ({ ...input, id: 'new' }));
});

describe('useRestoreOkrWithJournal (C-01)', () => {
  it('rend les N points du journal, pas seulement l objectif', async () => {
    const completions = [completion(0), completion(1), completion(2)];
    const { result } = renderHook(() => useRestoreOkrWithJournal(), { wrapper: wrapper() });

    act(() => { result.current.mutate({ okr, completions }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // C'est LE défaut : l'objectif revenait, le journal non.
    expect(journalRepo.create).toHaveBeenCalledTimes(3);
    const written = journalRepo.create.mock.calls.map(([c]) => c.completedAt);
    expect(written).toEqual(completions.map((c) => c.completedAt));
  });

  it('recree l objectif sous SON identifiant, AVANT le journal', async () => {
    const order: string[] = [];
    okrRepo.create.mockImplementation(async () => { order.push('okr'); return okr; });
    journalRepo.create.mockImplementation(async (input) => { order.push('journal'); return { ...input, id: 'x' }; });

    const { result } = renderHook(() => useRestoreOkrWithJournal(), { wrapper: wrapper() });
    act(() => { result.current.mutate({ okr, completions: [completion(0)] }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Les `okr_id` / `kr_id` du journal DESIGNENT l'objectif : l'inverse
    // ecrirait des lignes orphelines.
    expect(order).toEqual(['okr', 'journal']);

    // L'identifiant passe par le SECOND argument de create() (contrat R-08),
    // jamais par le payload.
    const [payload, options] = okrRepo.create.mock.calls[0];
    expect(payload).not.toHaveProperty('id');
    expect(options).toEqual({ restoreId: 'okr-1' });
  });

  it('conserve les champs du journal a l identique', async () => {
    const { result } = renderHook(() => useRestoreOkrWithJournal(), { wrapper: wrapper() });
    act(() => { result.current.mutate({ okr, completions: [completion(0)] }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(journalRepo.create).toHaveBeenCalledWith({
      krId: 'kr-1',
      okrId: 'okr-1',
      userId: 'u-1',
      completedAt: '2026-09-01T10:00:00.000Z',
      krTitle: 'Dix clients',
      okrTitle: 'Lancer COSMO',
    });
    // ⚠️ L'identifiant de la LIGNE de journal n'est pas restaure, et c'est
    // voulu : rien ne reference une ligne de `kr_completions`, seul son
    // contenu alimente le graphique.
    expect(journalRepo.create.mock.calls[0][0]).not.toHaveProperty('id');
  });

  it('BORNE le rejeu, comme l ecriture normale (faille B18)', async () => {
    // Ce tableau vient d'une lecture, mais il traverse l'etat d'un composant :
    // c'est un objet que des devtools peuvent enrichir. Sans borne, on
    // rouvrirait par la porte de l'annulation le trou que le cap a ferme cote
    // ecriture.
    const flood = Array.from({ length: MAX_REPS_PER_WRITE + 250 }, (_, i) => completion(i));
    const { result } = renderHook(() => useRestoreOkrWithJournal(), { wrapper: wrapper() });
    act(() => { result.current.mutate({ okr, completions: flood }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(journalRepo.create).toHaveBeenCalledTimes(MAX_REPS_PER_WRITE);
  });

  it('reste utile quand aucun journal n a pu etre capture', async () => {
    const { result } = renderHook(() => useRestoreOkrWithJournal(), { wrapper: wrapper() });
    act(() => { result.current.mutate({ okr, completions: [] }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(okrRepo.create).toHaveBeenCalledTimes(1);
    expect(journalRepo.create).not.toHaveBeenCalled();
  });

  it('un echec de restauration ne passe PAS en silence', async () => {
    // `console.error` est supprime du bundle de production : un « Annuler »
    // rate y etait totalement muet.
    const { toast } = await import('sonner');
    okrRepo.create.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useRestoreOkrWithJournal(), { wrapper: wrapper() });
    act(() => { result.current.mutate({ okr, completions: [completion(0)] }); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalled();
  });
});
