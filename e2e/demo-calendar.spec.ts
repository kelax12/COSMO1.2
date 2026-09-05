import type { Locator, Page } from '@playwright/test';
import { test, expect, navTo } from './fixtures';

/**
 * ═══════════════════════════════════════════════════════════════════
 * C-27 — le calendrier COSMO sur ses six surfaces
 * ═══════════════════════════════════════════════════════════════════
 *
 * Le 2026-08-30, le calendrier maison a remplacé le picker natif du navigateur
 * sur six surfaces (cf. `docs/UI-PATTERNS.md`). Le remplacement a été vérifié
 * **à la main**, une fois, et rien ne l'a plus jamais regardé : une des six
 * pouvait redevenir un `input[type=date]` sans qu'aucun test ne bouge.
 *
 * Ce que ces cas mesurent, surface par surface :
 *  • le calendrier COSMO s'ouvre — sa rangée de raccourcis ET sa grille ;
 *  • aucun `input[type=date]` ne subsiste dans la surface ouverte.
 *
 * ⚠️ Les DEUX pickers natifs d'`EventModalForm` ne sont PAS couverts, et c'est
 * volontaire : sur téléphone, la roue système vaut mieux que n'importe quel
 * calendrier maison. Un test qui les compterait comme un défaut ferait
 * pression pour supprimer un arbitrage rendu.
 *
 * S'y ajoutent deux propriétés que la surface seule ne dit pas :
 *  • `minDate` sur le report en masse — sans elle on reporte une tâche en
 *    retard VERS HIER ;
 *  • les flèches déplacent le focus dans la grille — le défaut React 18 /
 *    `forwardRef` qui a rendu `CalendarDayButton` muet au clavier.
 */

/** Rangée de raccourcis : `role="group"` nommé, propre au calendrier COSMO. */
const PRESETS = /raccourcis de date/i;

/**
 * Le calendrier COSMO est ouvert, et le picker natif a bien disparu.
 *
 * ❌ Ne jamais se contenter de la grille : `input[type=date]` ouvre lui aussi
 * une grille, celle du navigateur, hors du DOM. Ce qui distingue les deux ici,
 * c'est la rangée de raccourcis — elle n'existe que dans le nôtre.
 */
async function expectCosmoCalendar(page: Page, surface: Locator): Promise<void> {
  await expect(page.getByRole('group', { name: PRESETS })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('grid').filter({ visible: true }).first()).toBeVisible();
  await expect(surface.locator('input[type="date"]')).toHaveCount(0);
}

const orgTab = (page: Page, label: RegExp) =>
  page.getByRole('button', { name: label }).filter({ visible: true }).first();

/** Menu d'actions de la première tâche : `…` desktop ou « Options » mobile. */
async function openFirstRowMenu(page: Page): Promise<void> {
  const trigger = page
    .getByRole('button', { name: /^(actions pour |options$)/i })
    .filter({ visible: true })
    .first();
  await trigger.click({ timeout: 10_000 });
}

test.describe('C-27 — le calendrier COSMO, surface par surface (démo)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('surface 1 — « Planifier dans l’agenda »', async ({ demoPage: page }) => {
    await navTo(page, /to ?do|tâches|tasks/i, /\/tasks/);
    await openFirstRowMenu(page);
    await page.getByRole('menuitem', { name: /^planifier$/i }).click();

    const dialog = page.getByRole('dialog', { name: /planifier dans l'agenda/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: /date/i }).first().click();
    await expectCosmoCalendar(page, dialog);
  });

  test('surface 2 — l’échéance de la popup de dépendances PERSONNELLES', async ({
    demoPage: page,
  }) => {
    await navTo(page, /to ?do|tâches|tasks/i, /\/tasks/);
    await openFirstRowMenu(page);
    await page.getByRole('menuitem', { name: /^modifier$/i }).click();

    const taskDialog = page.getByRole('dialog', { name: /modifier la tâche/i });
    await expect(taskDialog).toBeVisible({ timeout: 10_000 });
    // ⚠️ La section « Dépendances » est REPLIÉE à l'ouverture : sans ce clic,
    // le bouton d'ajout n'existe pas dans le DOM.
    await taskDialog.getByRole('button', { name: /^dépendances/i }).first().click();
    await taskDialog.getByRole('button', { name: /ajouter une dépendance/i }).click();

    const picker = page.getByRole('dialog', { name: /ajouter une dépendance/i });
    await expect(picker).toBeVisible({ timeout: 10_000 });
    // Le champ Échéance vit dans le mode « créer une tâche » de la popup.
    await picker.getByRole('button', { name: /^créer une tâche$/i }).click();
    await picker.getByRole('button', { name: /échéance|sélectionner une date/i }).first().click();
    await expectCosmoCalendar(page, picker);
  });

  test('surface 3 — le report en masse des tâches en retard borne à aujourd’hui', async ({
    demoPage: page,
  }) => {
    await navTo(page, /to ?do|tâches|tasks/i, /\/tasks/);

    const rescheduleAll = page
      .getByRole('button', { name: /tout replanifier/i })
      .filter({ visible: true })
      .first();
    await expect(rescheduleAll).toBeVisible({ timeout: 15_000 });
    await rescheduleAll.click();
    await page.getByRole('menuitem', { name: /choisir une date/i }).click();

    const menu = page.getByRole('menu').filter({ visible: true }).first();
    await expectCosmoCalendar(page, menu);

    // 🔴 `minDate` : sans elle, on reporte une tâche EN RETARD vers hier. Le
    // jour d'hier doit donc être présent dans la grille et refusé.
    // On vise la case par sa DATE (`data-day`), jamais par son numéro : « 4 »
    // matche aussi le 14 et le 24. Et l'état désactivé de react-day-picker est
    // porté par `data-disabled`, pas par `aria-disabled`.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayCell = page.locator(`td[data-day="${yesterday.toLocaleDateString('en-CA')}"]`);
    if (await yesterdayCell.first().isVisible().catch(() => false)) {
      await expect(yesterdayCell.first()).toHaveAttribute('data-disabled', 'true');
    }
    // ⚠️ Le `if` ci-dessus n'est pas une échappatoire : le 1er du mois, hier
    // n'est pas dans la grille affichée. Le TÉMOIN est ici — aujourd'hui y est
    // toujours, et doit rester ACTIVÉ, sinon la borne aurait tout emporté et
    // l'assertion précédente serait vraie pour la mauvaise raison.
    const todayCell = page.locator(`td[data-day="${new Date().toLocaleDateString('en-CA')}"]`);
    await expect(todayCell.first()).toBeVisible();
    await expect(todayCell.first()).not.toHaveAttribute('data-disabled', 'true');
    // Et le raccourci « Aujourd'hui » reste proposé : la borne ne doit pas
    // vider la rangée de raccourcis.
    await expect(page.getByRole('button', { name: /^aujourd'hui$/i }).first()).toBeVisible();
  });

  test('surface 4 — la deadline de la barre de sélection', async ({ demoPage: page }) => {
    await navTo(page, /to ?do|tâches|tasks/i, /\/tasks/);
    await page
      .getByRole('button', { name: /^sélectionner$/i })
      .filter({ visible: true })
      .first()
      .click();

    // Cocher une tâche : sans sélection, « Plus d'actions » reste DÉSACTIVÉ.
    //
    // ⚠️ La case de sélection du tableau desktop n'a AUCUN nom accessible
    // (`motion.button` nu, cf. `task-table/list.tsx`) — d'où le passage par sa
    // position. Sur mobile la même case est nommée. Ce n'est pas une commodité
    // de test : c'est un défaut d'accessibilité de la version desktop, et le
    // contournement ici en est la trace.
    const mobileBox = page
      .getByRole('button', { name: /^ajouter à la liste$/i })
      .filter({ visible: true })
      .first();
    if (await mobileBox.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await mobileBox.click();
    } else {
      await page.locator('tbody tr').first().locator('td').first().getByRole('button').first().click();
    }
    const bulkBar = page.getByRole('menu', { name: /actions supplémentaires/i });

    await page
      .getByRole('button', { name: /plus d'actions/i })
      .filter({ visible: true })
      .first()
      .click();
    await page.getByRole('menuitem', { name: /modifier la deadline/i }).click();
    await expectCosmoCalendar(page, bulkBar);
  });

  test('surface 5 — l’échéance d’une tâche d’ÉQUIPE', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await orgTab(page, /^tâches/i).click();
    await page.waitForURL(/tab=tasks/);
    await page.locator('tbody tr').first().click({ timeout: 15_000 });

    const dialog = page.getByRole('dialog').filter({ visible: true }).first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: /échéance|sélectionner une date/i }).first().click();
    await expectCosmoCalendar(page, dialog);
  });

  test('surface 6 — l’échéance de la popup de dépendances d’ÉQUIPE', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await orgTab(page, /^tâches/i).click();
    await page.waitForURL(/tab=tasks/);
    await page.locator('tbody tr').first().click({ timeout: 15_000 });

    const taskDialog = page.getByRole('dialog').filter({ visible: true }).first();
    await taskDialog.getByRole('button', { name: /^dépendances/i }).first().click();
    await taskDialog.getByRole('button', { name: /ajouter une dépendance/i }).click();

    const picker = page.getByRole('dialog', { name: /ajouter une dépendance/i });
    await expect(picker).toBeVisible({ timeout: 10_000 });
    await picker.getByRole('button', { name: /^créer une tâche$/i }).click();
    await picker.getByRole('button', { name: /échéance|sélectionner une date/i }).first().click();
    await expectCosmoCalendar(page, picker);
  });

  test('les flèches déplacent le focus dans la grille (React 18 / forwardRef)', async ({
    demoPage: page,
  }) => {
    await navTo(page, /to ?do|tâches|tasks/i, /\/tasks/);
    await openFirstRowMenu(page);
    await page.getByRole('menuitem', { name: /^planifier$/i }).click();

    const dialog = page.getByRole('dialog', { name: /planifier dans l'agenda/i });
    await dialog.getByRole('button', { name: /date/i }).first().click();
    await expect(page.getByRole('group', { name: PRESETS })).toBeVisible({ timeout: 10_000 });

    // `autoFocus` (et non `initialFocus`, mort depuis react-day-picker 9) doit
    // avoir posé le focus DANS la grille, pas sur la rangée de raccourcis.
    const before = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    await page.keyboard.press('ArrowRight');
    const after = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));

    // 🔴 Le vrai défaut : `ref.current?.focus()` de `CalendarDayButton` ne
    // faisait RIEN, parce que `Button` n'était pas un `forwardRef` et que ce
    // projet est sur React 18. Le focus ne bougeait donc jamais.
    expect(before).toBeTruthy();
    expect(after).not.toBe(before);
  });
});
