import { test, expect, navTo, openOrgSection, expectOrgSectionOffered } from './fixtures';

/**
 * Parcours entreprise (reco #19) — mode démo, org « Nova Studio » seedée
 * (6 membres, 3 projets, ~20 tâches, OKR, 1 demande d'adhésion).
 *
 * Couvre les régressions majeures de la zone : la page se monte, les onglets
 * naviguent (une section = une route, `/entreprise/projects`), l'Aperçu affiche ses sections (activité,
 * échéances entreprise), le modal de tâche s'ouvre avec son fil de
 * commentaires, l'onglet Membres liste l'annuaire et les cartes d'invitation.
 */

test.describe('Espace entreprise (démo)', () => {
  test.describe.configure({ timeout: 120_000 });

  test('Aperçu : synthèse, activité et prochains événements', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);

    // Header org + onglets
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });
    await expectOrgSectionOffered(page, /^aperçu/i);

    // Aperçu en widgets (2026-10-19) : le compte démo est ADMIN de Nova
    // Studio, il arrive donc sur le modèle « Administrateur ». Chaque widget est
    // une `section` nommée par son titre (WidgetShell). On vérifie le bouton
    // d'édition et deux widgets du modèle : l'activité et les événements.
    // ⚠️ Apostrophe TYPOGRAPHIQUE possible dans le catalogue : classe [’'].
    await expect(page.getByTestId('apercu-edit')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('region', { name: /activité de l[’']équipe/i })).toBeVisible();
    await expect(page.getByRole('region', { name: /événements de l[’']entreprise/i })).toBeVisible();

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });

  test('Sections : navigation + une route par section', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    // Projets
    await openOrgSection(page, /^projets/i);
    await page.waitForURL(/\/entreprise\/projects/);

    // OKR — le bouton « Nouvel objectif » confirme le contenu de l'onglet
    await openOrgSection(page, /^okr/i);
    await page.waitForURL(/\/entreprise\/okr/);
    await expect(
      page.getByRole('button', { name: /nouvel objectif/i }).filter({ visible: true }).first()
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  });

  test('Tâche d\'équipe : le modal s\'ouvre avec le fil de commentaires', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    // Aperçu en widgets (2026-10-19) : le modèle « Administrateur » du compte
    // démo n'a plus « Mes tâches ». On ouvre une tâche depuis le widget
    // « Événements de l'entreprise » : une ligne de TÂCHE porte son projet
    // (« · Projet »), une fin d'OKR non, et elle mènerait à l'onglet OKR.
    const events = page.getByRole('region', { name: /événements de l[’']entreprise/i });
    const taskButton = events.getByRole('button').filter({ hasText: ' · ' }).first();
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

  // Audit Membres du 2026-09-24 : « quatre pages en une ». La section des
  // personnes garde l'annuaire ; Équipes et Paramètres (invitations, zone de
  // danger) en sortent. Son libellé « Personnes » est devenu « Membres » le
  // 2026-09-29 (de464b92, décision produit) ; la route reste `/members`.
  test('Membres, Équipes, Paramètres : trois sections et une page d\'équipe', async ({ demoPage: page }) => {
    await navTo(page, /entreprise/i, /\/entreprise/);
    await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 15_000 });

    await openOrgSection(page, /^membres/i);
    await page.waitForURL(/\/entreprise\/members/);
    await expect(page.getByRole('heading', { name: /annuaire/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/marie dupont/i).first()).toBeVisible();
    // Les invitations ne sont plus au-dessus de l'annuaire.
    await expect(page.getByText(/code d'invitation/i)).toHaveCount(0);

    await openOrgSection(page, /^équipes/i);
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
    // Paramètres n'affiche qu'UNE rubrique à la fois depuis 7038a95e
    // (2026-09-27) : les invitations vivent dans « Inviter ».
    // Sur téléphone, les paramètres s'ouvrent sur une LISTE (706f4ba4,
    // maquettes 275+) et la barre de rubriques n'existe qu'à partir de
    // 768 px : on vise le bouton « Inviter » de l'une ou de l'autre selon
    // la largeur, jamais un « Inviter » quelconque de la page.
    const enListe = (page.viewportSize()?.width ?? 1280) < 768;
    await (enListe
      ? page.getByRole('main').getByRole('button', { name: /^inviter$/i }).first()
      : page.getByRole('navigation', { name: /rubriques des paramètres/i })
        .getByRole('button', { name: /^inviter$/i })
    ).click();
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
    // Largeur posée par le cas lui-même, comme son homologue mobile plus bas :
    // sous `mobile-safari` (390 px), ce panneau n'est pas rendu du tout, et le
    // cas échouait sur une absence voulue.
    await page.setViewportSize({ width: 1280, height: 800 });
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
    await expect(nav.getByRole('link', { name: /^membres/i })).toBeVisible();
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
    await expect(switcher).toContainText(/membres/i);

    await switcher.click();
    const sheet = page.locator('[data-org-section-sheet]');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: /^okr/i }).click();

    await page.waitForURL(/\/entreprise\/okr/);
    await expect(sheet).toHaveCount(0);
    await expect(switcher).toContainText(/okr/i);
  });
});
