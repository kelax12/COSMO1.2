import { test, expect, navTo } from './fixtures';

/**
 * Facturation entreprise ARMÉE, sans renonciation au droit de rétractation.
 *
 * Décision du 2026-10-30 : le client garde ses 14 jours entiers, aucune case
 * de renonciation n'est demandée. Les paliers se choisissent donc directement,
 * et aucune case de renonciation ne doit réapparaître.
 *
 * Le paiement lui-même n'est jamais cliqué ici : il partirait vers Stripe.
 */
test.describe('Facturation entreprise armée (démo)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('prix TTC affichés, paliers choisissables sans case de renonciation', async ({
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
    // La mention « Tous les prix sont affichés TTC » et la phrase précontractuelle
    // sont retirées le 2026-10-31 (9eedd3ca) : « TTC » suit désormais CHAQUE prix.
    await expect(page.getByRole('heading', { name: /^abonnement de l.organisation$/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/^TTC$/).first()).toBeVisible();
    // La phrase de la facturation dormante ne doit plus jamais revenir à côté
    // d'une grille qui encaisse.
    await expect(page.getByText(/la facturation entreprise n.est pas encore activée/i)).toHaveCount(0);

    const choose = page.getByRole('button', { name: /choisir ce palier/i });
    await expect(choose.first()).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /démarre immédiatement|renonce à mon droit/i })).toHaveCount(0);

    // Aucun chemin de remboursement sans abonnement payé (la démo n'en a pas).
    await expect(page.getByRole('button', { name: /résilier et être remboursé/i })).toHaveCount(0);
  });
});
