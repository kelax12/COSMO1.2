// @vitest-environment jsdom
// Couverture métier (audit P0a) : liens d'invitation de partage (share_links).
// Helpers purs (validation token, URL) + get-or-create + claim RPC.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});

import {
  isValidInviteToken,
  buildInviteUrl,
  useShareLink,
  useClaimShareLink,
} from './share-link.hooks';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { wrapper };
}

beforeEach(() => supabaseMock.reset());

describe('helpers purs', () => {
  it('isValidInviteToken accepte un UUID, rejette le reste', () => {
    expect(isValidInviteToken('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isValidInviteToken('pas-un-uuid')).toBe(false);
    expect(isValidInviteToken(undefined)).toBe(false);
    expect(isValidInviteToken(null)).toBe(false);
  });

  it('buildInviteUrl construit /invite/<token>', () => {
    expect(buildInviteUrl('abc')).toBe(`${window.location.origin}/invite/abc`);
  });
});

describe('useShareLink (get-or-create)', () => {
  it('réutilise un lien non expiré existant', async () => {
    supabaseMock.queueTable('share_links', { data: { id: 'link-1', expires_at: '2999-01-01' } });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useShareLink('task-1', true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('link-1');
  });

  it('crée un lien si aucun existant', async () => {
    supabaseMock.queueTable('share_links', { data: null }); // select → rien
    supabaseMock.queueTable('share_links', { data: { id: 'link-new' } }); // insert
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useShareLink('task-1', true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('link-new');
    const insert = supabaseMock.callsFor('share_links', 1).find((c) => c.method === 'insert');
    expect(insert).toBeDefined();
  });

  it('ne s’exécute pas tant que enabled=false', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useShareLink('task-1', false), { wrapper });
    // fetchStatus idle → la query n'est jamais partie.
    expect(result.current.fetchStatus).toBe('idle');
    expect(supabaseMock.callsFor('share_links')).toHaveLength(0);
  });
});

describe('useClaimShareLink', () => {
  it('appelle la RPC claim_share_link et renvoie le résultat', async () => {
    supabaseMock.queueRpc('claim_share_link', {
      data: { task_id: 't1', task_name: 'T', owner_name: 'Alice', owner_avatar: null, already_accepted: false },
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useClaimShareLink(), { wrapper });
    const res = await result.current.mutateAsync('tok');
    expect(res.task_id).toBe('t1');
    expect(supabaseMock.rpcCalls.map((c) => c.fn)).toContain('claim_share_link');
  });
});
