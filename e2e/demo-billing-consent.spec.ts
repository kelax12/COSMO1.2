import { test, expect, navTo } from './fixtures';

/**
 * ═══════════════════════════════════════════════════════════════════
 * Facturation entreprise ARMÉE : aucun palier ne se choisit sans le
 * double consentement de rétractation
 * ═══════════════════════════════════════════════════════════════════
 *
 * Cette spec s'appelait `demo-billing-disarmed` et vérifiait l'inverse : tant
 * que `ENTERPRISE_BILLING_ENFORCED` valait `false` (2026-08-26 → 2026-10-20),
 * aucun CTA de paiement ne devait être atteignable. La bascule Stripe live
 * (`5bf21a50`) a réarmé la facturation, et la spec est restée rouge sur une
 * phrase « pas encore activée » que l'écran ne dit plus.
 *
 * L'invariant qui compte maintenant est juridique (finding S-6, Conso.
 * L221-28 1°) : un abonnement qui démarre tout de suite exige DEUX cases
 * cochées, et le bouton « Choisir ce palier » n'existe pas avant. Le serveur
 * refuse aussi la session sans elles ; cette spec mesure la moitié écran.
 *
 * Le paiement lui-même n'est jamais cliqué ici : il partirait vers Stripe.
 */
test.describe('Facturation entreprise armée (démo)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('prix TTC affichés, et aucun palier choisissable avant les deux consentements', async ({
    demoPage: page,
  }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({
      timeout: 15_000,
    });

    // `?tab=billing` reste une valeur d'URL valide : les Edge Functions Stripe
    // y renvoient. Un non-propriétaire retombe sur l'aperçu.
    await page.goto('/entreprise?tab=billing');

    // TÉMOIN : la vue est bien celle de la facturation, et elle est armée.
    // Sans cette ancre, l'absence de bouton ci-dessous serait vraie sur
    // n'importe quelle page.
    await expect(page.getByText(/tous les prix sont affichés ttc/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/abonnement à durée indéterminée, prix ttc/i)).toBeVisible();
    // La phrase de la facturation dormante ne doit plus jamais revenir à côté
    // d'une grille qui encaisse.
    await expect(page.getByText(/la facturation entreprise n.est pas encore activée/i)).toHaveCount(0);

    const choose = page.getByRole('button', { name: /choisir ce palier/i });
    const immediate = page.getByRole('checkbox', { name: /démarre immédiatement/i });
    const waiver = page.getByRole('checkbox', { name: /je renonce à mon droit de rétractation/i });

    // Aucune case cochée : aucun palier ne se choisit.
    await expect(choose).toHaveCount(0);
    await expect(page.getByText(/ces deux confirmations sont nécessaires/i)).toBeVisible();

    // Une seule case ne suffit pas.
    await immediate.check();
    await expect(choose).toHaveCount(0);

    // Les deux : les paliers payants deviennent choisissables.
    await waiver.check();
    await expect(choose.first()).toBeVisible();
    await expect(page.getByText(/ces deux confirmations sont nécessaires/i)).toHaveCount(0);

    // Et décocher la renonciation les retire de nouveau.
    await waiver.uncheck();
    await expect(choose).toHaveCount(0);

    // Aucun chemin de remboursement sans abonnement payé (la démo n'en a pas).
    await expect(page.getByRole('button', { name: /résilier et être remboursé/i })).toHaveCount(0);
  });
});
