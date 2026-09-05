// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// C-65 / C-27 — le PARCOURS de remboursement, réellement exécuté
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 CE QUE CE FICHIER PROUVE, ET CE QU'IL NE PROUVE PAS. À lire avant d'en
// tirer une conclusion, parce que la moitié qui manque est celle qui touche à
// l'argent.
//
// C-27 exige nommément un parcours pour C-65 : « C-65 touche de l'argent, il
// ne part pas sans son parcours E2E ». Ce parcours-là — un vrai remboursement
// contre le compte Stripe — N'A PAS PU ÊTRE JOUÉ, et il faut dire pourquoi
// plutôt que de le laisser croire :
//
//   1. `ENTERPRISE_BILLING_ENFORCED` vaut `false`, donc le bouton n'est monté
//      NULLE PART dans le produit servi. Aucun test de bout en bout ne peut
//      cliquer un contrôle qui n'existe pas, et retourner le drapeau pour un
//      test violerait la règle écrite du dépôt (« le flag est la SEULE
//      condition ») en plus d'être une décision commerciale, pas technique.
//   2. `STRIPE_SECRET_KEY` en production est une clé de TEST, `org_subscriptions`
//      est vide, et rien n'a jamais été encaissé : il n'existe aucune facture à
//      rembourser.
//   3. `APP_URL` épingle l'origine CORS sur `https://thecosmo.app` : les Edge
//      Functions org ne répondent pas depuis un poste de développement.
//
// Ce fichier couvre donc la MOITIÉ CLIENT, et il l'exécute vraiment : le
// composant réel, le hook réel, un `supabase.functions.invoke` intercepté.
// C'est strictement plus que ce qui existait (`src/refund.guard.test.ts` est
// une garde TEXTUELLE, elle lit du source) et strictement moins que ce que
// C-27 demande. La moitié SERVEUR — `refunds.create`, l'annulation, la clé
// d'idempotence, la ligne compensatoire de `payment_records`, la chaîne de
// `verify_payment_chain()` — reste NON ÉPROUVÉE.
//
// ❌ Ne pas déployer C-65 en s'appuyant sur ce fichier. Il ferme la question
//    « l'écran fait-il partir la bonne requête et dit-il la vérité sur le
//    résultat », pas la question « Stripe rembourse-t-il, une seule fois ».
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';

// ── Le drapeau, retourné POUR CE FICHIER SEULEMENT ──────────────────
//
// ⚠️ `importOriginal` et non un objet écrit à la main : les paliers, les
// montants et `ORG_FREE_SEATS` doivent rester ceux du produit. Un module
// recopié ici deviendrait une seconde grille de tarifs, exactement ce que
// `org-tiers.parity.test.ts` existe pour empêcher.
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

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    warning: vi.fn(),
  },
}));

// L'abonnement payant : sans lui le bloc de remboursement n'est pas monté
// (`subscription.tierKey !== 'free'`), ce qui est le comportement voulu.
vi.mock('@/modules/billing/org-billing.repository', () => ({
  getOrgSubscription: async () => ({
    orgId: 'org-1',
    tierKey: 't10',
    status: 'active',
    maxMembers: 10,
    billingInterval: 'monthly',
    currentPeriodEnd: '2026-10-05T00:00:00.000Z',
    stripeCustomerId: 'cus_test',
    stripeSubscriptionId: 'sub_test',
  }),
}));

import { appModeStore } from '@/lib/app-mode.store';
import { OrgBillingTab } from './OrgBillingTab';

function renderTab(isOwner = true) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <OrgBillingTab orgId="org-1" isOwner={isOwner} memberCount={7} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const CTA = /résilier et être remboursé de la période en cours/i;

describe('C-65 — parcours client du remboursement (moitié serveur NON couverte)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `useOrgSubscription` court-circuite en démo et rend `null` : sans ça, le
    // bloc de remboursement n'est jamais monté et TOUS les cas ci-dessous
    // passeraient en ne mesurant rien.
    appModeStore.setDemo(false);
  });

  it('un clic envoie UN appel à `stripe-org-refund`, avec l’organisation et rien d’autre', async () => {
    invoke.mockResolvedValue({ data: { refundedCents: 2000 }, error: null });
    renderTab();

    const cta = await screen.findByRole('button', { name: CTA });
    fireEvent.click(cta);

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    const [fn, options] = invoke.mock.calls[0] as [string, { body: unknown; headers: unknown }];
    expect(fn).toBe('stripe-org-refund');
    // 🔴 Le corps ne porte AUCUN montant. C'est la règle du dépôt : le client
    // ne choisit jamais un prix, il désigne une organisation et le serveur
    // décide. Un montant envoyé d'ici serait un montant qu'on peut forger.
    expect(options.body).toEqual({ orgId: 'org-1' });
    expect(JSON.stringify(options.body)).not.toMatch(/amount|cents|montant/i);
  });

  it('le montant affiché est celui du SERVEUR, jamais un calcul refait ici', async () => {
    // 2 000 centimes = 20,00 €. Si l'écran recalculait le montant à partir du
    // palier, il afficherait autre chose que ce qui a été viré — et c'est le
    // chiffre affiché que la personne opposera un jour.
    invoke.mockResolvedValue({ data: { refundedCents: 2000 }, error: null });
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: CTA }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(String(toastSuccess.mock.calls[0][0])).toContain('20.00');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('un rejeu, que le serveur borne à 0, ne prétend PAS avoir remboursé une seconde fois', async () => {
    // La borne vit côté serveur (clé d'idempotence + pré-contrôle qui retranche
    // ce qui a déjà été rendu). Vue de l'écran, elle se manifeste par un
    // montant nul : le message doit alors parler de résiliation, pas d'argent.
    invoke.mockResolvedValue({ data: { refundedCents: 0 }, error: null });
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: CTA }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    const message = String(toastSuccess.mock.calls[0][0]);
    expect(message).toMatch(/rien à rembourser/i);
    expect(message).not.toMatch(/\d+[.,]\d{2}/);
  });

  it('un échec serveur le DIT, et dit que rien n’a été résilié', async () => {
    // `refund_failed` est la seule sortie d'erreur possible après le point de
    // non-retour : le message doit lever le doute sur l'état du compte, sinon
    // la personne reclique — et c'est le rejeu qu'on cherche à éviter.
    invoke.mockResolvedValue({ data: { error: 'refund_failed' }, error: null });
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: CTA }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0][0])).toMatch(/rien n'a été résilié/i);
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('un membre qui n’est pas propriétaire ne voit AUCUN bouton de remboursement', async () => {
    invoke.mockResolvedValue({ data: { refundedCents: 2000 }, error: null });
    renderTab(false);

    // On attend que la vue soit peinte avant de conclure à une absence : une
    // assertion négative sur un écran pas encore rendu est vraie pour la
    // mauvaise raison.
    // 🔴 On attend le nom du plan PAYANT : il ne s'affiche qu'une fois
    // l'abonnement chargé. Sans cette ancre, l'absence du bouton serait
    // constatée sur un écran encore vide, donc vraie pour tout le monde —
    // exactement le genre d'assertion négative qui ne peut pas échouer.
    await screen.findByText(/plan équipe/i);
    expect(screen.queryByRole('button', { name: CTA })).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });
});
