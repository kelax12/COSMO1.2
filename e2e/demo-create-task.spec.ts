import { test, expect, navTo } from './fixtures';

/**
 * Parcours critique #1 : créer une tâche de bout en bout en mode démo.
 *
 * ⚠️ Historique : cette spec s'arrêtait à l'existence d'un bouton « Suivant »
 * (wizard à 2 étapes de l'ancien AddTaskForm). Ce wizard n'existe plus — le
 * TaskModal est désormais un formulaire à une seule étape, les collaborateurs
 * étant repliés dans une disclosure « Partager la tâche » (cf.
 * TaskModalDesktopBody). Surtout, seul le NOM est obligatoire
 * (src/components/task-modal/validation.ts : échéance, priorité, catégorie et
 * temps estimé sont facultatifs et ne bloquent jamais).
 *
 * On teste donc la CRÉATION RÉELLE au lieu de la simple présence d'un bouton —
 * filet de sécurité nettement plus utile : mutation + toast nominatif +
 * réinitialisation du formulaire + persistance dans la liste.
 *
 * Anti-flake : la liste démo contient 100 tâches triées par priorité par
 * défaut, et la vue mobile virtualise au-delà de 50 items — la tâche créée
 * (priorité 0) n'est donc pas forcément rendue. On la retrouve via la
 * recherche, ce qui rend l'assertion déterministe quel que soit le viewport.
 */
test('démo : créer une tâche l\'ajoute à la liste', async ({ demoPage: page }) => {
  // Navigation SPA viewport-aware (sidebar desktop ou tab bar mobile)
  await navTo(page, /to ?do|tâches|tasks/i, /\/tasks/);
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });

  // Bouton de création : « Créer une nouvelle tâche » (header desktop,
  // `hidden md:flex`) ou « Créer une tâche » (FAB mobile monté par Layout).
  // Les deux coexistent dans le DOM → filter({ visible: true }).
  const createBtn = page
    .getByRole('button', { name: /^créer une (nouvelle )?tâche$/i })
    .filter({ visible: true })
    .first();
  await createBtn.click({ timeout: 10_000 });

  const dialog = page.getByRole('dialog', { name: /créer une nouvelle tâche/i });
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  // Nom : seul champ obligatoire. Desktop = <label for="task-name">,
  // mobile = input au placeholder « Nom de la tâche » (nom accessible de
  // dernier recours selon HTML-AAM) → rôle + nom couvrent les deux viewports.
  const taskName = `E2E task ${Date.now()}`;
  const nameField = dialog.getByRole('textbox', { name: /nom de la tâche/i }).first();
  await nameField.fill(taskName);

  // Le CTA de création porte le même libellé sur les deux viewports.
  await dialog
    .getByRole('button', { name: /^créer la tâche$/i })
    .filter({ visible: true })
    .first()
    .click();

  // Toast de confirmation NOMINATIF (useTaskModal → resetCreateForm) : prouve
  // que la mutation a abouti pour CETTE tâche, pas juste qu'« un » toast est né.
  await expect(
    page.locator('[data-sonner-toast]').filter({ hasText: taskName })
  ).toBeVisible({ timeout: 10_000 });

  // Saisie enchaînée (resetCreateForm) : le modal reste ouvert, champ vidé.
  await expect(nameField).toHaveValue('');

  // Fermer — `hasChanges` est remis à false, donc pas de ConfirmDiscardDialog.
  await dialog
    .getByRole('button', { name: /^annuler$/i })
    .filter({ visible: true })
    .first()
    .click();
  await expect(dialog).toBeHidden({ timeout: 5_000 });

  // La tâche est bien persistée : on la retrouve par la recherche.
  await page.getByRole('textbox', { name: /rechercher une tâche par nom/i }).fill(taskName);
  // filter({ visible: true }) : la <table> desktop reste dans le DOM en
  // `hidden md:block`, donc sans ce filtre `.first()` résout le <span> CACHÉ
  // de la ligne de table au lieu de celui de la TaskCard mobile.
  await expect(
    page
      .locator('[data-tutorial-id="tasks-list"]')
      .getByText(taskName)
      .filter({ visible: true })
      .first()
  ).toBeVisible({ timeout: 10_000 });

  // Pas de toast d'erreur
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
});
