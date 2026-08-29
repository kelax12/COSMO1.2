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

  test('Aperçu : synthèse, activité et prochains événements', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);

    // Header org + onglets
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });
    await expect(orgTab(page, /^aperçu/i)).toBeVisible();

    // Sections de l'Aperçu (reco #2 + #11)
    await expect(page.getByRole('heading', { name: /activité de l'équipe/i })).toBeVisible();
    // Renommé le 2026-08-27 : la liste « Mes échéances » a été remplacée par la
    // frise « Prochains événements de l'entreprise » (commits ce8ac2c, e6a873a).
    // Ce test n'a pas suivi, et le job e2e est rouge sur `main` depuis.
    //
    // ⚠️ La classe [’'] n'est pas de la prudence décorative : le catalogue écrit
    // « l’entreprise » avec l'apostrophe TYPOGRAPHIQUE (U+2019). Une regex avec
    // l'apostrophe droite ne matcherait jamais, et l'échec ressemblerait à une
    // section absente — c'est-à-dire à un bug produit qui n'existe pas.
    await expect(
      page.getByRole('heading', { name: /prochains événements de l[’']entreprise/i }),
    ).toBeVisible();

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

    // Fil de commentaires (reco #9) présent en mode édition. À partir de `lg`
    // (viewport par défaut de ce projet Playwright), il vit dans un panneau
    // séparé à droite du modal — pas DANS le `role="dialog"` lui-même,
    // volontairement (léger espace + bordure, cf. TeamTaskModal.tsx). On
    // cherche donc sur `page`, pas sur `dialog`.
    await expect(page.getByRole('heading', { name: /commentaires/i })).toBeVisible();
    await expect(page.getByPlaceholder(/écrire un commentaire/i)).toBeVisible();

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

// ═══════════════════════════════════════════════════════════════════
// Barre d'onglets sur petit écran — finding P1 du 2026-08-27.
//
// Mesuré à 375 px : le rail fait **832 px pour 335 visibles**, soit QUATRE
// destinations sur sept hors champ, dans un conteneur `hide-scrollbar` — donc
// sans barre de défilement ni le moindre indice qu'il y a autre chose.
//
// Le cas qui comptait le plus n'était pas le confort mais un vrai défaut :
// ouvrir un lien profond `?tab=members` laissait l'onglet ACTIF hors de l'écran.
// L'utilisateur voyait le contenu de Membres avec « Aperçu » comme seul onglet
// visible, sans pouvoir dire lequel était coché.
//
// ⚠️ Ce test vit en e2e et pas en unitaire, et ce n'est pas un choix de
// commodité : jsdom ne calcule aucune mise en page — `scrollWidth`,
// `clientWidth` et `offsetLeft` y valent 0. Un test jsdom passerait quoi qu'il
// arrive, y compris avec le bug. **Un test qui ne peut pas échouer n'est pas un
// test.**
// ═══════════════════════════════════════════════════════════════════
test.describe('Espace entreprise — navigation sur petit écran', () => {
  test("un lien profond laisse l'onglet actif dans le champ", async ({ demoPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/entreprise?tab=members');

    const bar = page.locator('[data-org-tabs]');
    await expect(bar).toBeVisible({ timeout: 20_000 });

    // On attend que le rail déborde réellement : sans ça, le test ne vérifierait
    // rien sur un écran où tout tient.
    await expect
      .poll(async () => bar.evaluate((el) => el.scrollWidth - el.clientWidth), { timeout: 15_000 })
      .toBeGreaterThan(0);

    // D'abord : le bon onglet est-il actif ? Sans cette étape, un échec du
    // `poll` suivant ne dit pas s'il s'agit du défilement ou d'un lien profond
    // qui n'a pas pris — deux causes opposées derrière la même ligne rouge.
    await expect
      .poll(async () => bar.evaluate((el) => el.querySelector('[data-active="true"]')?.textContent?.trim() ?? ''), {
        timeout: 15_000,
      })
      .toMatch(/membres/i);

    // Le centrage se rejoue quand une pastille de compteur arrive et élargit le
    // rail — c'est le decalage de 8 px trouvé en mesurant, d'où le `poll`.
    // ⚠️ On sonde un OBJET, pas un booléen : un `false` qui expire ne dit rien,
    // alors que ces cinq nombres désignent la cause en une lecture.
    await expect
      .poll(
        async () =>
          bar.evaluate((el) => {
            const actif = el.querySelector<HTMLElement>('[data-active="true"]');
            return JSON.stringify({
              actif: actif?.textContent?.trim().slice(0, 14) ?? null,
              scrollLeft: Math.round(el.scrollLeft),
              scrollMax: el.scrollWidth - el.clientWidth,
              gauche: actif?.offsetLeft ?? -1,
              droite: (actif?.offsetLeft ?? 0) + (actif?.offsetWidth ?? 0),
              fenetre: Math.round(el.scrollLeft) + el.clientWidth,
              visible: !!actif
                && actif.offsetLeft >= el.scrollLeft - 1
                && actif.offsetLeft + actif.offsetWidth <= el.scrollLeft + el.clientWidth + 1,
            });
          }),
        { timeout: 15_000 },
      )
      .toContain('"visible":true');
  });

  test('les dégradés de bord disent où il reste des onglets', async ({ demoPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/entreprise?tab=overview');

    const bar = page.locator('[data-org-tabs]');
    await expect(bar).toBeVisible({ timeout: 20_000 });

    // Sur le premier onglet : rien à gauche, tout à droite.
    const etat = await bar.evaluate((el) => ({
      gauche: el.scrollLeft > 1,
      droite: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    }));
    expect(etat.gauche).toBe(false);
    expect(etat.droite).toBe(true);
  });
});
