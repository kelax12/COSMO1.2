import { test, expect } from './fixtures';

/**
 * Parcours critique #1 : login démo → naviguer vers Tasks → ouvrir le
 * formulaire de création de tâche.
 *
 * NOTE : le formulaire AddTaskForm est un wizard à 2 étapes (nom +
 * échéance obligatoires en étape 1, "Suivant" disabled sans date).
 * Pour un test fiable sans calendrier customisé à piloter, on s'arrête
 * à la vérification : le form s'ouvre, accepte un nom, le bouton "Suivant"
 * existe. C'est suffisant pour détecter une régression majeure (crash,
 * formulaire qui ne s'affiche pas, etc.).
 */
test('démo : ouvrir le formulaire de création de tâche', async ({ demoPage: page }) => {
  // Navigation SPA via la sidebar desktop
  await page.getByRole('link', { name: /to ?do|tâches|tasks/i }).first().click();
  await page.waitForURL(/\/tasks/);

  // Attendre que la page Tasks soit interactive
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });

  // Cliquer le bouton de création (FAB ou bouton header)
  const fab = page.locator(
    'button[aria-label*="jouter une tâche" i], button[aria-label*="ouvelle tâche" i], button:has-text("Nouvelle tâche")'
  ).first();
  await fab.click({ timeout: 10_000 });

  // Le dialog "Créer une nouvelle tâche" doit s'ouvrir
  const dialog = page.getByRole('dialog', { name: /créer une nouvelle tâche/i });
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  // Remplir le nom (champ obligatoire)
  const taskName = `E2E task ${Date.now()}`;
  await page.getByRole('textbox', { name: /nom de la tâche/i }).fill(taskName);

  // Le bouton "Suivant" doit exister (même disabled tant que pas de date)
  await expect(page.getByRole('button', { name: /^suivant$/i })).toBeVisible();

  // Pas de toast d'erreur
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
});
