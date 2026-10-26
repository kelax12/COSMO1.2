// @vitest-environment jsdom
// Hook de lecture de l'abonnement d'organisation. Verrouille : une org de
// démo ne déclenche AUCUNE requête et vaut le palier gratuit (`null`), et le
// hook reste inactif tant que l'org n'est pas connue.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { getOrgSubscription, isDemo } = vi.hoisted(() => ({
  getOrgSubscription: vi.fn(),
  isDemo: { value: false },
}));

vi.mock('./org-billing.repository', () => ({ getOrgSubscription }));
vi.mock('@/lib/app-mode.store', () => ({ useIsDemo: () => isDemo.value }));

import { orgBillingKeys, useOrgSubscription } from './org-billing.hooks';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => {
  getOrgSubscription.mockReset();
  isDemo.value = false;
});

describe('orgBillingKeys', () => {
  it('range l’abonnement sous le préfixe org-billing', () => {
    expect(orgBillingKeys.all).toEqual(['org-billing']);
    expect(orgBillingKeys.subscription('org-1')).toEqual(['org-billing', 'subscription', 'org-1']);
  });
});

describe('useOrgSubscription', () => {
  it('lit l’abonnement de l’org en production', async () => {
    const sub = { orgId: 'org-1', tierKey: 't10', status: 'active' };
    getOrgSubscription.mockResolvedValue(sub);
    const { qc, wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgSubscription('org-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sub);
    expect(getOrgSubscription).toHaveBeenCalledWith('org-1');
    expect(qc.getQueryData(orgBillingKeys.subscription('org-1'))).toEqual(sub);
  });

  it('démo : null sans aucun appel au repository', async () => {
    isDemo.value = true;
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgSubscription('org-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(getOrgSubscription).not.toHaveBeenCalled();
  });

  it('org inconnue : la requête ne part pas', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgSubscription(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getOrgSubscription).not.toHaveBeenCalled();
  });

  it('expose l’erreur du repository', async () => {
    getOrgSubscription.mockRejectedValue(new Error('boom'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgSubscription('org-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('boom');
  });
});
