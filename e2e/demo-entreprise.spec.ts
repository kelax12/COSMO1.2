import type { Page } from '@playwright/test';
import { test, expect, navTo } from './fixtures';

/**
 * Parcours entreprise (reco #19) — mode démo, org « Nova Studio » seedée
 * (6 membres, 3 projets, ~20 tâches, OKR, 1 demande d'adhésion).
 *
 * Couvre les régressions majeures de la zone : la page se monte, les onglets
 * naviguent (état dans l'URL ?tab=), l'Aperçu affiche ses sections (activité,
 * échéances entreprise), le modal de tâche s'ouvre avec son fil de
 * commentaires, l'onglet Membres liste l'annuaire et les cartes d'invitation.
 */
/**
 * Onglet de la barre entreprise (OrganizationPage).
 *
 * ⚠️ Ne PAS ancrer sur la fin du libellé (`/^projets$/i`) : depuis les badges
 * de nouveautés (vague 1 entreprise, 2026-08-08), le compteur porte un
 * `aria-label` (« 3 nouveautés ») qui entre dans le NOM ACCESSIBLE du bouton —
 * lequel vaut donc « Projets 3 nouveautés » dès qu'il y a du neuf dans la
 * démo. Les deux tests qui ancraient la fin tournaient jusqu'au timeout.
 * On ancre au début : « Nouveau projet » ne matche pas, le badge ne gêne plus.
 */
const orgTab = (page: Page, label: RegExp) =>
  page.getByRole('button', { name: label }).filter({ visible: true }).first();

test.describe('Espace entreprise (démo)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('Aperçu : synthèse, activité et échéances entreprise', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);

    // Header org + onglets
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });
    await expect(orgTab(page, /^aperçu/i)).toBeVisible();

    // Sections de l'Aperçu (reco #2 + #11)
    await expect(page.getByRole('heading', { name: /activité de l'équipe/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /échéances de l'entreprise/i })).toBeVisible();

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });

  test('Onglets : navigation + état dans l\'URL (?tab=)', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    // Projets
    await orgTab(page, /^projets/i).click();
    await page.waitForURL(/tab=projects/);

    // OKR — le bouton « Nouvel objectif » confirme le contenu de l'onglet
    await orgTab(page, /^okr/i).click();
    await page.waitForURL(/tab=okr/);
    await expect(
      page.getByRole('button', { name: /nouvel objectif/i }).filter({ visible: true }).first()
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });

  test('Tâche d\'équipe : le modal s\'ouvre avec le fil de commentaires', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    // Aperçu → « Mes tâches » : ouvrir la première tâche assignée au compte démo
    const tasksCard = page
      .locator('div')
      .filter({ has: page.getByRole('heading', { name: /^mes tâches/i }) })
      .last();
    // Bouton du nom de tâche (ouvre TeamTaskModal en édition)
    const taskButton = tasksCard.locator('button:has(span.block)').first();
    await taskButton.click({ timeout: 10_000 });

    const dialog = page.getByRole('dialog', { name: /modifier la tâche/i });
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Fil de commentaires (reco #9) présent en mode édition
    await expect(dialog.getByRole('heading', { name: /commentaires/i })).toBeVisible();
    await expect(dialog.getByPlaceholder(/écrire un commentaire/i)).toBeVisible();

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });

  test('Membres : annuaire + cartes d\'invitation', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    await orgTab(page, /^membres/i).click();
    await page.waitForURL(/tab=members/);

    // Annuaire des 6 membres seedés + les deux moyens d'inviter
    await expect(page.getByRole('heading', { name: /annuaire/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/marie dupont/i).first()).toBeVisible();
    await expect(page.getByText(/code d'invitation/i).first()).toBeVisible();

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });
});
