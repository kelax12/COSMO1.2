import { test, expect, navTo, openOrgSection, expectOrgSectionAbsent } from './fixtures';

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

test.describe('Entreprise — modal OKR (démo)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('KR sans unité par défaut, ni cycle, ni parent, ni création d\'équipe', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    await openOrgSection(page, /^okr/i);
    await page.waitForURL(/\/entreprise\/okr/);

    await page.getByRole('button', { name: /nouvel objectif/i }).filter({ visible: true }).first().click();
    const dialog = page.getByRole('dialog', { name: /nouvel objectif d'équipe/i });
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Unité du 1er KR vide (placeholder "%" toléré, valeur non pré-remplie).
    await expect(dialog.getByPlaceholder('%')).toHaveValue('');

    // Plus de création d'équipe depuis la fiche d'OKR.
    await expect(dialog.getByRole('button', { name: /nouvelle équipe/i })).toHaveCount(0);

    // Cycle et objectif parent (mig. 160) : arrivés dans la fiche le
    // 2026-09-25, puis RETIRÉS par décision produit, le cycle le 2026-09-28
    // (ea7d47e6, tables dormantes en base) et le parent le 2026-10-01
    // (40745631, « fiche allégée », le lien existant reste lu). Ce cas les
    // exigeait encore et échouait sur un produit conforme à ce qui était voulu.
    await expect(dialog.getByLabel(/^cycle d.okr$/i)).toHaveCount(0);
    await expect(dialog.getByLabel(/contribue à l'objectif/i)).toHaveCount(0);

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });

  // « Pyramide » s'appelle « Organigramme » depuis le 2026-09-28 (93a4ad91,
  // décision produit) ; la route reste `/entreprise/pyramid`.
  // Depuis la mig. 229 (2026-10-30, décision d'Axel : plus de « manager »),
  // l'organigramme est MASQUÉ de la navigation, admin compris (`hidden: true`
  // dans org-sections.ts), et `/entreprise/pyramid` renvoie à l'Aperçu
  // (OrganizationPage). Ce cas exigeait l'inverse.
  test('Organigramme retiré : absent de la navigation, son adresse mène à l\'Aperçu', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    await expectOrgSectionAbsent(page, /^organigramme/i, /^okr/i);

    await page.goto('/entreprise/pyramid');
    // L'Aperçu est peint (un widget nommé), et rien de l'organigramme.
    await expect(page.getByRole('region', { name: /^mes tâches/i }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /afficher la charge/i })).toHaveCount(0);
  });
});
