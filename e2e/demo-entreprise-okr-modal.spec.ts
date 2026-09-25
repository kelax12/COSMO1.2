import type { Page } from '@playwright/test';
import { test, expect, navTo } from './fixtures';

/**
 * Modal « Nouvel objectif d'équipe » (TeamOKRModal) — mode démo, org « Nova
 * Studio ». Couvre deux correctifs de session (2026-08-24) :
 *   - le KR (métrique) n'a plus d'unité pré-remplie ("%") ;
 *   - 🔴 la section Visibilité NE propose PLUS « + Nouvelle équipe » (audit
 *     des popups du 2026-09-25) : l'équipe y naissait sans membres ni
 *     responsable. À la place, cycle et objectif parent (mig. 160).
 *
 * Le redesign du champ Échéance (style aligné sur TeamTaskModal + icône
 * teintée) n'est pas vérifiable en e2e : la popup native `<input type=date>`
 * est hors DOM (chrome du navigateur), et la couleur de l'icône ne passe pas
 * par `getComputedStyle` (pseudo-élément UA). Vérifié manuellement + par
 * lecture de la règle CSS chargée (cf. session).
 */
// Navigation entreprise (2026-09-23) : une section = une route, et un LIEN dans
// `OrgSideNav`. Ces specs cherchaient encore l'ancien bouton d'onglet et
// `?tab=` : elles expiraient toutes à 2 min sur `main` depuis `a0470c1a`.
const orgTab = (page: Page, label: RegExp) =>
  page.getByRole('navigation', { name: /sections de l.entreprise/i }).getByRole('link', { name: label });

test.describe('Entreprise — modal OKR (démo)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('KR sans unité par défaut, cycle et parent, plus de création d\'équipe', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    await orgTab(page, /^okr/i).click();
    await page.waitForURL(/\/entreprise\/okr/);

    await page.getByRole('button', { name: /nouvel objectif/i }).filter({ visible: true }).first().click();
    const dialog = page.getByRole('dialog', { name: /nouvel objectif d'équipe/i });
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Unité du 1er KR vide (placeholder "%" toléré, valeur non pré-remplie).
    await expect(dialog.getByPlaceholder('%')).toHaveValue('');

    // Plus de création d'équipe depuis la fiche d'OKR.
    await expect(dialog.getByRole('button', { name: /nouvelle équipe/i })).toHaveCount(0);

    // Cycle et objectif parent (mig. 160), jusqu'ici sans écran.
    await expect(dialog.getByLabel(/^cycle d.okr$/i)).toBeVisible();
    await expect(dialog.getByLabel(/contribue à l'objectif/i)).toBeVisible();

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
