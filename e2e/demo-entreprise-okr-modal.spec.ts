import type { Page } from '@playwright/test';
import { test, expect, navTo } from './fixtures';

/**
 * Modal « Nouvel objectif d'équipe » (TeamOKRModal) — mode démo, org « Nova
 * Studio ». Couvre deux correctifs de session (2026-08-24) :
 *   - le KR (métrique) n'a plus d'unité pré-remplie ("%") ;
 *   - la section Visibilité propose « + Nouvelle équipe », même geste que
 *     « + Nouvelle catégorie » (OKRCategoryPicker) : créer sans quitter le
 *     modal, l'équipe créée est immédiatement sélectionnée.
 *
 * Le redesign du champ Échéance (style aligné sur TeamTaskModal + icône
 * teintée) n'est pas vérifiable en e2e : la popup native `<input type=date>`
 * est hors DOM (chrome du navigateur), et la couleur de l'icône ne passe pas
 * par `getComputedStyle` (pseudo-élément UA). Vérifié manuellement + par
 * lecture de la règle CSS chargée (cf. session).
 */
const orgTab = (page: Page, label: RegExp) =>
  page.getByRole('button', { name: label }).filter({ visible: true }).first();

test.describe('Entreprise — modal OKR (démo)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('KR sans unité par défaut + création d\'équipe inline depuis la Visibilité', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    await orgTab(page, /^okr/i).click();
    await page.waitForURL(/tab=okr/);

    await page.getByRole('button', { name: /nouvel objectif/i }).filter({ visible: true }).first().click();
    const dialog = page.getByRole('dialog', { name: /nouvel objectif d'équipe/i });
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Unité du 1er KR vide (placeholder "%" toléré, valeur non pré-remplie).
    await expect(dialog.getByPlaceholder('%')).toHaveValue('');

    // « + Nouvelle équipe » — même geste que « + Nouvelle catégorie ».
    await dialog.getByRole('button', { name: /nouvelle équipe/i }).click();
    await dialog.getByPlaceholder(/ex\s*:\s*marketing/i).fill('QA Team');
    await dialog.getByRole('button', { name: /créer l'équipe/i }).click();

    // La nouvelle équipe apparaît dans les chips de visibilité, sélectionnée.
    const teamChip = dialog.getByRole('button', { name: /^QA Team$/i });
    await expect(teamChip).toBeVisible({ timeout: 10_000 });
    await expect(teamChip).toHaveClass(/bg-\[rgb\(var\(--color-accent-solid\)\)\]/);

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });

  test('Pyramide reste visible pour l\'admin (régression du masquage managerOnly)', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    // L'admin (compte démo, propriétaire de Nova Studio) reste manager par
    // construction (isAdmin || isManagerOf) — l'onglet ne doit pas disparaître.
    await expect(orgTab(page, /^pyramide/i)).toBeVisible({ timeout: 10_000 });
  });
});
