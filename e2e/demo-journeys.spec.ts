import { test, expect } from './fixtures';

/**
 * Parcours approfondis (audit 9/10 phase 4) — vont au-delà des smoke tests :
 * ils exercent une MUTATION réelle (toggle complétion) et la PERSISTANCE
 * (localStorage démo) à travers une navigation SPA.
 *
 * Règles fixtures respectées : navigation par NavLink uniquement (jamais
 * page.goto → full reload qui casse le mode démo), toasts d'erreur détectés
 * via [data-sonner-toast][data-type="error"].
 *
 * Sélecteurs stables : marqueurs data-tutorial-id (contrat documenté
 * CLAUDE.md « Ne pas renommer sans grep ») + rôles ARIA (les checkboxes
 * custom portent role=checkbox + aria-checked — faille A-1/A-2).
 *
 * Anti-flake : les assertions de toggle sont basées sur le COMPTAGE des
 * checkboxes non cochées — un `.first()` se re-résout vers un AUTRE élément
 * quand la liste se réordonne après mutation (AnimatePresence), un compte
 * global non.
 */

test('démo : compléter une tâche décrémente les tâches non cochées', async ({ demoPage: page }) => {
  await page.getByRole('link', { name: /to ?do|tâches|tasks/i }).first().click();
  await page.waitForURL(/\/tasks/);
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 });

  const list = page.locator('[data-tutorial-id="tasks-list"]');
  await expect(list).toBeVisible({ timeout: 15_000 });

  const unchecked = list.locator('[role="checkbox"][aria-checked="false"]');
  await expect(unchecked.first()).toBeVisible({ timeout: 10_000 });
  const before = await unchecked.count();
  expect(before).toBeGreaterThan(0);

  await unchecked.first().click();

  // Quelle que soit la réaction UI (case cochée OU ligne sortie du filtre),
  // le nombre de non-cochées doit diminuer d'exactement 1.
  await expect.poll(() => unchecked.count(), { timeout: 7_000 }).toBe(before - 1);

  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
});

test('démo : toggle d\'habitude PERSISTE à travers une navigation SPA', async ({ demoPage: page }) => {
  await page.getByRole('link', { name: /habitudes|habits/i }).first().click();
  await page.waitForURL(/\/habits/);
  // Compile à froid Vite : attendre le rendu avant de chercher le marqueur.
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 });

  // La vue par défaut est « Tableau » (le marqueur habits-list n'existe que
  // dans la vue « Liste ») — on scope sur <main> + rôles ARIA des DayButtons.
  const main = page.getByRole('main');
  const checkboxes = main.locator('[role="checkbox"]');
  await expect(checkboxes.first()).toBeVisible({ timeout: 15_000 });

  const checkedCount = () => main.locator('[role="checkbox"][aria-checked="true"]').count();
  const before = await checkedCount();

  // Toggle de la première case (jour × habitude) — l'ordre des habitudes est
  // stable (pas de réordonnancement à la complétion).
  await checkboxes.first().click();
  await expect.poll(checkedCount, { timeout: 7_000 }).not.toBe(before);
  const after = await checkedCount();

  // Aller-retour SPA : l'état doit survivre (repo localStorage démo).
  await page.getByRole('link', { name: /accueil|dashboard|tableau/i }).first().click();
  await page.waitForURL(/\/$|\/dashboard/);
  await page.getByRole('link', { name: /habitudes|habits/i }).first().click();
  await page.waitForURL(/\/habits/);

  const mainAfter = page.getByRole('main');
  await expect(mainAfter.locator('[role="checkbox"]').first()).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(() => mainAfter.locator('[role="checkbox"][aria-checked="true"]').count(), { timeout: 10_000 })
    .toBe(after);

  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
});

test('démo : la page OKR rend la première carte avec sa progression', async ({ demoPage: page }) => {
  await page.getByRole('link', { name: /okr/i }).first().click();
  await page.waitForURL(/\/okr/);

  // Marqueur stable du tutoriel — première carte OKR rendue.
  const firstCard = page.locator('[data-tutorial-id="okr-first-card"]');
  await expect(firstCard).toBeVisible({ timeout: 15_000 });

  // La carte affiche une progression (seeds démo : 3 OKRs actifs avec %).
  await expect(page.locator('text=/%/').first()).toBeVisible({ timeout: 5_000 });

  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
});
