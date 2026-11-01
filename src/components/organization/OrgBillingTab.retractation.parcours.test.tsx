// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Rétractation et résiliation (décision du 2026-11-01), parcours client
// ═══════════════════════════════════════════════════════════════════
//
// Exécute le composant réel et les hooks réels contre un
// `supabase.functions.invoke` intercepté. La moitié SERVEUR (Stripe, emails,
// `org_withdrawals`) n'est pas couverte ici.
//
// Ce qui est prouvé :
//   • « Se rétracter du contrat ici » est visible pendant 14 jours, puis masqué ;
//   • la rétractation passe par un récapitulatif puis un second bouton ;
//   • la résiliation tient en UNE confirmation et n'appelle jamais de
//     remboursement (`stripe-org-refund` n'est appelé par aucun parcours) ;
//   • le paiement exige la case d'accès immédiat, et l'envoie avec la version
//     des CGV.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';

vi.mock('@/modules/billing/premium-config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/billing/premium-config')>()),
  ENTERPRISE_BILLING_ENFORCED: true,
}));

const invoke = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'jwt-de-test' } } }),
    },
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
  },
  isSupabaseConfigured: true,
}));

vi.mock('@/modules/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-0', email: 'owner@acme.fr', name: 'Ada Owner' } }),
}));
vi.mock('@/modules/organizations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/organizations')>()),
  useActiveOrganization: () => ({ activeOrg: { id: 'org-1', ownerId: 'u-0' } }),
  useOrgMembers: () => ({ data: [] }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const DAY = 24 * 3600 * 1000;
let startedAt = new Date(Date.now() - 2 * DAY).toISOString();
let cancelAtPeriodEnd = false;
vi.mock('@/modules/billing/org-billing.repository', () => ({
  getOrgSubscription: async () => ({
    orgId: 'org-1',
    tierKey: 't10',
    status: 'active',
    maxMembers: 10,
    billingInterval: 'monthly',
    currentPeriodEnd: new Date(Date.now() + 28 * DAY).toISOString(),
    discountCode: null,
    startedAt,
    cancelAtPeriodEnd,
  }),
}));
vi.mock('@/modules/billing/org-billing-account.repository', () => ({
  getOrgBillingHistory: async () => [],
  getOrgBillingContact: async () => null,
}));

import { appModeStore } from '@/lib/app-mode.store';
import { OrgBillingTab } from './OrgBillingTab';
import { withdrawalOpen } from '@/modules/billing/withdrawal-window';
import { CGV_VERSION } from '@/modules/billing/cgv-version';

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <OrgBillingTab orgId="org-1" isOwner />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const WITHDRAW = /se rétracter du contrat ici/i;
const CANCEL = /résilier mon abonnement/i;

function calledFns(): string[] {
  return invoke.mock.calls.map((c) => c[0] as string);
}

describe('rétractation : visible 14 jours, récapitulatif puis confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appModeStore.setDemo(false);
    startedAt = new Date(Date.now() - 2 * DAY).toISOString();
    cancelAtPeriodEnd = false;
  });

  it('withdrawalOpen : ouverte avant J+14, fermée après, fermée sans date', () => {
    const now = Date.now();
    expect(withdrawalOpen(new Date(now - 13 * DAY).toISOString(), now)).toBe(true);
    expect(withdrawalOpen(new Date(now - 14 * DAY).toISOString(), now)).toBe(false);
    expect(withdrawalOpen(null, now)).toBe(false);
  });

  it('le bouton est masqué après 14 jours, la résiliation reste', async () => {
    startedAt = new Date(Date.now() - 20 * DAY).toISOString();
    renderTab();
    await screen.findByRole('button', { name: CANCEL });
    expect(screen.queryByRole('button', { name: WITHDRAW })).toBeNull();
  });

  it('récapitulatif prérempli, montant du SERVEUR, puis « Confirmer la rétractation »', async () => {
    invoke.mockImplementation(async (_fn: string, { body }: { body: { action: string } }) =>
      body.action === 'withdrawal_preview'
        ? { data: { eligible: true, amountCents: 1933, deadline: '', recipient: 'owner@acme.fr' }, error: null }
        : { data: { ok: true, amountCents: 1933 }, error: null },
    );
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: WITHDRAW }));

    await screen.findByText('19,33 €');
    expect(screen.getByText('Ada Owner')).toBeTruthy();
    expect(screen.getByText('owner@acme.fr')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /confirmer la rétractation/i }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    const withdraw = invoke.mock.calls.find((c) => (c[1] as { body: { action: string } }).body.action === 'withdraw');
    expect(withdraw?.[0]).toBe('stripe-org-subscription');
    // 🔴 Le client ne choisit jamais un montant.
    expect(JSON.stringify(withdraw?.[1])).not.toMatch(/amount|cents/i);
    expect(calledFns()).not.toContain('stripe-org-refund');
  });
});

describe('résiliation : une seule confirmation, jamais de remboursement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appModeStore.setDemo(false);
    startedAt = new Date(Date.now() - 40 * DAY).toISOString();
    cancelAtPeriodEnd = false;
  });

  it('un clic, une page qui dit « aucun remboursement », un bouton, un appel `cancel`', async () => {
    invoke.mockResolvedValue({ data: { ok: true, cancelAtPeriodEnd: true }, error: null });
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: CANCEL }));

    expect(screen.getByText(/aucun remboursement n'est effectué/i)).toBeTruthy();
    // Pas de case à cocher dans la confirmation.
    const panel = screen.getByRole('region', { name: /résiliation de l'abonnement/i });
    expect(panel.querySelector('input[type="checkbox"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /confirmer la résiliation/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    const [fn, opts] = invoke.mock.calls[0] as [string, { body: unknown }];
    expect(fn).toBe('stripe-org-subscription');
    expect(opts.body).toEqual({ orgId: 'org-1', action: 'cancel' });
    expect(calledFns()).not.toContain('stripe-org-refund');
  });

  it('résiliation programmée : on peut l annuler', async () => {
    cancelAtPeriodEnd = true;
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /annuler la résiliation/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect((invoke.mock.calls[0][1] as { body: unknown }).body).toEqual({ orgId: 'org-1', action: 'resume' });
  });
});

describe('paiement : case d accès immédiat obligatoire', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appModeStore.setDemo(false);
  });

  it('la case est décochée par défaut et son libellé reprend la consigne', async () => {
    renderTab();
    const box = await screen.findByRole('checkbox', { name: /je demande l'accès immédiat au service/i });
    expect((box as HTMLInputElement).checked).toBe(false);
  });

  it('case cochée : le checkout part avec immediateAccess et la version des CGV', async () => {
    invoke.mockResolvedValue({ data: { url: 'https://checkout.stripe.test/x' }, error: null });
    renderTab();
    fireEvent.click(await screen.findByRole('checkbox', { name: /je demande l'accès immédiat au service/i }));
    const choose = await screen.findAllByRole('button', { name: /choisir ce palier/i });
    fireEvent.click(choose[0]);
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    const [fn, opts] = invoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(fn).toBe('stripe-org-checkout');
    expect(opts.body.immediateAccess).toBe(true);
    expect(opts.body.cgvVersion).toBe(CGV_VERSION);
  });
});
