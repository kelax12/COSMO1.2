import { test, expect, type Page } from '@playwright/test';
import { gotoStubbed, installSupabaseStub, STUB_USER_ID, type SupabaseStub } from '../supabase-stub';

/**
 * Rétractation (14 jours) et résiliation (fin de période, sans remboursement),
 * jouées contre le stub Supabase (décision du 2026-11-01,
 * REMBOURSEMENT-RESILIATION.md). Remplace le parcours « résilier et être
 * remboursé » de C-65, supprimé.
 *
 * Prouve le CLIENT : les boutons, la fenêtre de 14 jours, une seule
 * confirmation pour résilier, aucun montant envoyé, aucun appel à
 * stripe-org-refund (réservé à l'admin). La moitié serveur (Stripe, emails,
 * org_withdrawals) n'est pas jouée ici.
 */

// ── Fixtures ────────────────────────────────────────────────────────

const ORG_ID = 'ffffffff-0000-4000-8000-00000000c065';
const OTHER_USER_ID = '00000000-0000-4000-8000-00000000dead';

const orgRow = (ownerId: string) => ({
  id: ORG_ID,
  name: 'Nova E2E',
  join_code: 'E2EC65',
  owner_id: ownerId,
  created_at: '2026-01-05T09:00:00.000Z',
  description: null,
  industry: null,
  avatar_url: null,
});

/**
 * UNE ligne qui sert les deux lectures de `organization_members`.
 *
 * `getMyOrganizations` demande `role, organizations(*)`, `getMembers` demande
 * `*` : PostgREST les distingue par le `select`, le stub non (il répond par
 * chemin). Une seule ligne portant les deux formes évite d'inventer un
 * appariement qui n'existe nulle part dans le produit.
 */
const membershipRow = (ownerId: string) => ({
  org_id: ORG_ID,
  user_id: STUB_USER_ID,
  role: ownerId === STUB_USER_ID ? 'admin' : 'member',
  joined_at: '2026-01-05T09:00:00.000Z',
  manager_id: null,
  organizations: orgRow(ownerId),
});

interface SubscriptionRowOptions {
  interval: 'monthly' | 'yearly';
  status?: 'active' | 'cancelled';
  tierKey?: string;
  maxMembers?: number;
}

const subscriptionRow = ({
  interval,
  status = 'active',
  tierKey = 't10',
  maxMembers = 10,
}: SubscriptionRowOptions) => ({
  org_id: ORG_ID,
  tier_key: tierKey,
  max_members: maxMembers,
  status,
  billing_interval: interval,
  current_period_end: '2026-12-01T00:00:00.000Z',
  discount_code: null,
});

/** Ancre de la vue : le titre de la vue Abonnement (la mention TTC globale est retirée le 2026-10-31). */
const BILLING_ANCHOR = /^abonnement de l.organisation$/i;

async function openBilling(
  page: Page,
  options: {
    ownerId?: string;
    subscription?: ReturnType<typeof subscriptionRow> & { started_at?: string };
    /**
     * Ce qu'on attend pour dire « la vue est là ». Par défaut le titre de la vue,
     * qui n'apparaît que dans la vue Abonnement — donc jamais chez un
     * non-propriétaire, qui doit passer son propre repère.
     */
    shell?: (page: Page) => ReturnType<Page['getByText']>;
  } = {},
): Promise<SupabaseStub> {
  const ownerId = options.ownerId ?? STUB_USER_ID;
  const stub = await installSupabaseStub(page);

  // Sans ça, `FirstRunSetup` s'ouvre par-dessus la page (compte hors démo, zéro
  // tâche) et intercepte tous les clics. Son parcours à lui est joué à part.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('cosmo_first_run_done', '1');
    } catch {
      /* mode privé : le test échouera plus loin, avec un message parlant */
    }
  });

  stub.reply('organization_members', [membershipRow(ownerId)]);
  stub.reply('rpc/get_my_tasks', []);
  stub.reply('org_subscriptions', options.subscription ?? subscriptionRow({ interval: 'monthly' }));

  // Les trois pieges du serveur de developpement (aucun `load`, un
  // `domcontentloaded` avale par la re-optimisation, un import de route qui
  // echoue pendant celle-ci) sont absorbes une fois pour toutes par
  // `gotoStubbed`. L'ancre par defaut est le titre de la vue Abonnement, qui n'existe que dans
  // la vue Abonnement — donc jamais chez un non-proprietaire, qui passe la
  // sienne.
  await gotoStubbed(
    page,
    '/entreprise?tab=billing',
    options.shell ? options.shell(page) : page.getByText(BILLING_ANCHOR),
  );
  return stub;
}

const DAY_MS = 24 * 3600 * 1000;
const WITHDRAW = /se rétracter du contrat ici/i;
const CANCEL = /résilier mon abonnement/i;

test.describe('rétractation et résiliation (décision du 2026-11-01)', () => {
  test('pendant 14 jours : récapitulatif, montant du serveur, confirmation, aucun remboursement appelé', async ({ page }) => {
    const stub = await openBilling(page, {
      subscription: { ...subscriptionRow({ interval: 'monthly' }), started_at: new Date(Date.now() - 2 * DAY_MS).toISOString() },
    });
    stub.reply('functions/v1/stripe-org-subscription', { eligible: true, amountCents: 1933, deadline: '', recipient: 'e2e@cosmo.test', ok: true });

    await page.getByRole('button', { name: WITHDRAW }).click();
    await expect(page.getByText('19,33 €')).toBeVisible();
    await page.getByRole('button', { name: /confirmer la rétractation/i }).click();

    await expect.poll(() => stub.functionCalls.filter((c) => (c.body as { action?: string })?.action === 'withdraw').length, { timeout: 15_000 }).toBe(1);
    for (const call of stub.functionCalls) {
      expect(call.name).toBe('stripe-org-subscription');
      expect(JSON.stringify(call.body)).not.toMatch(/amount|cents/i);
    }
  });

  test('après 14 jours : plus de bouton de rétractation, la résiliation reste', async ({ page }) => {
    await openBilling(page, {
      subscription: { ...subscriptionRow({ interval: 'monthly' }), started_at: new Date(Date.now() - 30 * DAY_MS).toISOString() },
    });
    await expect(page.getByRole('button', { name: CANCEL })).toBeVisible();
    await expect(page.getByRole('button', { name: WITHDRAW })).toHaveCount(0);
  });

  test('résiliation : une seule confirmation, « aucun remboursement », appel `cancel` seul', async ({ page }) => {
    const stub = await openBilling(page, {
      subscription: { ...subscriptionRow({ interval: 'yearly' }), started_at: new Date(Date.now() - 60 * DAY_MS).toISOString() },
    });
    stub.reply('functions/v1/stripe-org-subscription', { ok: true, cancelAtPeriodEnd: true, accessUntil: '2026-12-01T00:00:00.000Z' });

    await page.getByRole('button', { name: CANCEL }).click();
    await expect(page.getByText(/aucun remboursement n'est effectué/i)).toBeVisible();
    await page.getByRole('button', { name: /confirmer la résiliation/i }).click();

    await expect.poll(() => stub.functionCalls.length, { timeout: 15_000 }).toBe(1);
    expect(stub.functionCalls[0].name).toBe('stripe-org-subscription');
    expect(stub.functionCalls[0].body).toEqual({ orgId: ORG_ID, action: 'cancel' });
  });

  test('un non-propriétaire ne voit ni rétractation ni résiliation', async ({ page }) => {
    await openBilling(page, {
      ownerId: OTHER_USER_ID,
      subscription: { ...subscriptionRow({ interval: 'monthly' }), started_at: new Date().toISOString() },
      shell: (p) => p.getByText(/géré par le propriétaire/i),
    });
    await expect(page.getByRole('button', { name: WITHDRAW })).toHaveCount(0);
    await expect(page.getByRole('button', { name: CANCEL })).toHaveCount(0);
  });
});
