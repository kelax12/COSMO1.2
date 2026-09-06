// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const fakeRepo = {
  getAll: vi.fn(),
  create: vi.fn(),
};

vi.mock('@/lib/repository.factory', () => ({ getKRCompletionsRepository: () => fakeRepo }));
vi.mock('@/lib/app-mode.store', () => ({ useIsDemo: () => true }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { useKRCompletions } from './hooks';
import type { KRCompletion } from './types';

const completion: KRCompletion = {
  id: 'c1', krId: 'kr1', okrId: 'o1', userId: 'u1',
  completedAt: '2026-06-01T10:00:00.000Z', krTitle: 'KR', okrTitle: 'OKR',
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
});

describe('useKRCompletions', () => {
  it('fetches the append-only journal', async () => {
    fakeRepo.getAll.mockResolvedValue([completion]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useKRCompletions(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([completion]);
  });

  it('does not fetch when disabled', () => {
    fakeRepo.getAll.mockResolvedValue([]);
    const { wrapper } = makeWrapper();
    renderHook(() => useKRCompletions({ enabled: false }), { wrapper });
    expect(fakeRepo.getAll).not.toHaveBeenCalled();
  });
});

// 🗑️ Le bloc `useCreateKRCompletion` a ete retire le 2026-09-05 (C-49) avec le
// hook : c'etait un INSERT client libre dans un journal append-only, ce que ce
// depot interdit par ailleurs. Les completions s'ecrivent par le repository OKR
// (`recordKRCompletion`, `restoreCompletions`), jamais depuis un composant.
