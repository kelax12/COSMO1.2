import { test, expect, type Page } from '@playwright/test';
import { gotoStubbed, installSupabaseStub, STUB_USER_ID, type SupabaseStub } from '../supabase-stub';

/**
 * ═══════════════════════════════════════════════════════════════════
 * C-39 — le parcours NOMINAL de suppression d'entreprise, réellement joué
 * ═══════════════════════════════════════════════════════════════════
 *
 * C-39 était bloqué pour une raison qui est tombée le 2026-09-12 (déploiement
 * de `stripe-org-refund`), puis pour une seconde qui restait entière : le
 * parcours « rembourser → résilier → supprimer » **n'avait jamais été joué une
 * seule fois de bout en bout**, ni en démo ni ailleurs. Ce qui existait :
 *   • `src/refund.guard.test.ts` — l'ORDRE, prouvé par mutation, sur le hook ;
 *   • `e2e/stubbed/refund.spec.ts` — le remboursement seul, depuis l'onglet
 *     Abonnement, sans la suppression qui le suit.
 * Personne n'avait jamais enchaîné les deux dans un navigateur.
 *
 * ───────────────────────────────────────────────────────────────────
 * 🔴 CE QUE CE FICHIER PROUVE, ET CE QU'IL NE PROUVE PAS.
 * ───────────────────────────────────────────────────────────────────
 *
 * IL PROUVE, sur l'app réelle, avec le vrai routage et le vrai composant :
 *   1. que la zone de danger est montée pour le PROPRIÉTAIRE et pour lui seul —
 *      un admin qui ne possède pas l'organisation ne l'atteint pas ;
 *   2. que la confirmation extrême tient : le bouton reste inerte tant que le
 *      nom exact n'est pas saisi ;
 *   3. **que la suppression ne part PAS tant que le remboursement n'a pas
 *      répondu** — mesuré en RETENANT la réponse de l'Edge Function, pas en
 *      relisant l'ordre des lignes du hook ;
 *   4. qu'un remboursement REFUSÉ ne supprime rien : aucune RPC
 *      `delete_organization` ne part, et l'organisation est toujours là.
 *
 * IL NE PROUVE PAS la moitié serveur, et aucun test de ce poste ne le peut :
 * `refunds.create`, la résiliation Stripe, la garde PROPRIÉTAIRE de la mig. 138
 * (elle se prouve en SQL, acteur par acteur, et elle l'a été le 2026-09-12), ni
 * la cascade réelle. Le filet serveur existe indépendamment de cet écran : un
 * écran est un confort, `delete_organization` est la seule porte.
 *
 * ⚠️ Le cas 3 est le seul qui apporte quelque chose que l'unitaire n'a pas.
 * `refund.guard.test.ts` prouve l'ordre en mutant le hook ; ici, c'est le
 * NAVIGATEUR qui le montre : tant que la fonction n'a pas rendu, la base n'a
 * rien reçu. Si un jour quelqu'un déplace l'enchaînement hors du hook, la garde
 * unitaire devient muette et ce cas-ci, lui, échoue toujours.
 */

// ── Fixtures ────────────────────────────────────────────────────────

const ORG_ID = 'ffffffff-0000-4000-8000-00000000c039';
const ORG_NAME = 'Nova E2E';
const OTHER_USER_ID = '00000000-0000-4000-8000-00000000dead';

const orgRow = (ownerId: string) => ({
  id: ORG_ID,
  name: ORG_NAME,
  join_code: 'E2EC39',
  owner_id: ownerId,
  created_at: '2026-01-05T09:00:00.000Z',
  description: null,
  industry: null,
  avatar_url: null,
});

/**
 * UNE ligne qui sert les deux lectures de `organization_members` — même raison
 * que dans `refund.spec.ts` : le stub répond par CHEMIN, pas par `select`.
 *
 * ⚠️ `role: 'admin'` dans les deux cas, y compris quand le compte n'est PAS
 * propriétaire. C'est le scénario exact de C-39 : « une entreprise a deux
 * admins ; le second, qui ne paie rien, supprime l'organisation ». Un fixture
 * qui rétrograderait ce compte en `member` mesurerait une autre règle.
 */
const membershipRow = (ownerId: string) => ({
  org_id: ORG_ID,
  user_id: STUB_USER_ID,
  role: 'admin',
  joined_at: '2026-01-05T09:00:00.000Z',
  manager_id: null,
  organizations: orgRow(ownerId),
});

const activeSubscription = {
  org_id: ORG_ID,
  tier_key: 't10',
  max_members: 10,
  status: 'active',
  billing_interval: 'monthly',
  current_period_end: '2026-12-01T00:00:00.000Z',
  discount_code: null,
};

const DANGER_ZONE = /zone de danger/i;
const DELETE_CTA = /supprimer l'entreprise/i;
const CONFIRM_ACTION = /supprimer cette entreprise/i;

async function openMembers(
  page: Page,
  options: { ownerId?: string; shell?: (page: Page) => ReturnType<Page['getByText']> } = {},
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
  stub.reply('org_subscriptions', activeSubscription);

  await gotoStubbed(
    page,
    '/entreprise?tab=members',
    options.shell
      ? options.shell(page)
      : page.getByRole('heading', { name: DANGER_ZONE }),
  );
  return stub;
}

/** Les écritures de suppression parties vers la base, quel qu'en soit le corps. */
function deleteCalls(stub: SupabaseStub) {
  return stub.writesTo('rpc/delete_organization');
}

test.describe('C-39 — supprimer une entreprise : rembourser, puis supprimer', () => {
  // ⚠️ Le plafond de temps du project `supabase-stub` est déjà porté à 240 s
  // dans `playwright.config.ts` : le premier cas paie la compilation à froid de
  // `/entreprise` et de ses onglets paresseux.

  test('la suppression ATTEND le remboursement, et part avec lui', async ({ page }) => {
    const stub = await openMembers(page);

    // 🔴 Le cœur du fichier : la réponse du remboursement est RETENUE. Tant
    // qu'elle ne part pas, la suppression ne doit pas exister. Un test qui
    // laisse répondre tout de suite ne peut pas distinguer « après » de « en
    // même temps ».
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    // ⚠️ Compteur LOCAL, incrémenté à la RÉCEPTION de la requête. `stub.functionCalls`
    // n'enregistre l'appel qu'au moment où le stub RÉPOND — c'est justement ce
    // qu'on retient ici, donc il resterait à zéro tant que la porte est fermée.
    // Mesuré : la première version de ce cas expirait là-dessus, sur un produit
    // qui faisait exactement ce qu'il fallait.
    let refundRequests = 0;
    stub.reply('functions/v1/stripe-org-refund', { ok: true, refundedCents: 2000 });
    await page.route('**/functions/v1/stripe-org-refund', async (route) => {
      refundRequests += 1;
      await held;
      // On délègue au gestionnaire du stub : répondre ici ferait deux
      // définitions du même stub.
      await route.fallback();
    });
    stub.reply('rpc/delete_organization', null);

    await page.getByRole('button', { name: DELETE_CTA }).click();

    // 1. La confirmation extrême tient : le bouton est inerte tant que le nom
    //    exact n'est pas saisi. C'est la seule chose qui sépare ce geste d'un
    //    clic accidentel.
    const confirm = page.getByRole('button', { name: CONFIRM_ACTION });
    await expect(confirm).toBeDisabled();
    const field = page.locator('#delete-org-confirm');
    await field.fill('Nova');
    await expect(confirm).toBeDisabled();
    await field.fill(ORG_NAME);
    await expect(confirm).toBeEnabled();

    await confirm.click();

    // 2. UN SEUL appel part, et c'est celui du remboursement.
    await expect.poll(() => refundRequests, { timeout: 15_000 }).toBe(1);

    // 3. 🔴 LA PROPRIÉTÉ QUI COMPTE. Le remboursement n'a pas répondu : rien
    //    n'a été supprimé. La suppression emporte `org_subscriptions` en
    //    CASCADE — partir d'abord ferait perdre l'identifiant Stripe et
    //    laisserait l'abonnement courir sur une organisation qui n'existe plus.
    await page.waitForTimeout(1_500);
    expect(deleteCalls(stub)).toHaveLength(0);

    // 4. On laisse le remboursement répondre : la suppression suit, et elle
    //    porte bien l'organisation visée.
    release();
    await expect.poll(() => deleteCalls(stub).length, { timeout: 15_000 }).toBe(1);
    expect(deleteCalls(stub)[0].body).toEqual({ p_org: ORG_ID });

    // Et c'est bien le remboursement qui est parti en premier, authentifié et
    // sans aucun montant : le client ne choisit jamais un prix.
    expect(stub.functionCalls).toHaveLength(1);
    expect(stub.functionCalls[0].name).toBe('stripe-org-refund');
    expect(stub.functionCalls[0].authorized).toBe(true);
    expect(stub.functionCalls[0].body).toEqual({ orgId: ORG_ID });

    // 5. Et elle ne part qu'une fois : un second DELETE sur une organisation
    //    déjà supprimée trouverait une ligne absente, pas un rejeu inoffensif.
    await page.waitForTimeout(1_000);
    expect(deleteCalls(stub)).toHaveLength(1);
  });

  test('un remboursement REFUSÉ ne supprime rien', async ({ page }) => {
    const stub = await openMembers(page);
    // `refund_failed` est la seule sortie d'erreur possible après le point de
    // non-retour côté serveur.
    stub.reply('functions/v1/stripe-org-refund', { error: 'refund_failed' });
    stub.reply('rpc/delete_organization', null);

    await page.getByRole('button', { name: DELETE_CTA }).click();
    await page.locator('#delete-org-confirm').fill(ORG_NAME);
    await page.getByRole('button', { name: CONFIRM_ACTION }).click();

    await expect.poll(() => stub.functionCalls.length, { timeout: 15_000 }).toBe(1);

    // 🔴 Mieux vaut une organisation encore là et un message d'erreur qu'une
    // organisation détruite et un débit qui continue : la première situation se
    // rattrape, la seconde emporte les données de tous les membres.
    await page.waitForTimeout(2_000);
    expect(deleteCalls(stub)).toHaveLength(0);

    // L'écran reste dans l'état d'avant, donc réessayable : le dialogue est
    // toujours ouvert sur son bouton, et la zone de danger toujours là.
    await expect(page.getByRole('button', { name: CONFIRM_ACTION })).toBeVisible();

    // ⚠️ Et aucun rejeu automatique : `useCancelAndRefundOrg` pose `retry: 0`,
    // sans quoi le `retry: 1` global du QueryClient ferait repartir un SECOND
    // appel à un chemin qui déplace de l'argent, sans que personne ne clique.
    expect(stub.functionCalls).toHaveLength(1);
  });

  test('un ADMIN qui n’est pas propriétaire n’atteint pas la zone de danger', async ({ page }) => {
    // Le scénario d'échec de C-39, mot pour mot. L'écran n'est que l'affichage
    // — la règle vit dans `delete_organization` (mig. 138), seule porte vers un
    // DELETE sur `organizations`. Mais l'affichage était le chemin COURT, et
    // c'est lui qu'on mesure ici.
    //
    // Ancre : on attend que l'onglet Membres soit peint avant de conclure à une
    // absence. Une assertion négative sur un écran vide est vraie pour tout le
    // monde, et le repère ne peut pas être la zone de danger elle-même.
    const stub = await openMembers(page, {
      ownerId: OTHER_USER_ID,
      shell: (p) => p.getByRole('heading', { name: /nova e2e/i }).first(),
    });

    await expect(page.getByRole('heading', { name: DANGER_ZONE })).toHaveCount(0);
    await expect(page.getByRole('button', { name: DELETE_CTA })).toHaveCount(0);

    await page.waitForTimeout(1_000);
    expect(stub.functionCalls).toHaveLength(0);
    expect(deleteCalls(stub)).toHaveLength(0);
  });

  test('TEMOIN — le détecteur de suppression voit bien partir une suppression', async ({
    page,
  }) => {
    // Sans ce cas, les deux assertions « aucune suppression » ci-dessus
    // passeraient vertes même si `writesTo('rpc/delete_organization')` ne
    // pouvait RIEN capter — un chemin renommé, un stub qui classe ailleurs.
    // C'est le défaut que ce dépôt a attrapé quatre fois en cinq jours : un
    // détecteur qui ne détecte plus rien répond « tout va bien ».
    const stub = await openMembers(page);
    stub.reply('functions/v1/stripe-org-refund', { ok: true, refundedCents: 2000 });
    stub.reply('rpc/delete_organization', null);

    await page.getByRole('button', { name: DELETE_CTA }).click();
    await page.locator('#delete-org-confirm').fill(ORG_NAME);
    await page.getByRole('button', { name: CONFIRM_ACTION }).click();

    await expect.poll(() => deleteCalls(stub).length, { timeout: 20_000 }).toBe(1);
    // Et le témoin du harnais : rien n'est parti vers un vrai projet Supabase.
    expect(stub.foreignSupabaseCalls).toEqual([]);
  });
});
