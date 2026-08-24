import type { Page } from '@playwright/test';
import { test, expect, navTo } from './fixtures';

/**
 * Régression des correctifs mode entreprise livrés en session (2026-08-24) :
 *   1. Description en grand (TeamTaskModal) — invisible derrière la modale
 *      custom (z-[9999]) avant le fix du z-index de DescriptionField.
 *   2. Format de charge x/y dans la Pyramide (x = non en retard, y = en retard).
 *   3. « Assigner l'événement » (table Tâches) ne montre QUE la tâche ciblée
 *      dans la sidebar de l'agenda — sans toucher au flux Pyramide → « Voir
 *      l'agenda », qui doit rester inchangé (toutes les tâches du membre).
 *   4. Bouton « Exporter CSV » masqué dans l'onglet Statistiques (la
 *      fonctionnalité reste en place, seul le bouton disparaît).
 *
 * ⚠️ Même précaution que les autres specs entreprise : ancrer les onglets au
 * DÉBUT du libellé (le badge de nouveautés entre dans le nom accessible).
 */
const orgTab = (page: Page, label: RegExp) =>
  page.getByRole('button', { name: label }).filter({ visible: true }).first();

test.describe('Entreprise — correctifs de session (démo)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('Description en grand : la popup s\'ouvre au-dessus du modal et reste synchronisée', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    await orgTab(page, /^tâches/i).click();
    await page.waitForURL(/tab=tasks/);
    await expect(page.getByRole('columnheader', { name: 'PROJET', exact: true })).toBeVisible({ timeout: 15_000 });

    // Ouvre la première tâche (clic sur la ligne, hors cases à stopPropagation).
    await page.locator('tbody tr td:nth-child(3)').first().click();
    const dialog = page.getByRole('dialog', { name: /modifier la tâche/i });
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const compactTextarea = dialog.locator('#team-task-desc');
    await compactTextarea.fill('Texte compact avant agrandissement');

    await dialog.getByRole('button', { name: /agrandir la description/i }).click();

    // Le titre de la popup plein écran est "Description" (expandedTitle).
    const expandedDialog = page.getByRole('dialog', { name: /^description$/i });
    await expect(expandedDialog).toBeVisible({ timeout: 5_000 });

    const expandedTextarea = expandedDialog.locator('textarea');
    // `.fill()` échoue si l'élément est couvert par un autre (actionability
    // Playwright) — c'est exactement le mode de panne du bug avant le fix
    // (popup montée à z-50, cachée derrière le modal entreprise à z-[9999]).
    await expandedTextarea.fill('Texte saisi en plein écran');
    await expect(expandedTextarea).toHaveValue('Texte saisi en plein écran');

    await expandedDialog.getByRole('button', { name: /fermer et revenir au formulaire/i }).click();
    await expect(expandedDialog).toBeHidden();

    // Champ contrôlé : la valeur tapée en plein écran redescend sur le champ compact.
    await expect(compactTextarea).toHaveValue('Texte saisi en plein écran');

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });

  test('Pyramide : la charge par membre s\'affiche au format x/y', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    await orgTab(page, /^pyramide/i).click();
    await page.waitForURL(/tab=pyramid/);

    await page.getByRole('button', { name: /afficher la charge/i }).click();

    // Le "/" est un séparateur littéral entre deux entiers, jamais un symbole
    // de division — au moins un membre avec de la charge doit l'afficher.
    const badge = page.getByText(/^\d+\/\d+$/).first();
    await expect(badge).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });

  test('Assigner l\'événement : la sidebar ne montre que la tâche ciblée', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    await orgTab(page, /^tâches/i).click();
    await page.waitForURL(/tab=tasks/);
    await expect(page.getByRole('columnheader', { name: 'PROJET', exact: true })).toBeVisible({ timeout: 15_000 });

    const actionsBtn = page.getByRole('button', { name: /^Actions pour/ }).first();
    const ariaLabel = await actionsBtn.getAttribute('aria-label');
    const taskName = ariaLabel!.replace(/^Actions pour /, '');

    await actionsBtn.click();
    await page.getByRole('menuitem', { name: /assigner l'événement/i }).click();

    const sidebarItems = page.locator('#member-external-events .member-external-event');
    await expect(sidebarItems).toHaveCount(1, { timeout: 10_000 });
    await expect(sidebarItems.first()).toContainText(taskName);

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });

  test('Pyramide → Voir l\'agenda : la sidebar reste inchangée (toutes les tâches du membre)', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    await orgTab(page, /^pyramide/i).click();
    await page.waitForURL(/tab=pyramid/);

    // Menu « Actions pour X » → « Voir son agenda » (pyramid.tsx,
    // onOpenMember(m, 'agenda')) — c'est le chemin réel de la fonctionnalité,
    // pas un clic sur la carte (qui replie/déplie l'équipe).
    await page.getByRole('button', { name: /^Actions pour Jean Martin/ }).click();
    await page.getByRole('menuitem', { name: /voir son agenda/i }).click();
    await page.getByRole('tab', { name: /^agenda$/i }).click();

    const sidebarItems = page.locator('#member-external-events .member-external-event');
    await expect(sidebarItems.first()).toBeVisible({ timeout: 10_000 });
    // Toutes les tâches du membre (pas une seule) : contrairement au flux
    // « Assigner l'événement », ce chemin n'a pas de `onlyTaskId`.
    await expect(async () => {
      expect(await sidebarItems.count()).toBeGreaterThan(1);
    }).toPass({ timeout: 10_000 });

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });

  test('Statistiques : le bouton Exporter CSV est masqué (fonctionnalité conservée)', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    await orgTab(page, /^statistiques/i).click();
    await page.waitForURL(/tab=stats/);

    // Sanity : l'onglet a bien rendu (sélecteur de période) avant de vérifier
    // l'absence — sinon un onglet vide donnerait un faux positif.
    await expect(page.getByRole('tablist').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /exporter csv/i })).toHaveCount(0);

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });
});
