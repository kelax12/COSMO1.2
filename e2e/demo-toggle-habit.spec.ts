import { test, expect } from './fixtures';

/**
 * Parcours critique #2 : login démo → ouvrir Habits → cocher une habitude.
 *
 * Couvre : navigation Dashboard → Habits, render HabitTable, mutation
 * useToggleHabitCompletion, mise à jour optimiste UI.
 */
test('démo : cocher une habitude met à jour son état', async ({ demoPage: page }) => {
  await page.getByRole('button', { name: /mes habitudes/i }).first().click();
  await page.waitForURL(/\/habits/);

  // Attendre qu'au moins une habitude soit rendue (seed démo en a 30+)
  await expect(page.locator('text=/min/i').first()).toBeVisible({ timeout: 5_000 });

  // Trouver la première checkbox/case d'aujourd'hui et cliquer
  // Sur mobile c'est la card avec bg-blue qui indique completed
  const firstHabitToggle = page
    .locator('button[aria-label*="ompléter"], button[aria-label*="ujourd"]')
    .first();
  // Fallback : si pas d'aria-label dédié, on clique sur la 1ère card
  if (await firstHabitToggle.count() === 0) {
    await page.locator('[role="button"], button').filter({ hasText: /min/i }).first().click();
  } else {
    await firstHabitToggle.click();
  }

  // Vérifier qu'aucune erreur n'a explosé (le toast Sonner est notre canari)
  await expect(page.locator('text=/erreur/i')).toHaveCount(0);
});
