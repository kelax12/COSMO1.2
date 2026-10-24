// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Mutations de facturation ORG : paiement, remboursement, portail.
//
// 🔴 CE QUE CES TESTS VERROUILLENT, et qui n'avait aucun test côté client :
//   1. le code métier est lu dans le CORPS d'une réponse d'Edge Function en
//      échec, jamais dans le message générique de `invoke` ;
//   2. le remboursement ne part qu'UNE fois par clic, même sous un
//      `QueryClient` qui rejoue les mutations (`retry: 1` dans l'app) ;
//   3. le montant affiché est celui que rend le SERVEUR ;
//   4. un échec ne redirige jamais.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { invoke, getSession, toastError, toastSuccess } = vi.hoisted(() => ({
  invoke: vi.fn(),
  getSession: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke }, auth: { getSession } },
}));
vi.mock('@/lib/toast', () => ({ toast: { error: toastError, success: toastSuccess } }));
vi.mock('@/i18n/useT', () => ({
  translator: () => ({
    t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key),
  }),
}));

import { useStartOrgCheckout, useCancelAndRefundOrg, useOpenOrgPortal } from './org-billing.mutations';

/** Le `QueryClient` de l'app rejoue les mutations une fois : on le reproduit. */
function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: 1, retryDelay: 0 } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return wrapper;
}

/** Erreur `FunctionsHttpError` : le corps JSON est dans `context`, une Response. */
const httpError = (body: unknown) => ({
  message: 'Edge Function returned a non-2xx status code',
  context: new Response(JSON.stringify(body), { status: 400 }),
});

const checkoutInput = {
  orgId: 'org-1',
  tierKey: 'team' as never,
  immediateExecution: true,
  waivesWithdrawal: true,
};

let hrefSet: ReturnType<typeof vi.fn<(url: string) => void>>;

beforeEach(() => {
  invoke.mockReset();
  getSession.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
  hrefSet = vi.fn<(url: string) => void>();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      get href() { return 'http://localhost/'; },
      set href(v: string) { hrefSet(v); },
    },
  });
});

describe('useStartOrgCheckout', () => {
  it('envoie les deux accords au serveur et redirige vers l’URL renvoyée', async () => {
    invoke.mockResolvedValue({ data: { url: 'https://checkout.stripe.com/x' }, error: null });
    const { result } = renderHook(() => useStartOrgCheckout(), { wrapper: makeWrapper() });

    await act(() => result.current.mutateAsync({ ...checkoutInput, interval: 'year' as never }));

    expect(invoke).toHaveBeenCalledWith('stripe-org-checkout', {
      headers: { Authorization: 'Bearer tok' },
      body: { orgId: 'org-1', tierKey: 'team', interval: 'year', immediateExecution: true, waivesWithdrawal: true },
    });
    expect(hrefSet).toHaveBeenCalledWith('https://checkout.stripe.com/x');
  });

  it('lit le code métier dans le CORPS de la réponse en échec, pas dans le message', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError({ error: 'yearly_unavailable' }) });
    const { result } = renderHook(() => useStartOrgCheckout(), { wrapper: makeWrapper() });

    await act(async () => { result.current.mutate(checkoutInput); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toastError).toHaveBeenCalledWith('billing.yearlyUnavailable');
    expect(hrefSet).not.toHaveBeenCalled();
  });

  it('un corps non JSON retombe sur le message générique, sans lever', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { message: 'x', context: new Response('<html>', { status: 502 }) },
    });
    const { result } = renderHook(() => useStartOrgCheckout(), { wrapper: makeWrapper() });

    await act(async () => { result.current.mutate(checkoutInput); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toastError).toHaveBeenCalledWith('billing.error');
  });

  it('un `error` dans un 200 est un refus, pas une redirection', async () => {
    invoke.mockResolvedValue({ data: { error: 'already_subscribed' }, error: null });
    const { result } = renderHook(() => useStartOrgCheckout(), { wrapper: makeWrapper() });

    await act(async () => { result.current.mutate(checkoutInput); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toastError).toHaveBeenCalledWith('billing.alreadySubscribed');
    expect(hrefSet).not.toHaveBeenCalled();
  });

  it('une réponse sans URL ne redirige nulle part', async () => {
    invoke.mockResolvedValue({ data: {}, error: null });
    const { result } = renderHook(() => useStartOrgCheckout(), { wrapper: makeWrapper() });

    await act(async () => { result.current.mutate(checkoutInput); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(hrefSet).not.toHaveBeenCalled();
  });

  it('sans session, n’appelle jamais Stripe', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const { result } = renderHook(() => useStartOrgCheckout(), { wrapper: makeWrapper() });

    await act(async () => { result.current.mutate(checkoutInput); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('useCancelAndRefundOrg', () => {
  it('🔴 un échec n’appelle stripe-org-refund qu’UNE fois, malgré retry: 1 global', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError({ error: 'refund_failed' }) });
    const { result } = renderHook(() => useCancelAndRefundOrg(), { wrapper: makeWrapper() });

    await act(async () => { result.current.mutate({ orgId: 'org-1' }); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith('billing.refundFailed');
  });

  it('affiche le montant rendu par le SERVEUR, en euros', async () => {
    invoke.mockResolvedValue({ data: { refundedCents: 2150 }, error: null });
    const onDone = vi.fn();
    const { result } = renderHook(() => useCancelAndRefundOrg(onDone), { wrapper: makeWrapper() });

    await act(() => result.current.mutateAsync({ orgId: 'org-1' }));

    expect(invoke).toHaveBeenCalledWith('stripe-org-refund', {
      headers: { Authorization: 'Bearer tok' },
      body: { orgId: 'org-1' },
    });
    expect(toastSuccess).toHaveBeenCalledWith('billing.refundDone:{"amount":"21.50"}');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('rien à rendre : annonce une résiliation, jamais un remboursement de 0,00', async () => {
    invoke.mockResolvedValue({ data: { refundedCents: 0 }, error: null });
    const { result } = renderHook(() => useCancelAndRefundOrg(), { wrapper: makeWrapper() });

    await act(() => result.current.mutateAsync({ orgId: 'org-1' }));

    expect(toastSuccess).toHaveBeenCalledWith('billing.cancelDone');
  });

  it('un refus `no_subscription` a son propre message', async () => {
    invoke.mockResolvedValue({ data: { error: 'no_subscription' }, error: null });
    const { result } = renderHook(() => useCancelAndRefundOrg(), { wrapper: makeWrapper() });

    await act(async () => { result.current.mutate({ orgId: 'org-1' }); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toastError).toHaveBeenCalledWith('billing.noSubscription');
  });
});

describe('useOpenOrgPortal', () => {
  it('redirige vers le portail Stripe', async () => {
    invoke.mockResolvedValue({ data: { url: 'https://billing.stripe.com/p' }, error: null });
    const { result } = renderHook(() => useOpenOrgPortal(), { wrapper: makeWrapper() });

    await act(() => result.current.mutateAsync({ orgId: 'org-1' }));

    expect(invoke).toHaveBeenCalledWith('stripe-org-portal', expect.objectContaining({ body: { orgId: 'org-1' } }));
    expect(hrefSet).toHaveBeenCalledWith('https://billing.stripe.com/p');
  });
});
