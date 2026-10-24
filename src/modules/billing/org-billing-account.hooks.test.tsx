// @vitest-environment jsdom
// Hooks de l'historique et du contact de facturation (mig. 180). Verrouille :
//   1. lecture réservée au propriétaire (`enabled` porte `isOwner`) ;
//   2. démo : aucun appel réseau, contact en `localStorage` par organisation ;
//   3. `input: null` SUPPRIME le contact, il ne l'écrit pas vide ;
//   4. le cache est mis à jour avec ce que rend la mutation.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const repo = vi.hoisted(() => ({
  getOrgBillingHistory: vi.fn(),
  getOrgBillingContact: vi.fn(),
  saveOrgBillingContact: vi.fn(),
  deleteOrgBillingContact: vi.fn(),
}));
const isDemo = vi.hoisted(() => ({ value: false }));

vi.mock('./org-billing-account.repository', () => repo);
vi.mock('@/lib/app-mode.store', () => ({ useIsDemo: () => isDemo.value }));

import {
  orgBillingAccountKeys,
  useOrgBillingContact,
  useOrgBillingHistory,
  useSaveOrgBillingContact,
} from './org-billing-account.hooks';

const DEMO_KEY = 'cosmo_demo_org_billing_contact_org-1';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => {
  Object.values(repo).forEach((fn) => fn.mockReset());
  isDemo.value = false;
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('orgBillingAccountKeys', () => {
  it('partage le préfixe org-billing', () => {
    expect(orgBillingAccountKeys.history('org-1')).toEqual(['org-billing', 'history', 'org-1']);
    expect(orgBillingAccountKeys.contact('org-1')).toEqual(['org-billing', 'contact', 'org-1']);
  });
});

describe('useOrgBillingHistory', () => {
  it('propriétaire en production : lit l’historique de l’org', async () => {
    const entries = [{ id: 1, eventType: 'invoice.paid', amountCents: 2000 }];
    repo.getOrgBillingHistory.mockResolvedValue(entries);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgBillingHistory('org-1', true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(entries);
    expect(repo.getOrgBillingHistory).toHaveBeenCalledWith('org-1');
  });

  it('non-propriétaire : la requête ne part pas (la RPC rendrait 42501)', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgBillingHistory('org-1', false), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(repo.getOrgBillingHistory).not.toHaveBeenCalled();
  });

  it('org inconnue : la requête ne part pas', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgBillingHistory(undefined, true), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('démo : historique vide sans appel', async () => {
    isDemo.value = true;
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgBillingHistory('org-1', true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(repo.getOrgBillingHistory).not.toHaveBeenCalled();
  });
});

describe('useOrgBillingContact', () => {
  it('propriétaire en production : lit le contact', async () => {
    const contact = { orgId: 'org-1', name: 'Compta', email: 'compta@acme.test' };
    repo.getOrgBillingContact.mockResolvedValue(contact);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgBillingContact('org-1', true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(contact);
    expect(repo.getOrgBillingContact).toHaveBeenCalledWith('org-1');
  });

  it('non-propriétaire : la requête ne part pas', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgBillingContact('org-1', false), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(repo.getOrgBillingContact).not.toHaveBeenCalled();
  });

  it('démo : lit le contact posé en localStorage pour cette org', async () => {
    isDemo.value = true;
    const contact = { orgId: 'org-1', name: null, email: 'demo@acme.test' };
    localStorage.setItem(DEMO_KEY, JSON.stringify(contact));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgBillingContact('org-1', true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(contact);
    expect(repo.getOrgBillingContact).not.toHaveBeenCalled();
  });

  it('démo : null quand rien n’est enregistré ou que la valeur est corrompue', async () => {
    isDemo.value = true;
    localStorage.setItem(DEMO_KEY, '{pas du json');
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgBillingContact('org-1', true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

describe('useSaveOrgBillingContact', () => {
  it('production : enregistre via le repository, avec l’auteur, et met le cache à jour', async () => {
    const saved = { orgId: 'org-1', name: 'Compta', email: 'compta@acme.test' };
    repo.saveOrgBillingContact.mockResolvedValue(saved);
    const { qc, wrapper } = makeWrapper();
    const { result } = renderHook(() => useSaveOrgBillingContact('org-1', 'user-1'), { wrapper });

    await act(() => result.current.mutateAsync({ name: 'Compta', email: 'compta@acme.test' }));

    expect(repo.saveOrgBillingContact).toHaveBeenCalledWith(
      'org-1',
      { name: 'Compta', email: 'compta@acme.test' },
      'user-1',
    );
    expect(repo.deleteOrgBillingContact).not.toHaveBeenCalled();
    expect(qc.getQueryData(orgBillingAccountKeys.contact('org-1'))).toEqual(saved);
  });

  it('production : input null supprime le contact et vide le cache', async () => {
    repo.deleteOrgBillingContact.mockResolvedValue(undefined);
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(orgBillingAccountKeys.contact('org-1'), { orgId: 'org-1', name: null, email: 'a@b.test' });
    const { result } = renderHook(() => useSaveOrgBillingContact('org-1', 'user-1'), { wrapper });

    await act(() => result.current.mutateAsync(null));

    expect(repo.deleteOrgBillingContact).toHaveBeenCalledWith('org-1');
    expect(repo.saveOrgBillingContact).not.toHaveBeenCalled();
    expect(qc.getQueryData(orgBillingAccountKeys.contact('org-1'))).toBeNull();
  });

  it('production : une erreur du repository remonte et laisse le cache intact', async () => {
    repo.saveOrgBillingContact.mockRejectedValue(new Error('rls'));
    const before = { orgId: 'org-1', name: null, email: 'old@acme.test' };
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(orgBillingAccountKeys.contact('org-1'), before);
    const { result } = renderHook(() => useSaveOrgBillingContact('org-1', undefined), { wrapper });

    await expect(
      act(() => result.current.mutateAsync({ name: null, email: 'new@acme.test' })),
    ).rejects.toThrow('rls');
    expect(qc.getQueryData(orgBillingAccountKeys.contact('org-1'))).toEqual(before);
  });

  it('démo : écrit en localStorage, sans appel réseau', async () => {
    isDemo.value = true;
    const { qc, wrapper } = makeWrapper();
    const { result } = renderHook(() => useSaveOrgBillingContact('org-1', undefined), { wrapper });

    await act(() => result.current.mutateAsync({ name: 'Démo', email: 'demo@acme.test' }));

    const expected = { orgId: 'org-1', name: 'Démo', email: 'demo@acme.test' };
    expect(JSON.parse(localStorage.getItem(DEMO_KEY) ?? 'null')).toEqual(expected);
    expect(qc.getQueryData(orgBillingAccountKeys.contact('org-1'))).toEqual(expected);
    expect(repo.saveOrgBillingContact).not.toHaveBeenCalled();
  });

  it('démo : input null retire la clé localStorage', async () => {
    isDemo.value = true;
    localStorage.setItem(DEMO_KEY, JSON.stringify({ orgId: 'org-1', name: null, email: 'x@y.test' }));
    const { qc, wrapper } = makeWrapper();
    const { result } = renderHook(() => useSaveOrgBillingContact('org-1', undefined), { wrapper });

    await act(() => result.current.mutateAsync(null));

    expect(localStorage.getItem(DEMO_KEY)).toBeNull();
    expect(qc.getQueryData(orgBillingAccountKeys.contact('org-1'))).toBeNull();
    expect(repo.deleteOrgBillingContact).not.toHaveBeenCalled();
  });

  it('démo : localStorage indisponible, la mutation réussit quand même', async () => {
    isDemo.value = true;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { result } = renderHook(() => useSaveOrgBillingContact('org-1', undefined), {
      wrapper: makeWrapper().wrapper,
    });
    await expect(
      act(() => result.current.mutateAsync({ name: null, email: 'demo@acme.test' })),
    ).resolves.toEqual({ orgId: 'org-1', name: null, email: 'demo@acme.test' });
  });
});
