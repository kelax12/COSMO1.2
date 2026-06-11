import { test, expect, navTo } from './fixtures';

/**
 * Parcours critique #2 : login démo → naviguer vers Habits (SPA).
 *
 * On vérifie surtout que la navigation client-side + le render HabitTable
 * fonctionnent sans crash. Le toggle de checkbox est plus dur à cibler de
 * manière fiable car la structure varie entre desktop (table) et mobile
 * (cards) — on accepte un test "smoke" qui valide qu'on atterrit sur la page.
 */
test('démo : naviguer vers Habits ne crashe pas', async ({ demoPage: page }) => {
  await navTo(page, /habitudes|habits/i, /\/habits/);

  // Attendre qu'au moins une habitude ou un H1 soit rendu
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });

  // Au moins une habitude doit être seedée (démo = 100 habitudes).
  // On cible une checkbox de complétion VISIBLE plutôt que le libellé
  // « X min » (masqué par le CSS responsive sur mobile).
  await expect(
    page.getByRole('main').locator('[role="checkbox"]').filter({ visible: true }).first()
  ).toBeVisible({ timeout: 10_000 });

  // Aucun toast d'erreur Sonner visible (data-sonner-toast est l'attribut posé par la lib)
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);

  // Toujours sur /habits
  expect(page.url()).toContain('/habits');
});
