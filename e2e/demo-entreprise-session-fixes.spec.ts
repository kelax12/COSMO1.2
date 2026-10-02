import type { Page } from '@playwright/test';
import { test, expect, navTo, openOrgSection } from './fixtures';

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

// « Pyramide » s'appelle « Organigramme » depuis le 2026-09-28 (93a4ad91,
// décision produit) ; la route reste `/entreprise/pyramid`.

/**
 * La liste de tâches de l'agenda d'un membre est REPLIÉE par défaut sous
 * 640 px (`MemberAgendaBody` : `showTasks` initialisé sur la largeur), derrière
 * le bouton bascule « Tâches ». Sous `mobile-safari` (390 px), les deux cas qui
 * la lisent expiraient sur une liste que personne n'avait ouverte, depuis que
 * le project tourne en CI (2026-09-16). On l'ouvre comme une personne le
 * ferait sur téléphone ; au-dessus de 640 px elle l'est déjà, on n'y touche pas.
 */
async function ouvrirListeDesTachesSiRepliee(page: Page) {
  const liste = page.locator('#member-external-events');
  if (await liste.isVisible().catch(() => false)) return;
  await page.getByRole('button', { name: /^tâches$/i }).filter({ visible: true }).last().click();
  await expect(liste).toBeVisible({ timeout: 5_000 });
}

test.describe('Entreprise — correctifs de session (démo)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('Description en grand : la popup s\'ouvre au-dessus du modal et reste synchronisée', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    await openOrgSection(page, /^tâches/i);
    await page.waitForURL(/\/entreprise\/tasks/);
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

  test('Organigramme : la charge par membre s\'affiche (en cours, en retard)', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    await openOrgSection(page, /^organigramme/i);
    await page.waitForURL(/\/entreprise\/pyramid/);

    await page.getByRole('button', { name: /afficher la charge/i }).click();

    // Le format « x/y » a été remplacé le 2026-09-27 par DEUX pastilles, en
    // cours et en retard (8898416e, décision produit) : chacune porte son
    // nombre dans son nom. Au moins un membre de la démo a les deux.
    await expect(page.getByLabel(/^\d+ tâches? en cours$/).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/^\d+ tâches? en retard$/).first()).toBeVisible();

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });

  test('Assigner l\'événement : la sidebar ne montre que la tâche ciblée', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    await openOrgSection(page, /^tâches/i);
    await page.waitForURL(/\/entreprise\/tasks/);
    await expect(page.getByRole('columnheader', { name: 'PROJET', exact: true })).toBeVisible({ timeout: 15_000 });

    const actionsBtn = page.getByRole('button', { name: /^Actions pour/ }).first();
    const ariaLabel = await actionsBtn.getAttribute('aria-label');
    const taskName = ariaLabel!.replace(/^Actions pour /, '');

    await actionsBtn.click();
    await page.getByRole('menuitem', { name: /assigner l'événement/i }).click();
    await ouvrirListeDesTachesSiRepliee(page);

    const sidebarItems = page.locator('#member-external-events .member-external-event');
    await expect(sidebarItems).toHaveCount(1, { timeout: 10_000 });
    await expect(sidebarItems.first()).toContainText(taskName);

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });

  test('Pyramide → Voir l\'agenda : la sidebar reste inchangée (toutes les tâches du membre)', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    await openOrgSection(page, /^organigramme/i);
    await page.waitForURL(/\/entreprise\/pyramid/);

    // Menu « Actions pour X » → « Voir son agenda » (pyramid.tsx,
    // onOpenMember(m, 'agenda')) — c'est le chemin réel de la fonctionnalité,
    // pas un clic sur la carte (qui replie/déplie l'équipe).
    await page.getByRole('button', { name: /^Actions pour Jean Martin/ }).click();
    await page.getByRole('menuitem', { name: /voir son agenda/i }).click();
    await page.getByRole('tab', { name: /^agenda$/i }).click();
    await ouvrirListeDesTachesSiRepliee(page);

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

    // Statistiques est MASQUÉE de la navigation depuis le 2026-09-30
    // (`hidden: true` dans org-sections.ts, 92c99b31) ; code et route
    // conservés. On y arrive donc par l'URL, comme le ferait un lien.
    await page.goto('/entreprise/stats');
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 20_000 });

    // Sanity : l'onglet a bien rendu (sélecteur de période) avant de vérifier
    // l'absence — sinon un onglet vide donnerait un faux positif.
    await expect(page.getByRole('tablist').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /exporter csv/i })).toHaveCount(0);

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });
});
