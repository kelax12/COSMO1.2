import { test, expect, navTo } from './fixtures';

/**
 * ═══════════════════════════════════════════════════════════════════
 * C-65 / S-6 — facturation ARMÉE : rien ne se paie sans les deux consentements
 * ═══════════════════════════════════════════════════════════════════
 *
 * `ENTERPRISE_BILLING_ENFORCED` vaut `true` depuis le 2026-10-20 (bascule
 * Stripe live). Ce fichier s'appelait `demo-billing-disarmed.spec.ts` et
 * mesurait l'inverse : il est devenu rouge le jour même, à juste titre.
 *
 * Ce qui reste mesurable de bout en bout, sans jamais ouvrir de session
 * Stripe :
 *  - la grille montre des prix, avec la mention TTC (Conso. L112-1) ;
 *  - l'information précontractuelle et les deux cases sont montées ;
 *  - 🔴 AUCUN bouton « Choisir ce palier » tant que les deux cases ne sont pas
 *    cochées (S-6 : le serveur refuse aussi, mais l'écran ne doit pas proposer
 *    un paiement qu'il sait voué au refus) ;
 *  - une organisation au palier gratuit ne se voit proposer aucun
 *    remboursement : il n'y a rien à rembourser.
 *
 * ❌ Ne jamais cliquer « Choisir ce palier » ici : le parcours de paiement est
 * joué avec Stripe intercepté (`OrgBillingTab.refund.parcours.test.tsx`).
 */
test.describe('C-65 — facturation entreprise armée (démo)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('les prix sont affichés et aucun paiement ne s’ouvre sans les deux consentements', async ({
    demoPage: page,
  }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({
      timeout: 15_000,
    });

    // `?tab=billing` reste une valeur d'URL valide : les Edge Functions Stripe
    // y renvoient. Le compte démo est propriétaire de Nova Studio.
    await page.goto('/entreprise?tab=billing');

    // TÉMOIN : la vue est bien celle de la facturation, armée. Sans cette
    // ancre, les absences ci-dessous seraient vraies sur n'importe quelle page.
    await expect(page.getByText(/tous les prix sont affichés ttc/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/la facturation entreprise n.est pas encore activée/i)).toHaveCount(0);
    await expect(page.getByText(/\d\s?€/).first()).toBeVisible();

    const subscribe = page.getByRole('button', { name: /choisir ce palier/i });
    const immediate = page.getByRole('checkbox', { name: /démarre immédiatement/i });
    const waiver = page.getByRole('checkbox', { name: /renonce à mon droit de rétractation/i });

    await expect(immediate).toBeVisible();
    await expect(waiver).toBeVisible();

    // S-6 : zéro case, puis une seule case → toujours aucun bouton de paiement.
    await expect(subscribe).toHaveCount(0);
    await immediate.check();
    await expect(subscribe).toHaveCount(0);

    // Les deux cases → les paliers payants deviennent sélectionnables.
    await waiver.check();
    await expect(subscribe.first()).toBeVisible();

    // Palier gratuit : rien à rembourser.
    await expect(page.getByRole('button', { name: /résilier et être remboursé/i })).toHaveCount(0);
  });
});
