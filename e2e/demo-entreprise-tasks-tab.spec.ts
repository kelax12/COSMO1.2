import type { Page } from '@playwright/test';
import { test, expect, navTo, openOrgSection } from './fixtures';

/**
 * Onglet « Tâches » de l'espace entreprise (entre Pyramide et Projets) —
 * mode démo, org seedée « Nova Studio ». Même langage visuel que la page
 * Tâches personnelle (TaskTable), mais les projets tiennent lieu de listes
 * d'accès rapide et remplacent la colonne Catégorie.
 *
 * ⚠️ Même précaution que les autres specs entreprise : ancrer les onglets au
 * DÉBUT du libellé (le badge de nouveautés entre dans le nom accessible).
 */

/**
 * Les lignes de TÂCHE du tableau, sans les en-têtes de groupe.
 *
 * ⚠️ Depuis la fusion tri/regroupement du 2026-09-27, le tableau s'ouvre
 * groupé « Par priorité » : chaque groupe ajoute une ligne d'en-tête
 * (« Replier ou déplier « P1 · Critique » »). `tbody tr` les comptait.
 */
const taskRows = (page: Page) =>
  page.locator('tbody tr').filter({ has: page.getByRole('button', { name: /^actions pour /i }) });

test.describe('Entreprise — onglet Tâches (démo)', () => {
  test.describe.configure({ timeout: 120_000 });

  // L'accès rapide porte les LISTES de l'organisation depuis la mig. 203
  // (21ae8662, 2026-09-28), plus les projets : ce cas cherchait la pastille
  // « Interne » (un projet) et expirait. La propriété est la même : choisir
  // une pastille réduit le tableau, et le compteur qu'elle affiche dit vrai.
  test('Pastilles de liste : filtrer réduit la table à la liste choisie', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    await openOrgSection(page, /^tâches/i);
    await page.waitForURL(/\/entreprise\/tasks/);
    await expect(page.getByRole('columnheader', { name: 'PROJET', exact: true })).toBeVisible({ timeout: 15_000 });

    const rows = taskRows(page);
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    const totalCount = await rows.count();

    // Seed « Revue du vendredi » : une liste d'organisation, son compteur
    // dans son nom accessible (« Revue du vendredi 3 »).
    const chip = page.getByRole('button', { name: /^revue du vendredi \d+$/i });
    const announced = Number((await chip.getAttribute('aria-label') ?? (await chip.innerText())).match(/(\d+)\s*$/)?.[1]);
    expect(announced).toBeGreaterThan(0);
    expect(announced).toBeLessThan(totalCount);

    await chip.click();
    await expect(rows).toHaveCount(announced, { timeout: 5_000 });

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });

  test('Recherche : ne garde que les tâches dont le nom correspond', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await openOrgSection(page, /^tâches/i);
    await page.waitForURL(/\/entreprise\/tasks/);
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
    await openOrgSection(page, /^tâches/i);
    await page.waitForURL(/\/entreprise\/tasks/);
    const nameHeader = page.getByRole('columnheader', { name: /nom de la tâche/i });
    await expect(nameHeader).toBeVisible({ timeout: 15_000 });

    // ⚠️ Le critère de tri vit dans l'URL depuis la fusion tri/regroupement du
    // 2026-09-27 (`?fGroup=`) : le tableau se repeint APRÈS la navigation, pas
    // dans le même rendu que le clic. Une lecture immédiate relisait l'ordre
    // par priorité. On attend donc l'ordre, on ne le lit pas une fois.
    //
    // ⚠️ Et le tableau est VIRTUALISÉ (fe2a1dd6) : seules les lignes de la
    // fenêtre sont dans le DOM, donc l'ensemble lu change avec le sens. Mesuré :
    // la lecture descendante n'avait pas les mêmes noms que l'ascendante. On
    // vérifie l'ORDRE de chaque lecture, et que le sens a bien basculé.
    const names = () => page.locator('tbody tr td:nth-child(3)').allInnerTexts();
    const byName = (a: string, b: string) => a.localeCompare(b, 'fr');
    let firstAsc = '';
    await nameHeader.click();
    await expect(async () => {
      const namesAsc = await names();
      expect(namesAsc.length).toBeGreaterThan(1);
      expect(namesAsc).toEqual([...namesAsc].sort(byName));
      firstAsc = namesAsc[0];
    }).toPass({ timeout: 5_000 });

    // Recliquer inverse le sens — même en-tête = bascule, pas un nouveau tri.
    await nameHeader.click();
    await expect(async () => {
      const namesDesc = await names();
      expect(namesDesc.length).toBeGreaterThan(1);
      expect(namesDesc).toEqual([...namesDesc].sort(byName).reverse());
      expect(namesDesc[0]).not.toBe(firstAsc);
    }).toPass({ timeout: 5_000 });
  });

  test('Nouvelle tâche : le bouton ouvre le modal de création', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await openOrgSection(page, /^tâches/i);
    await page.waitForURL(/\/entreprise\/tasks/);
    await expect(page.getByRole('button', { name: /nouvelle tâche/i })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /nouvelle tâche/i }).click();
    await expect(page.getByRole('dialog', { name: /nouvelle tâche d'équipe/i })).toBeVisible({ timeout: 5_000 });
  });

  test('Suppression : réversible via le toast Annuler, la ligne revient', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await openOrgSection(page, /^tâches/i);
    await page.waitForURL(/\/entreprise\/tasks/);
    await expect(page.getByRole('columnheader', { name: 'PROJET', exact: true })).toBeVisible({ timeout: 15_000 });

    // ⚠️ On suit la ligne de CETTE tâche, plus un nombre de `tbody tr` : les
    // en-têtes de groupe y entrent, et le tableau (virtualisé) se remplit par
    // étapes. Mesuré : 12 lignes au relevé, 18 après la suppression.
    const actions = page.getByRole('button', { name: /^Actions pour / }).first();
    const taskName = (await actions.getAttribute('aria-label'))!.replace(/^Actions pour /, '');
    const row = taskRows(page).filter({ has: page.getByRole('button', { name: `Actions pour ${taskName}`, exact: true }) });
    await expect(row).toHaveCount(1);

    await actions.click();
    await page.getByRole('menuitem', { name: /^supprimer$/i }).click();
    await expect(row).toHaveCount(0, { timeout: 5_000 });

    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /tâche supprimée/i });
    await expect(toast).toBeVisible({ timeout: 5_000 });
    await toast.getByRole('button', { name: /annuler/i }).click();

    await expect(row).toHaveCount(1, { timeout: 5_000 });
  });
});
