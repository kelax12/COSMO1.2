// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// C-42 — « Annuler » rend le commentaire À SA PLACE dans le fil
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI. `TaskCommentsSection` supprimait un commentaire sur UN SEUL
// CLIC, sans confirmation ni annulation, et il disparaissait pour toute
// l'équipe. C'était la seule suppression du mode entreprise sans aucun filet.
//
// L'arbitrage du 2026-09-03 a tranché pour le toast « Annuler », avec les
// jumeaux C-41 et C-43, et demandait explicitement un `useRestoreComment`.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const repo = { addComment: vi.fn(), deleteComment: vi.fn(), getComments: vi.fn() };
vi.mock('@/lib/repository.factory', () => ({ getTeamProjectsRepository: () => repo }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

import { useRestoreComment } from './restore-comment.hooks';
import type { TeamTaskComment } from './types';

const comment: TeamTaskComment = {
  id: 'c-1',
  taskId: 't-1',
  authorId: 'u-1',
  body: 'Il manque la facture',
  mentions: ['u-2'],
  createdAt: '2026-09-01T08:00:00.000Z',
};

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  repo.addComment.mockReset().mockResolvedValue(comment);
});

describe('useRestoreComment (C-42)', () => {
  it('rend le commentaire sous SON identifiant ET a SON horodatage', async () => {
    const { result } = renderHook(() => useRestoreComment('t-1'), { wrapper: wrapper() });
    act(() => { result.current.mutate(comment); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [payload, options] = repo.addComment.mock.calls[0];

    // 🔴 L'HORODATAGE EST LE POINT PROPRE A CE CAS. Un fil de commentaires est
    // ordonné par `createdAt` : sans lui, « Annuler » remettrait le
    // commentaire A LA FIN du fil, après des réponses qu'il précédait. La
    // conversation serait rendue incompréhensible par le geste censé la
    // réparer.
    expect(options).toEqual({ restoreId: 'c-1', restoreCreatedAt: '2026-09-01T08:00:00.000Z' });

    // Les deux passent par le SECOND argument, jamais par le payload (R-08).
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload).toEqual({ taskId: 't-1', body: 'Il manque la facture', mentions: ['u-2'] });
  });

  it('ne transmet JAMAIS l auteur', async () => {
    // `author_id` reste posé par le serveur depuis la session : restaurer ne
    // doit pas permettre d'écrire au nom de quelqu'un d'autre.
    const { result } = renderHook(() => useRestoreComment('t-1'), { wrapper: wrapper() });
    act(() => { result.current.mutate(comment); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [payload, options] = repo.addComment.mock.calls[0];
    expect(payload).not.toHaveProperty('authorId');
    expect(options).not.toHaveProperty('authorId');
  });

  it('un echec ne passe PAS en silence', async () => {
    // `console.error` est supprimé du bundle de production : un « Annuler »
    // raté y serait totalement muet.
    const { toast } = await import('sonner');
    repo.addComment.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useRestoreComment('t-1'), { wrapper: wrapper() });
    act(() => { result.current.mutate(comment); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalled();
  });
});

describe('les deux depots acceptent la restauration a l identique', () => {
  it('la whitelist du depot Supabase reste EXPLICITE', async () => {
    // On n'étend pas le spread de l'input : on ajoute deux champs nommés. La
    // garde anti mass-assignment (V1) ne doit pas se relâcher pour un
    // « Annuler ».
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(
      join(process.cwd(), 'src/modules/team-projects/supabase.repository.ts'),
      'utf-8',
    );
    expect(src).toContain('...(options?.restoreId ? { id: options.restoreId } : {})');
    expect(src).toContain('...(options?.restoreCreatedAt ? { created_at: options.restoreCreatedAt } : {})');
    // `author_id` vient toujours de la session, jamais de l'input.
    expect(src).toContain('author_id: uid,');
  });

  it('le depot local applique la MEME regle', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(
      join(process.cwd(), 'src/modules/team-projects/local.repository.ts'),
      'utf-8',
    );
    expect(src).toContain('id: options?.restoreId ?? `comment-${Date.now()}`');
    expect(src).toContain('createdAt: options?.restoreCreatedAt ?? new Date().toISOString()');
  });
});
