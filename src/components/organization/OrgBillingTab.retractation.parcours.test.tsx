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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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
const toastInfo = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    warning: vi.fn(),
    info: (...a: unknown[]) => toastInfo(...a),
  },
}));

const DAY = 24 * 3600 * 1000;
let startedAt = new Date(Date.now() - 2 * DAY).toISOString();
let cancelAtPeriodEnd = false;
let noPeriodEnd = false;
// Un `vi.fn` : le test de délai compte les lectures pour prouver que le
// sondage s'ARRÊTE. `vi.clearAllMocks` vide les appels, garde l'implémentation.
const getOrgSubscription = vi.fn(async (_orgId: string) => ({
  orgId: 'org-1',
  tierKey: 't10',
  status: 'active',
  maxMembers: 10,
  billingInterval: 'monthly',
  currentPeriodEnd: noPeriodEnd ? null : new Date(Date.now() + 28 * DAY).toISOString(),
  discountCode: null,
  startedAt,
  cancelAtPeriodEnd,
}));
vi.mock('@/modules/billing/org-billing.repository', () => ({
  getOrgSubscription: (orgId: string) => getOrgSubscription(orgId),
}));
vi.mock('@/modules/billing/org-billing-account.repository', () => ({
  getOrgBillingHistory: async () => [],
  getOrgBillingContact: async () => null,
}));

import { appModeStore } from '@/lib/app-mode.store';
import { loadSonner } from '@/lib/toast';
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

const RECAP = /vérifier avant de payer/i;
const BOX = /je demande l'accès immédiat au service/i;
const PAY = /payer .* avec stripe/i;

/** L'abonnement t10 est LU : la carte « Votre forfait » le dit actif. */
async function waitForSubscription() {
  const card = await screen.findByRole('region', { name: /votre forfait/i });
  await within(card).findByText('Actif');
}

function renderTabAt(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={qc}>
        <OrgBillingTab orgId="org-1" isOwner />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('retour de Stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appModeStore.setDemo(false);
    sessionStorage.clear();
    startedAt = new Date(Date.now() - 2 * DAY).toISOString();
    cancelAtPeriodEnd = false;
    noPeriodEnd = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('abonnement déjà actif sur le palier attendu : bienvenue, sans toast', async () => {
    sessionStorage.setItem('cosmo_pending_checkout', JSON.stringify({ orgId: 'org-1', tierKey: 't10', interval: 'monthly', at: Date.now() }));
    renderTabAt('/?checkout=success');
    await waitFor(() => expect(screen.getByText(/bienvenue dans le palier/i)).toBeTruthy());
    // La façade charge sonner en différé : un toast demandé serait rejoué ici.
    await loadSonner();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('cosmo_pending_checkout')).toBeNull();
  });

  it('palier attendu pas encore actif : activation en cours, même abonnement lu', async () => {
    sessionStorage.setItem('cosmo_pending_checkout', JSON.stringify({ orgId: 'org-1', tierKey: 't50', interval: 'monthly', at: Date.now() }));
    renderTabAt('/?checkout=success');
    await waitForSubscription();
    expect(screen.getByText(/activation en cours/i)).toBeTruthy();
  });

  it('pendant l attente, aucun palier ne peut être choisi (pas de second paiement)', async () => {
    sessionStorage.setItem('cosmo_pending_checkout', JSON.stringify({ orgId: 'org-1', tierKey: 't50', interval: 'monthly', at: Date.now() }));
    renderTabAt('/?checkout=success');
    await waitForSubscription();
    await screen.findByText(/activation en cours/i);
    expect(screen.queryAllByRole('button', { name: /choisir ce palier/i })).toHaveLength(0);
    expect(screen.queryByRole('region', { name: RECAP })).toBeNull();
  });

  it('délai dépassé : un message, et le sondage s arrête', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    sessionStorage.setItem('cosmo_pending_checkout', JSON.stringify({ orgId: 'org-1', tierKey: 't50', interval: 'monthly', at: Date.now() }));
    renderTabAt('/?checkout=success');
    await screen.findByText(/activation en cours/i);
    await vi.advanceTimersByTimeAsync(21_000);
    expect(await screen.findByText(/rechargez la page/i)).toBeTruthy();
    const reads = getOrgSubscription.mock.calls.length;
    expect(reads).toBeGreaterThan(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(getOrgSubscription.mock.calls.length).toBe(reads);
  });

  it('paiement abandonné : un toast d information, trace effacée', async () => {
    sessionStorage.setItem('cosmo_pending_checkout', JSON.stringify({ orgId: 'org-1', tierKey: 't50', interval: 'monthly', at: Date.now() }));
    renderTabAt('/?checkout=cancelled');
    await waitFor(() => expect(toastInfo).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem('cosmo_pending_checkout')).toBeNull();
  });

  it('?tier=t50 ouvre le récapitulatif, case non cochée', async () => {
    renderTabAt('/?tier=t50');
    await waitForSubscription();
    const recap = await screen.findByRole('region', { name: RECAP });
    const box = within(recap).getByRole('checkbox', { name: BOX }) as HTMLInputElement;
    expect(box.checked).toBe(false);
  });

  it('?tier=free n ouvre rien', async () => {
    renderTabAt('/?tier=free');
    await waitForSubscription();
    await screen.findAllByRole('button', { name: /choisir ce palier/i });
    expect(screen.queryByRole('region', { name: RECAP })).toBeNull();
  });

  it('?tier= sur le palier déjà souscrit n ouvre rien', async () => {
    renderTabAt('/?tier=t10');
    await waitForSubscription();
    await waitFor(() => expect(screen.queryByRole('region', { name: RECAP })).toBeNull());
  });
});

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
    noPeriodEnd = false;
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
    noPeriodEnd = false;
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
    fireEvent.click(await screen.findByRole('button', { name: /reprendre mon abonnement/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect((invoke.mock.calls[0][1] as { body: unknown }).body).toEqual({ orgId: 'org-1', action: 'resume' });
  });

  it('résiliation programmée sans date de fin lue : aucune date vide affichée', async () => {
    cancelAtPeriodEnd = true;
    noPeriodEnd = true;
    renderTab();
    expect(await screen.findByText(/s'arrête en fin de période/i)).toBeTruthy();
    expect(screen.queryByRole('list', { name: /fin de l'abonnement/i })).toBeNull();
    expect(screen.getByRole('button', { name: /reprendre mon abonnement/i })).toBeTruthy();
  });
});

describe('paiement : case d accès immédiat, une fois le palier choisi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appModeStore.setDemo(false);
    sessionStorage.clear();
    startedAt = new Date(Date.now() - 2 * DAY).toISOString();
    cancelAtPeriodEnd = false;
    noPeriodEnd = false;
  });

  /** Choisit le premier palier cliquable une fois l'abonnement t10 lu : t20. */
  async function chooseFirstTier() {
    await waitForSubscription();
    const choose = await screen.findAllByRole('button', { name: /choisir ce palier/i });
    fireEvent.click(choose[0]);
  }

  it('aucune case avant le choix du palier ; choisir un palier n appelle pas Stripe', async () => {
    renderTab();
    await screen.findAllByRole('button', { name: /choisir ce palier/i });
    expect(screen.queryByRole('checkbox', { name: BOX })).toBeNull();
    await chooseFirstTier();
    const box = await screen.findByRole('checkbox', { name: BOX });
    expect((box as HTMLInputElement).checked).toBe(false);
    // Le bouton n'est plus grisé en silence : il explique, et ne paie pas.
    fireEvent.click(screen.getByRole('button', { name: PAY }));
    expect(screen.getByRole('alert').textContent).toMatch(/cochez la case/i);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('case cochée : le checkout part avec immediateAccess et la version des CGV', async () => {
    invoke.mockResolvedValue({ data: { url: 'https://checkout.stripe.test/x' }, error: null });
    renderTab();
    await chooseFirstTier();
    fireEvent.click(await screen.findByRole('checkbox', { name: BOX }));
    fireEvent.click(screen.getByRole('button', { name: PAY }));
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    const [fn, opts] = invoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(fn).toBe('stripe-org-checkout');
    expect(opts.body.immediateAccess).toBe(true);
    expect(opts.body.cgvVersion).toBe(CGV_VERSION);
  });

  it('avant la redirection, la trace du palier attendu est écrite', async () => {
    invoke.mockResolvedValue({ data: { url: 'https://checkout.stripe.test/x' }, error: null });
    renderTab();
    await chooseFirstTier();
    fireEvent.click(await screen.findByRole('checkbox', { name: BOX }));
    fireEvent.click(screen.getByRole('button', { name: PAY }));
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    const trace = JSON.parse(sessionStorage.getItem('cosmo_pending_checkout') ?? 'null');
    expect(trace?.orgId).toBe('org-1');
    expect(trace?.tierKey).toBe('t20');
    expect(trace?.interval).toBe('monthly');
  });

  it('retour arrière depuis Stripe (bfcache) : le récapitulatif revient, la trace est effacée', async () => {
    invoke.mockResolvedValue({ data: { url: 'https://checkout.stripe.test/x' }, error: null });
    renderTab();
    await chooseFirstTier();
    fireEvent.click(await screen.findByRole('checkbox', { name: BOX }));
    fireEvent.click(screen.getByRole('button', { name: PAY }));
    // Panneau de redirection : le récapitulatif n'est plus là.
    await waitFor(() => expect(screen.queryByRole('region', { name: RECAP })).toBeNull());
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(await screen.findByRole('region', { name: RECAP })).toBeTruthy();
    expect(sessionStorage.getItem('cosmo_pending_checkout')).toBeNull();
    // Demande expresse : à reposer, jamais reprise d'office.
    expect((screen.getByRole('checkbox', { name: BOX }) as HTMLInputElement).checked).toBe(false);
  });
});
