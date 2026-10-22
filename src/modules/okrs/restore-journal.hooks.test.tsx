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

// 🔴 UN SEUL repository est mocke, et c'est le point du correctif : le hook ne
// doit JAMAIS atteindre `getKRCompletionsRepository`. S'il y revenait, ce mock
// absent le ferait echouer bruyamment au lieu de le laisser passer.
const okrRepo = {
  create: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn(),
  restoreCompletions: vi.fn(),
};

vi.mock('@/lib/repository.factory', () => ({
  getOKRsRepository: () => okrRepo,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
// Sentry est charge en differe : `monitoring` est la seule porte (C-13/C-14).
vi.mock('@/lib/monitoring', () => ({ captureException: vi.fn() }));

import { useRestoreOkrWithJournal } from './restore-journal.hooks';
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
  okrRepo.restoreCompletions.mockReset().mockResolvedValue(undefined);
});

describe('useRestoreOkrWithJournal (C-01)', () => {
  it('rend les N points du journal, pas seulement l objectif', async () => {
    const completions = [completion(0), completion(1), completion(2)];
    const { result } = renderHook(() => useRestoreOkrWithJournal(), { wrapper: wrapper() });

    act(() => { result.current.mutate({ okr, completions }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // C'est LE défaut : l'objectif revenait, le journal non.
    expect(okrRepo.restoreCompletions).toHaveBeenCalledWith(completions);
  });

  it('passe par le REPOSITORY OKR, jamais par le journal directement', async () => {
    // 🔴 L'arbitrage du 2026-09-03 supprime `useCreateKRCompletion` parce que
    // c'est « un INSERT client libre dans un journal append-only ». Appeler
    // `getKRCompletionsRepository()` depuis ici garderait le défaut en
    // changeant son nom. Le hook ne connaît QUE le repository OKR.
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(
      join(process.cwd(), 'src/modules/okrs/restore-journal.hooks.ts'),
      'utf-8',
    );
    const code = src
      .split(String.fromCharCode(10))
      .map((line) => {
        const at = line.indexOf('//');
        return at === -1 ? line : line.slice(0, at);
      })
      .join(String.fromCharCode(10));
    expect(code).not.toContain('getKRCompletionsRepository');
  });

  it('recree l objectif sous SON identifiant, AVANT le journal', async () => {
    const order: string[] = [];
    okrRepo.create.mockImplementation(async () => { order.push('okr'); return okr; });
    okrRepo.restoreCompletions.mockImplementation(async () => { order.push('journal'); });

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

  it('transmet les champs du journal a l identique', async () => {
    const { result } = renderHook(() => useRestoreOkrWithJournal(), { wrapper: wrapper() });
    act(() => { result.current.mutate({ okr, completions: [completion(0)] }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(okrRepo.restoreCompletions).toHaveBeenCalledWith([
      expect.objectContaining({
        krId: 'kr-1',
        okrId: 'okr-1',
        completedAt: '2026-09-01T10:00:00.000Z',
        krTitle: 'Dix clients',
        okrTitle: 'Lancer COSMO',
      }),
    ]);
  });

  it('reste utile quand aucun journal n a pu etre capture', async () => {
    const { result } = renderHook(() => useRestoreOkrWithJournal(), { wrapper: wrapper() });
    act(() => { result.current.mutate({ okr, completions: [] }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(okrRepo.create).toHaveBeenCalledTimes(1);
    expect(okrRepo.restoreCompletions).toHaveBeenCalledWith([]);
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
