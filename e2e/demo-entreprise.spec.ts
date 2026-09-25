import type { Page } from '@playwright/test';
import { test, expect, navTo } from './fixtures';

/**
 * Parcours entreprise (reco #19) — mode démo, org « Nova Studio » seedée
 * (6 membres, 3 projets, ~20 tâches, OKR, 1 demande d'adhésion).
 *
 * Couvre les régressions majeures de la zone : la page se monte, les onglets
 * naviguent (une section = une route, `/entreprise/projects`), l'Aperçu affiche ses sections (activité,
 * échéances entreprise), le modal de tâche s'ouvre avec son fil de
 * commentaires, l'onglet Membres liste l'annuaire et les cartes d'invitation.
 */
/**
 * Entrée de la navigation entreprise (`OrgSideNav`, à droite sur desktop).
 *
 * ⚠️ Ne PAS ancrer sur la fin du libellé (`/^projets$/i`) : depuis les badges
 * de nouveautés (vague 1 entreprise, 2026-08-08), le compteur porte un
 * `aria-label` (« 3 nouveautés ») qui entre dans le NOM ACCESSIBLE du bouton —
 * lequel vaut donc « Projets 3 nouveautés » dès qu'il y a du neuf dans la
 * démo. Les deux tests qui ancraient la fin tournaient jusqu'au timeout.
 * On ancre au début : « Nouveau projet » ne matche pas, le badge ne gêne plus.
 */
const orgTab = (page: Page, label: RegExp) =>
  page.getByRole('navigation', { name: /sections de l.entreprise/i }).getByRole('link', { name: label });

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

  test('Sections : navigation + une route par section', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    // Projets
    await orgTab(page, /^projets/i).click();
    await page.waitForURL(/\/entreprise\/projects/);

    // OKR — le bouton « Nouvel objectif » confirme le contenu de l'onglet
    await orgTab(page, /^okr/i).click();
    await page.waitForURL(/\/entreprise\/okr/);
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

  // Audit Membres du 2026-09-24 : « quatre pages en une ». Personnes garde
  // l'annuaire ; Équipes et Paramètres (invitations, zone de danger) en sortent.
  test('Personnes, Équipes, Paramètres : trois sections et une page d\'équipe', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    await orgTab(page, /^personnes/i).click();
    await page.waitForURL(/\/entreprise\/members/);
    await expect(page.getByRole('heading', { name: /annuaire/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/marie dupont/i).first()).toBeVisible();
    // Les invitations ne sont plus au-dessus de l'annuaire.
    await expect(page.getByText(/code d'invitation/i)).toHaveCount(0);

    await orgTab(page, /^équipes/i).click();
    await page.waitForURL(/\/entreprise\/teams$/);
    await page.getByRole('link', { name: /^design$/i }).click();
    await page.waitForURL(/\/entreprise\/teams\/team-design/);
    await expect(page.getByRole('heading', { name: /^design$/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /responsables et membres/i })).toBeVisible();

    // Par l'URL : après un clic dans la page, la carte de navigation s'est
    // repliée (curseur sorti, comportement voulu du 2026-09-23).
    await page.goto('/entreprise/settings');
    // Rechargement complet : même délai que les autres arrivées par `goto`.
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/code d'invitation/i).first()).toBeVisible({ timeout: 20_000 });

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Navigation entreprise (2026-09-23) : panneau à droite sur desktop, sélecteur
// + feuille sur mobile, et une route par section.
//
// La rangée d'onglets qu'elle remplace cachait quatre destinations sur sept à
// 375 px (finding P1 du 2026-08-27). Le sélecteur n'a plus ce défaut par
// construction : la section courante EST son libellé.
// ═══════════════════════════════════════════════════════════════════
test.describe('Espace entreprise · navigation', () => {
  test.describe.configure({ timeout: 120_000 });

  test('une ancienne URL ?tab= arrive sur la route, paramètres conservés', async ({ demoPage: page }) => {
    // Contrat avec Stripe et les e-mails de renewal-notice : ces URLs existent
    // hors du dépôt, elles ne changeront plus.
    await page.goto('/entreprise?tab=members&ref=e2e');
    await page.waitForURL(/\/entreprise\/members\?ref=e2e/, { timeout: 20_000 });
  });

  test("desktop : ouverte à l'arrivée, repliée quand le curseur la quitte, ressortie au bord", async ({ demoPage: page }) => {
    await page.goto('/entreprise/okr');
    const nav = page.getByRole('navigation', { name: /sections de l.entreprise/i });
    const okr = nav.getByRole('link', { name: /^okr/i });
    await expect(okr).toHaveAttribute('aria-current', 'page', { timeout: 20_000 });
    const viewport = page.viewportSize()!;

    // Ouverte à l'arrivée, et un mouvement AILLEURS ne la ferme pas : elle
    // n'a pas encore été visitée.
    await page.mouse.move(viewport.width / 3, viewport.height / 2);
    await expect(nav).toHaveAttribute('data-collapsed', 'false');

    // Visitée puis quittée : repliée, il n'en reste que 10 px au bord.
    await okr.hover();
    await page.mouse.move(viewport.width / 3, viewport.height / 2);
    await expect(nav).toHaveAttribute('data-collapsed', 'true');
    await expect
      .poll(async () =>
        nav.evaluate((el) => {
          const card = el.lastElementChild as HTMLElement;
          return Math.round(window.innerWidth - card.getBoundingClientRect().left);
        }),
      )
      .toBeLessThanOrEqual(10);

    // Le curseur touche le bord, en haut, hors de la hauteur de la carte :
    // elle ressort. Puis il s'éloigne : elle se replie.
    await page.mouse.move(viewport.width - 4, 10);
    await expect(nav).toHaveAttribute('data-collapsed', 'false');
    await expect(nav.getByRole('link', { name: /^personnes/i })).toBeVisible();
    await page.mouse.move(viewport.width / 3, 10);
    await expect(nav).toHaveAttribute('data-collapsed', 'true');

    // Chaque arrivée la rouvre, quel qu'ait été l'état au départ.
    await page.reload();
    await expect(nav).toHaveAttribute('data-collapsed', 'false', { timeout: 20_000 });
  });

  test('mobile : le sélecteur ouvre une feuille, choisir navigue', async ({ demoPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/entreprise/members');

    const switcher = page.locator('[data-org-section-switcher]');
    await expect(switcher).toBeVisible({ timeout: 20_000 });
    await expect(switcher).toContainText(/personnes/i);

    await switcher.click();
    const sheet = page.locator('[data-org-section-sheet]');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: /^okr/i }).click();

    await page.waitForURL(/\/entreprise\/okr/);
    await expect(sheet).toHaveCount(0);
    await expect(switcher).toContainText(/okr/i);
  });
});
