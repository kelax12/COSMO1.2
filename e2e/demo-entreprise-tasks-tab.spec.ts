import type { Page } from '@playwright/test';
import { test, expect, navTo } from './fixtures';

/**
 * Onglet « Tâches » de l'espace entreprise (entre Pyramide et Projets) —
 * mode démo, org seedée « Nova Studio ». Même langage visuel que la page
 * Tâches personnelle (TaskTable), mais les projets tiennent lieu de listes
 * d'accès rapide et remplacent la colonne Catégorie.
 *
 * ⚠️ Même précaution que les autres specs entreprise : ancrer les onglets au
 * DÉBUT du libellé (le badge de nouveautés entre dans le nom accessible).
 */
const orgTab = (page: Page, label: RegExp) =>
  page.getByRole('button', { name: label }).filter({ visible: true }).first();

test.describe('Entreprise — onglet Tâches (démo)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('Chips de projet : filtrer réduit la table au projet choisi', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    await orgTab(page, /^tâches/i).click();
    await page.waitForURL(/tab=tasks/);
    await expect(page.getByRole('columnheader', { name: 'PROJET', exact: true })).toBeVisible({ timeout: 15_000 });

    const rows = page.locator('tbody tr');
    const totalCount = await rows.count();
    expect(totalCount).toBeGreaterThan(0);

    // Seed « Interne » (mig. locale) : projet d'org, team_id null.
    await page.getByRole('button', { name: /^Interne/ }).click();
    await expect(async () => {
      const filteredCount = await rows.count();
      expect(filteredCount).toBeLessThan(totalCount);
      expect(filteredCount).toBeGreaterThan(0);
    }).toPass({ timeout: 5_000 });

    // Chaque ligne visible doit vraiment appartenir au projet filtré.
    const projectCells = await page.locator('tbody tr td:nth-child(4)').allInnerTexts();
    for (const cell of projectCells) expect(cell.trim()).toBe('Interne');

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });

  test('Recherche : ne garde que les tâches dont le nom correspond', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await orgTab(page, /^tâches/i).click();
    await page.waitForURL(/tab=tasks/);
    await expect(page.getByPlaceholder(/rechercher/i)).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder(/rechercher/i).fill('budget');

    await expect(async () => {
      const names = await page.locator('tbody tr td:nth-child(3)').allInnerTexts();
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) expect(name.toLowerCase()).toContain('budget');
    }).toPass({ timeout: 5_000 });
  });

  test('Tri : cliquer l’en-tête Nom trie alphabétiquement et bascule le sens', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await orgTab(page, /^tâches/i).click();
    await page.waitForURL(/tab=tasks/);
    const nameHeader = page.getByRole('columnheader', { name: /nom de la tâche/i });
    await expect(nameHeader).toBeVisible({ timeout: 15_000 });

    await nameHeader.click();
    const namesAsc = await page.locator('tbody tr td:nth-child(3)').allInnerTexts();
    const sortedAsc = [...namesAsc].sort((a, b) => a.localeCompare(b, 'fr'));
    expect(namesAsc).toEqual(sortedAsc);

    // Recliquer inverse le sens — même en-tête = bascule, pas un nouveau tri.
    await nameHeader.click();
    const namesDesc = await page.locator('tbody tr td:nth-child(3)').allInnerTexts();
    expect(namesDesc).toEqual([...sortedAsc].reverse());
  });

  test('Nouvelle tâche : le bouton ouvre le modal de création', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await orgTab(page, /^tâches/i).click();
    await page.waitForURL(/tab=tasks/);
    await expect(page.getByRole('button', { name: /nouvelle tâche/i })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /nouvelle tâche/i }).click();
    await expect(page.getByRole('dialog', { name: /nouvelle tâche d'équipe/i })).toBeVisible({ timeout: 5_000 });
  });

  test('Suppression : réversible via le toast Annuler, la ligne revient', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await orgTab(page, /^tâches/i).click();
    await page.waitForURL(/tab=tasks/);
    await expect(page.getByRole('columnheader', { name: 'PROJET', exact: true })).toBeVisible({ timeout: 15_000 });

    const rows = page.locator('tbody tr');
    const before = await rows.count();

    await page.getByRole('button', { name: /^Actions pour/ }).first().click();
    await page.getByRole('menuitem', { name: /^supprimer$/i }).click();

    await expect(async () => {
      expect(await rows.count()).toBe(before - 1);
    }).toPass({ timeout: 5_000 });

    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /tâche supprimée/i });
    await expect(toast).toBeVisible({ timeout: 5_000 });
    await toast.getByRole('button', { name: /annuler/i }).click();

    await expect(async () => {
      expect(await rows.count()).toBe(before);
    }).toPass({ timeout: 5_000 });
  });
});
