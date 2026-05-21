import { test, expect } from './fixtures';

/**
 * Parcours critique #3 : login démo → naviguer vers OKR (SPA).
 *
 * Smoke test : la page OKR doit s'afficher sans crash et au moins un
 * objectif (seed démo) ou un bouton de création doit être visible.
 */
test('démo : naviguer vers OKR affiche la page', async ({ demoPage: page }) => {
  await page.getByRole('link', { name: /^okr$/i }).first().click();
  await page.waitForURL(/\/okr/);

  // H1 ou bouton de création visible
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });

  // Toujours sur /okr (pas de crash → redirect)
  expect(page.url()).toContain('/okr');

  // Pas de toast d'erreur Sonner visible
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
});
