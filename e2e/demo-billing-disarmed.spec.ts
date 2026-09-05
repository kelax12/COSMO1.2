import { test, expect, navTo } from './fixtures';

/**
 * ═══════════════════════════════════════════════════════════════════
 * C-65 / C-27 — tant que la facturation est DÉSARMÉE, rien ne se clique
 * ═══════════════════════════════════════════════════════════════════
 *
 * `ENTERPRISE_BILLING_ENFORCED` vaut `false` depuis le 2026-08-26 : ni
 * paiement, ni résiliation-remboursement ne doivent être atteignables. C'est
 * la seule garantie de C-65 qui tienne AUJOURD'HUI en production, et c'est
 * donc la seule qu'un test de bout en bout peut mesurer — le parcours de
 * remboursement lui-même est joué ailleurs, avec le drapeau retourné et Stripe
 * intercepté (`OrgBillingTab.refund.parcours.test.tsx`), et sa moitié serveur
 * n'est toujours pas éprouvée.
 *
 * 🔴 Pourquoi ça mérite un test plutôt qu'une lecture du drapeau : les deux
 * drapeaux (le TS et `billing_flags.enterprise_seat_limit`) se déplacent
 * ensemble, et le mode d'échec qui a coûté une impasse produit le 2026-08-26,
 * c'est précisément un écran qui propose de payer alors que l'encaissement
 * n'existe pas. Un CTA remonté par inadvertance est exactement ça.
 */
test.describe('C-65 — facturation entreprise désarmée (démo)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('la vue Abonnement n’expose ni paiement ni remboursement', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({
      timeout: 15_000,
    });

    // `?tab=billing` reste une valeur d'URL valide : les Edge Functions Stripe
    // y renvoient. Un non-propriétaire retombe sur l'aperçu.
    await page.goto('/entreprise?tab=billing');

    // TÉMOIN : la vue est bien celle de la facturation. Sans cette ancre, les
    // trois absences ci-dessous seraient vraies sur n'importe quelle page.
    await expect(page.getByText(/tous les prix sont affichés ttc/i)).toBeVisible({
      timeout: 20_000,
    });

    for (const forbidden of [
      /résilier et être remboursé/i,
      /choisir ce (forfait|palier)/i,
      /gérer (mon |l')abonnement/i,
    ]) {
      await expect(page.getByRole('button', { name: forbidden })).toHaveCount(0);
    }
  });
});
