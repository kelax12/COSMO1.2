import { test, expect, type Page } from '@playwright/test';
import { gotoStubbed, installSupabaseStub, STUB_USER_ID, type SupabaseStub } from '../supabase-stub';
import { refundAmount } from '../../supabase/functions/_shared/refund-amount';

/**
 * ═══════════════════════════════════════════════════════════════════
 * C-27 / C-65 — le parcours de REMBOURSEMENT, réellement joué
 * ═══════════════════════════════════════════════════════════════════
 *
 * C-27 exige nommément ce parcours : « C-65 touche de l'argent, il ne part pas
 * sans son parcours E2E. » Les trois autres parcours de l'item ont été livrés
 * le 2026-09-05, celui-ci manquait — et il manquait pour une raison
 * structurelle, pas par oubli : le bouton n'est monté nulle part tant que
 * `ENTERPRISE_BILLING_ENFORCED` vaut `false`, et toute la suite E2E tourne en
 * mode démo, où l'abonnement d'organisation vaut `null` par construction.
 *
 * Ce que ce fichier a demandé au harnais pour y arriver, et rien de plus :
 *  • le project `supabase-stub` sert l'app HORS démo (mode Vite `e2e-stub`) ;
 *  • ce mode-là, et lui seul, substitue `premium-config` par un module qui ne
 *    change qu'un booléen (`e2e/stubs/premium-config.e2e-stub.ts`) ;
 *  • le stub Supabase capte désormais les appels d'Edge Function.
 *
 * ───────────────────────────────────────────────────────────────────
 * 🔴 CE QUE CE FICHIER PROUVE, ET CE QU'IL NE PROUVE TOUJOURS PAS.
 * ───────────────────────────────────────────────────────────────────
 *
 * IL PROUVE, sur l'app réelle, avec le vrai routage, le vrai catalogue et le
 * vrai composant :
 *   1. qu'un propriétaire atteint le bouton et qu'un NON-propriétaire ne
 *      l'atteint pas, même en tapant `?tab=billing` à la main ;
 *   2. qu'un clic fait partir UN SEUL appel à `stripe-org-refund`, authentifié,
 *      avec `{ orgId }` et AUCUN montant ;
 *   3. que le montant annoncé à l'écran est celui du serveur, et qu'il vaut
 *      exactement ce que `_shared/refund-amount.ts` décide — un cas mensuel
 *      (échéance entière) et un cas annuel (prorata des mois entiers) ;
 *   4. qu'après un remboursement l'écran dit que l'abonnement est RÉSILIÉ,
 *      sans rechargement, et ne propose plus de recommencer ;
 *   5. qu'un échec dit « rien n'a été résilié » ET laisse l'écran dans l'état
 *      d'avant — l'abonnement toujours payant, le bouton toujours là.
 *
 * IL NE PROUVE PAS la moitié serveur, et aucun test de ce poste ne le peut :
 * `refunds.create`, l'ordre « rembourser d'abord, résilier ensuite », la clé
 * d'idempotence dérivée de l'`invoice_id`, le pré-contrôle qui retranche, et la
 * ligne compensatoire écrite par `stripe-webhook`. La clé Stripe du projet est
 * une clé de TEST, `org_subscriptions` est vide, il n'existe aucune facture à
 * rembourser, et `APP_URL` épingle l'origine CORS sur la production.
 *
 * ⚠️ Le cas 5 mérite d'être lu deux fois : c'est le stub qui décide de ne rien
 * résilier, donc ce cas ne mesure PAS le serveur. Ce qu'il mesure est une
 * propriété du CLIENT, et elle n'est pas acquise d'avance : sur un échec,
 * l'écran ne doit pas anticiper une résiliation qui n'a pas eu lieu. Un client
 * qui viderait l'abonnement de façon optimiste ferait tomber ce cas.
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

const CTA = /résilier et être remboursé de la période en cours/i;
/** Ancre de la vue : cette mention porte sur la grille entière. */
const BILLING_ANCHOR = /tous les prix sont affichés ttc/i;
/** Phrase propre au STATUT résilié — le toast de succès en dit une autre. */
const CANCELLED_STATE = /les membres actuels gardent tous leurs accès/i;

async function openBilling(
  page: Page,
  options: {
    ownerId?: string;
    subscription?: ReturnType<typeof subscriptionRow>;
    /**
     * Ce qu'on attend pour dire « la vue est là ». Par défaut la mention TTC,
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
  // `gotoStubbed`. L'ancre par defaut est la mention TTC, qui n'existe que dans
  // la vue Abonnement — donc jamais chez un non-proprietaire, qui passe la
  // sienne.
  await gotoStubbed(
    page,
    '/entreprise?tab=billing',
    options.shell ? options.shell(page) : page.getByText(BILLING_ANCHOR),
  );
  return stub;
}

/**
 * Répond au remboursement, et fait suivre la RÉSILIATION comme le serveur la
 * ferait : l'abonnement relu après coup est résilié.
 *
 * 🔴 Le basculement se fait DANS le gestionnaire de l'appel, pas après lui. Le
 * client relit l'abonnement dès le succès ; le faire depuis le test, après
 * avoir constaté l'appel, serait une course que le test perdrait une fois sur
 * deux — et un test bimodal ne dit rien.
 */
async function answerRefund(
  page: Page,
  stub: SupabaseStub,
  response: { body: unknown; cancels: boolean },
): Promise<void> {
  stub.reply('functions/v1/stripe-org-refund', response.body);
  await page.route('**/functions/v1/stripe-org-refund', async (route) => {
    if (response.cancels) {
      stub.reply('org_subscriptions', subscriptionRow({ interval: 'monthly', status: 'cancelled' }));
    }
    // On délègue au gestionnaire du stub : c'est lui qui capte l'appel et qui
    // répond. Répondre ici ferait deux définitions du même stub.
    await route.fallback();
  });
}

test.describe('C-27 / C-65 — résilier et être remboursé', () => {
  // ⚠️ Le plafond de temps du project `supabase-stub` est deja porte a 240 s
  // dans `playwright.config.ts` : le tout premier cas paie la compilation a
  // froid de `/entreprise`, de ses onglets paresseux et de l'onglet Abonnement.

  test('le montant annoncé est celui du serveur, et la résiliation suit — cas MENSUEL', async ({
    page,
  }) => {
    // Le montant n'est PAS écrit à la main : il est décidé par le module que
    // l'Edge Function appelle. Écrire « 2000 » ici ferait de ce test une
    // seconde définition de la règle de remboursement.
    const now = Math.floor(Date.now() / 1000);
    const decision = refundAmount({
      amountPaidCents: 2000, // 20,00 € — palier « Équipe », mensuel
      interval: 'monthly',
      periodStart: now - 10 * 24 * 3600,
      periodEnd: now + 20 * 24 * 3600,
      now,
    });
    // Le fixture DOIT exercer la branche mensuelle, sinon les deux cas de ce
    // fichier mesureraient la même chose sans que rien ne le dise.
    expect(decision.reason).toBe('monthly_full');
    expect(decision.amountCents).toBe(2000);

    const stub = await openBilling(page);
    await answerRefund(page, stub, {
      body: { ok: true, refundedCents: decision.amountCents },
      cancels: true,
    });

    await expect(page.getByText(BILLING_ANCHOR)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: CTA }).click();

    // 1. Ce qui est parti : un seul appel, authentifié, sans aucun montant.
    await expect.poll(() => stub.functionCalls.length, { timeout: 15_000 }).toBe(1);
    const call = stub.functionCalls[0];
    expect(call.name).toBe('stripe-org-refund');
    expect(call.authorized).toBe(true);
    expect(call.body).toEqual({ orgId: ORG_ID });
    // 🔴 Le client ne choisit jamais un prix : un montant envoyé d'ici serait
    // un montant qu'on peut forger.
    expect(JSON.stringify(call.body)).not.toMatch(/amount|cents|montant/i);

    // 2. Ce qui est dit : le montant du serveur, formaté par le produit.
    await expect(page.getByText(/20\.00 € remboursés/i)).toBeVisible({ timeout: 10_000 });

    // 3. La résiliation suit, et l'écran la porte SANS rechargement.
    await expect(page.getByText(CANCELLED_STATE)).toBeVisible({ timeout: 10_000 });
    // Et le geste ne se re-propose pas : un second clic partirait vers une
    // borne serveur qui n'a plus rien à rendre.
    await expect(page.getByRole('button', { name: CTA })).toHaveCount(0);

    // 4. Le client n'écrit RIEN dans `org_subscriptions` : la table n'a aucune
    //    policy d'écriture, tout y passe par Stripe puis par le webhook.
    expect(stub.writesTo('org_subscriptions')).toHaveLength(0);
  });

  test('un abonnement ANNUEL est remboursé au prorata des mois entiers restants', async ({
    page,
  }) => {
    const now = Math.floor(Date.now() / 1000);
    const decision = refundAmount({
      // 420,00 € : le total annuel du palier « Département » (50 € − 30 %, ×12).
      amountPaidCents: 42000,
      interval: 'yearly',
      periodStart: now - 165 * 24 * 3600,
      periodEnd: now + 200 * 24 * 3600,
      now,
    });
    // 200 jours restants = 6 tranches de 30 jours entières ; la 7ᵉ est entamée,
    // donc consommée, donc pas rendue.
    expect(decision.reason).toBe('yearly_prorata');
    expect(decision.monthsRemaining).toBe(6);
    expect(decision.amountCents).toBe(21000);

    const stub = await openBilling(page, {
      subscription: subscriptionRow({ interval: 'yearly', tierKey: 't20', maxMembers: 20 }),
    });
    await answerRefund(page, stub, {
      body: { ok: true, refundedCents: decision.amountCents },
      cancels: true,
    });

    await expect(page.getByText(BILLING_ANCHOR)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: CTA }).click();

    await expect.poll(() => stub.functionCalls.length, { timeout: 15_000 }).toBe(1);
    // ⚠️ La périodicité ne quitte pas le serveur non plus : elle est lue dans
    // `org_subscriptions.billing_interval` (mig. 123), jamais déduite du
    // montant ni envoyée par le client.
    expect(stub.functionCalls[0].body).toEqual({ orgId: ORG_ID });
    await expect(page.getByText(/210\.00 € remboursés/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(CANCELLED_STATE)).toBeVisible({ timeout: 10_000 });
  });

  test('un échec Stripe le DIT, et ne résilie rien', async ({ page }) => {
    const stub = await openBilling(page);
    // `refund_failed` est la seule sortie d'erreur possible après le point de
    // non-retour. `cancels: false` : l'abonnement relu reste actif.
    await answerRefund(page, stub, { body: { error: 'refund_failed' }, cancels: false });

    await expect(page.getByText(BILLING_ANCHOR)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: CTA }).click();

    await expect(page.getByText(/rien n'a été résilié/i)).toBeVisible({ timeout: 15_000 });
    // Aucun montant n'est annoncé : un message d'échec ne doit jamais laisser
    // croire qu'un virement est parti.
    await expect(page.getByText(/€ remboursés/i)).toHaveCount(0);

    // L'écran reste dans l'état d'avant : abonnement payant, bouton disponible.
    // C'est ce qui permet de réessayer, et c'est la seule chose honnête à
    // afficher quand on ne sait pas si le serveur a fait quoi que ce soit.
    await expect(page.getByText(CANCELLED_STATE)).toHaveCount(0);
    await expect(page.getByRole('button', { name: CTA })).toBeVisible();
    expect(stub.functionCalls).toHaveLength(1);
  });

  test('un membre qui n’est pas propriétaire n’atteint pas la vue, même par l’URL', async ({
    page,
  }) => {
    // `?tab=billing` est une valeur d'URL valide (les Edge Functions Stripe y
    // renvoient) : un non-propriétaire doit retomber sur l'aperçu. La garde
    // d'affichage est ici ; celle qui compte est dans l'Edge Function, qui
    // répond `403` à qui n'est pas propriétaire.
    // Ancre : on attend que l'espace entreprise soit peint avant de conclure à
    // une absence. Une assertion négative sur un écran vide est vraie pour tout
    // le monde. Le repère ne peut pas être la mention TTC ici : c'est
    // précisément ce dont on vérifie l'absence.
    const stub = await openBilling(page, {
      ownerId: OTHER_USER_ID,
      shell: (p) => p.getByRole('heading', { name: /nova e2e/i }).first(),
    });
    await expect(page.getByText(BILLING_ANCHOR)).toHaveCount(0);
    await expect(page.getByRole('button', { name: CTA })).toHaveCount(0);

    await page.waitForTimeout(1_000);
    expect(stub.functionCalls).toHaveLength(0);
  });

  test('TEMOIN — aucune requête n’a quitté le stub vers un vrai projet Supabase', async ({
    page,
  }) => {
    // Ce cas ne teste pas le produit, il teste le HARNAIS — et il compte double
    // ici : ce fichier est le seul à faire partir un appel qui, en production,
    // déplace de l'argent.
    const stub = await openBilling(page);
    await expect(page.getByText(BILLING_ANCHOR)).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2_000);
    expect(stub.foreignSupabaseCalls).toEqual([]);
    // Seconde moitié, sans laquelle « aucune fuite » serait vrai parce que RIEN
    // n'est parti : le stub a bien vu passer le trafic de l'espace entreprise.
    expect(stub.writes.map((w) => w.path)).toContain('rpc/get_my_org_inbox');
  });
});
