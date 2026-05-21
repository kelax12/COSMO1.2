import { test, expect } from './fixtures';

/**
 * Parcours critique #1 : login démo → créer une tâche → vérifier qu'elle
 * apparaît dans la liste.
 *
 * Couvre : auth démo, navigation Dashboard → Tasks, ouverture AddTaskForm,
 * persistence localStorage, refresh React Query après mutation.
 */
test('démo : créer une tâche apparaît dans la liste', async ({ demoPage: page }) => {
  // Aller sur /tasks via le tile Quick action
  await page.getByRole('button', { name: /mes tâches/i }).first().click();
  await page.waitForURL(/\/tasks/);

  // Cliquer le FAB ou le bouton "Nouvelle tâche"
  const fab = page.locator('button[aria-label*="Ajouter"], button[aria-label*="ouvelle"]').first();
  await fab.click();

  // Remplir le formulaire
  const taskName = `E2E test task ${Date.now()}`;
  await page.getByLabel(/nom|titre/i).first().fill(taskName);

  // Valider (bouton "Créer" ou "Ajouter")
  await page.getByRole('button', { name: /^(créer|ajouter|enregistrer)/i }).click();

  // Vérifier que la tâche apparaît
  await expect(page.getByText(taskName)).toBeVisible({ timeout: 5_000 });
});
