// @vitest-environment jsdom
// `useOrgInbox` : UNE lecture, sans organisation, sous `orgKeys.inbox()`.
// `useOrgBadgeTasks` : un sélecteur sur cette même lecture, jamais une
// requête de plus. Les règles du regroupement côté hooks d'annuaire sont
// gardées par `inbox.hooks.test.tsx`.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const fakeRepo = { getMyOrgInbox: vi.fn() };

vi.mock('@/lib/repository.factory', () => ({ getOrganizationsRepository: () => fakeRepo }));

import { useOrgInbox, useOrgBadgeTasks } from './inbox';
import { orgKeys } from './constants';

const badgeTasks = [
  { orgId: 'org-a', id: 't1', name: 'A', createdAt: 'c', kind: 'assigned' as const },
  { orgId: 'org-b', id: 't2', name: 'B', createdAt: 'c', kind: 'notified' as const },
  { orgId: 'org-a', id: 't3', name: 'C', createdAt: 'c', kind: 'notified' as const },
];
const inbox = { invitations: [], removalNotices: [], myJoinRequest: null, joinRequests: [], notifications: [], badgeTasks };

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => {
  fakeRepo.getMyOrgInbox.mockReset();
  fakeRepo.getMyOrgInbox.mockResolvedValue(inbox);
});

describe('useOrgInbox', () => {
  it('lit la boîte une fois, sans argument, sous la clé unique orgKeys.inbox()', async () => {
    const { qc, wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgInbox(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fakeRepo.getMyOrgInbox).toHaveBeenCalledTimes(1);
    expect(fakeRepo.getMyOrgInbox).toHaveBeenCalledWith();
    expect(qc.getQueryData(orgKeys.inbox())).toEqual(inbox);
    // Une seule entrée de cache : aucune clé par organisation.
    expect(qc.getQueryCache().getAll().map((q) => q.queryKey)).toEqual([orgKeys.inbox()]);
  });

  it('remonte l erreur du repository', async () => {
    fakeRepo.getMyOrgInbox.mockRejectedValue(new Error('boom'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgInbox(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('boom');
  });
});

describe('useOrgBadgeTasks', () => {
  it('filtre sur l organisation demandée, à partir de la MÊME lecture', async () => {
    const { qc, wrapper } = makeWrapper();
    const { result } = renderHook(() => ({ a: useOrgBadgeTasks('org-a'), b: useOrgBadgeTasks('org-b'), inbox: useOrgInbox() }), { wrapper });
    await waitFor(() => expect(result.current.inbox.isSuccess).toBe(true));
    expect(result.current.a.map((t) => t.id)).toEqual(['t1', 't3']);
    expect(result.current.b.map((t) => t.id)).toEqual(['t2']);
    expect(fakeRepo.getMyOrgInbox).toHaveBeenCalledTimes(1);
    expect(qc.getQueryCache().getAll()).toHaveLength(1);
  });

  it('sans organisation → liste vide', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => ({ none: useOrgBadgeTasks(undefined), inbox: useOrgInbox() }), { wrapper });
    await waitFor(() => expect(result.current.inbox.isSuccess).toBe(true));
    expect(result.current.none).toEqual([]);
  });

  it('avant la réponse, ou badgeTasks absent → liste vide', async () => {
    fakeRepo.getMyOrgInbox.mockResolvedValue({ ...inbox, badgeTasks: undefined });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => ({ a: useOrgBadgeTasks('org-a'), inbox: useOrgInbox() }), { wrapper });
    expect(result.current.a).toEqual([]);
    await waitFor(() => expect(result.current.inbox.isSuccess).toBe(true));
    expect(result.current.a).toEqual([]);
  });

  it('rend la même référence tant que la donnée ne change pas', async () => {
    const { wrapper } = makeWrapper();
    const { result, rerender } = renderHook(() => ({ a: useOrgBadgeTasks('org-a'), inbox: useOrgInbox() }), { wrapper });
    await waitFor(() => expect(result.current.inbox.isSuccess).toBe(true));
    const first = result.current.a;
    rerender();
    expect(result.current.a).toBe(first);
  });
});
