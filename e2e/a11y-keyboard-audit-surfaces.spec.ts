// ═══════════════════════════════════════════════════════════════════
// AM-2 (2026-10-23) · les surfaces modales RESTANTES, mesurées au clavier
//
// `a11y-keyboard-audit.spec.ts` mesure 23 surfaces. Ce fichier mesure toutes les
// autres que le produit permet d'atteindre, avec les MÊMES trois détecteurs que le
// témoin Radix (`keyboard-audit-helpers.ts` : entrée du focus, piège, Échap) plus le
// rôle déclaré (`dialog` ou `alertdialog`) et `aria-modal`.
//
// 🔴 Le déclencheur est actionné AU CLAVIER (Entrée sur un bouton focalisé, ou le
// raccourci global) partout où un chemin clavier existe : c'est celui que la
// personne emprunte, il fait partie de la mesure. Les exceptions sont déclarées
// dans leur cas.
//
// ⚠️ Une surface est désignée par son NOM ACCESSIBLE (`getByRole(role, { name })`),
// jamais par « le dernier overlay » : le nom dit QUELLE surface on a mesurée.
// ⚠️ Les noms sont ceux du catalogue fr, relus dans `src/locales/fr/*.json` le
// 2026-10-23, pas écrits de mémoire.
// ═══════════════════════════════════════════════════════════════════

import { test, expect, navTo, openOrgSection, dismissFirstSightBubble, gotoTolerant } from './fixtures';
import type { Page, Locator } from '@playwright/test';
import {
  passerEnMobile, markTrigger, mesurerSurface, ouvrirAuClavier, ouvrirEntreprise, openTasksPage,
  focusInside, firstTabEscapee,
} from './keyboard-audit-helpers';

test.describe.configure({ timeout: 180_000 });
// Un audit clavier est un audit de poste de bureau (cf. `a11y-keyboard-audit.spec.ts`, C-118).
test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

const visible = (loc: Locator) => loc.filter({ visible: true }).first();

/** Ouvre une section de l'espace entreprise de la démo (Nova Studio). */
async function versSection(page: Page, section: RegExp, url: RegExp): Promise<void> {
  await ouvrirEntreprise(page);
  await openOrgSection(page, section);
  await page.waitForURL(url);
}

// ── Coque de l'application ──────────────────────────────────────────

test('MESURE · BugReportModal (« Signaler un bug », barre latérale)', async ({ demoPage: page }) => {
  await ouvrirAuClavier(page, visible(page.getByRole('button', { name: /^signaler un bug$/i })));
  await mesurerSurface(page, 'BugReportModal', page.getByRole('dialog', { name: /^signaler un bug$/i }));
});

test('MESURE · InviteOrJoinModal (« Créer ou rejoindre une entreprise »)', async ({ demoPage: page }) => {
  // Le « + » de la barre latérale desktop est retiré (2026-10-29) : la modale
  // s'ouvre depuis la feuille « Plus » du mobile.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await visible(page.getByRole('button', { name: /^plus d'options$/i })).click();
  await ouvrirAuClavier(page, visible(page.getByRole('button', { name: /^créer ou rejoindre une entreprise$/i })));
  await mesurerSurface(
    page,
    'InviteOrJoinModal',
    page.getByRole('dialog', { name: /^créer ou rejoindre une entreprise$/i }),
  );
});

// ── Espace entreprise : coque et Aperçu ─────────────────────────────

test('MESURE · OrgGlossarySheet (bouton « Glossaire »)', async ({ demoPage: page }) => {
  await ouvrirEntreprise(page);
  await ouvrirAuClavier(page, visible(page.getByRole('button', { name: /^glossaire$/i })));
  await mesurerSurface(page, 'OrgGlossarySheet', page.getByRole('dialog', { name: /^glossaire de l.entreprise$/i }));
});

test('MESURE · OrgSectionSheet (sélecteur de section, mobile)', async ({ demoPage: page }) => {
  await passerEnMobile(page);
  await ouvrirEntreprise(page);
  await ouvrirAuClavier(page, page.locator('[data-org-section-switcher]'));
  await mesurerSurface(page, 'OrgSectionSheet', page.getByRole('dialog', { name: /^sections de l.entreprise$/i }));
});

async function ouvrirEditionApercu(page: Page): Promise<void> {
  await ouvrirEntreprise(page);
  await ouvrirAuClavier(page, visible(page.getByRole('button', { name: /^modifier les widgets$/i })));
}

test('MESURE · TemplatePicker (« Modèles » de l\'Aperçu)', async ({ demoPage: page }) => {
  await ouvrirEditionApercu(page);
  await ouvrirAuClavier(page, visible(page.getByRole('button', { name: /^modèles$/i })));
  await mesurerSurface(page, 'TemplatePicker', page.getByRole('dialog', { name: /^choisir un modèle$/i }));
});

test('MESURE · AddWidgetPage (« Ajouter un widget » de l\'Aperçu)', async ({ demoPage: page }) => {
  await ouvrirEditionApercu(page);
  await ouvrirAuClavier(page, visible(page.getByRole('button', { name: /^ajouter un widget$/i })));
  await mesurerSurface(page, 'AddWidgetPage', page.getByRole('dialog', { name: /^ajouter un widget$/i }));
});

test('MESURE · WeeklyReviewSheet (« Revue de la semaine », statistiques d’équipe)', async ({ demoPage: page }) => {
  // ⚠️ SEULE exception de ce fichier au déclencheur clavier de la NAVIGATION : la
  // section « Statistiques » est masquée de la barre latérale (`hidden`, code et
  // route conservés), on y arrive donc par son adresse. Le déclencheur de la
  // surface, lui, est actionné au clavier.
  await ouvrirEntreprise(page);
  await page.goto('/entreprise/stats');
  await ouvrirAuClavier(page, visible(page.getByRole('button', { name: /^revue de la semaine$/i })));
  await mesurerSurface(page, 'WeeklyReviewSheet', page.getByRole('dialog', { name: /^revue de la semaine$/i }));
});

// ── Membres ─────────────────────────────────────────────────────────

test('MESURE · InviteModeDialog (« Inviter », membres)', async ({ demoPage: page }) => {
  await versSection(page, /^membres/i, /\/entreprise\/members/);
  await ouvrirAuClavier(page, visible(page.locator('[data-guide-id="members-invite"]')));
  await mesurerSurface(page, 'InviteModeDialog', page.getByRole('dialog', { name: /^inviter$/i }));
});

/**
 * Ouvre une entrée du menu « Actions pour … » d'un membre, au clavier, sur le
 * premier membre qui la propose (le menu ne porte que ce que l'appelant a le
 * droit de faire sur CE membre).
 */
async function ouvrirDepuisMenuMembre(page: Page, item: (p: Page) => Locator): Promise<void> {
  await versSection(page, /^membres/i, /\/entreprise\/members/);
  // Un rôle fraîchement affiché ouvre sa définition d'elle-même, et le focus avec.
  await dismissFirstSightBubble(page);
  const triggers = page.getByRole('button', { name: /^actions pour /i }).filter({ visible: true });
  await expect(triggers.first()).toBeVisible({ timeout: 30_000 });
  const n = await triggers.count();
  for (let i = 0; i < n; i++) {
    const trigger = triggers.nth(i);
    await trigger.focus();
    // Marqué AVANT d'ouvrir : un menu Radix ouvert rend le reste de la page `aria-hidden`.
    await markTrigger(page);
    await page.keyboard.press('Enter');
    const cible = item(page);
    const propose = await cible.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true, () => false);
    if (propose) {
      await cible.focus();
      await page.keyboard.press('Enter');
      return;
    }
    await page.keyboard.press('Escape');
  }
  throw new Error('aucun membre de la démo ne propose cette entrée');
}

test('MESURE · MemberPermissionsSheet (« Modifier les permissions »)', async ({ demoPage: page }) => {
  await ouvrirDepuisMenuMembre(page, (p) => p.locator('[data-guide-id="member-open-permissions"]'));
  await mesurerSurface(page, 'MemberPermissionsSheet', page.getByRole('dialog', { name: /^modifier les permissions de /i }));
});

test('MESURE · AssignTaskSheet (« Attribuer une tâche »)', async ({ demoPage: page }) => {
  await ouvrirDepuisMenuMembre(page, (p) => p.getByRole('menuitem', { name: /^attribuer une tâche$/i }));
  await mesurerSurface(page, 'AssignTaskSheet', page.getByRole('dialog', { name: /^attribuer une tâche à /i }));
});

test('MESURE · MemberSheet (« Voir ses tâches »)', async ({ demoPage: page }) => {
  await ouvrirDepuisMenuMembre(page, (p) => p.getByRole('menuitem', { name: /^voir ses tâches$/i }));
  await mesurerSurface(page, 'MemberSheet', page.getByRole('dialog', { name: /^fiche de /i }));
});

test('MESURE · OffboardMemberDialog (« Départ »)', async ({ demoPage: page }) => {
  await ouvrirDepuisMenuMembre(page, (p) => p.locator('[data-guide-id="member-lifecycle-offboard"]'));
  await mesurerSurface(page, 'OffboardMemberDialog', page.getByRole('dialog', { name: /^départ de /i }));
});

test('MESURE · MemberBulkPicker (action groupée, « Sélectionner »)', async ({ demoPage: page }) => {
  await versSection(page, /^membres/i, /\/entreprise\/members/);
  await visible(page.getByRole('button', { name: /^sélectionner$/i })).press('Enter');
  const premiere = page.getByRole('checkbox').filter({ visible: true }).first();
  await expect(premiere).toBeVisible({ timeout: 20_000 });
  await premiere.focus();
  await page.keyboard.press('Space');
  await ouvrirAuClavier(page, visible(page.getByRole('button', { name: /ajouter à une équipe/i })));
  await mesurerSurface(page, 'MemberBulkPicker', page.getByRole('dialog', { name: /équipe/i }));
});

// ── Équipes, projets, paramètres ────────────────────────────────────

test('MESURE · CreateTeamModal (« Nouvelle équipe »)', async ({ demoPage: page }) => {
  await versSection(page, /^équipes/i, /\/entreprise\/teams/);
  await ouvrirAuClavier(page, visible(page.getByRole('button', { name: /^ajouter une équipe$/i })));
  await mesurerSurface(page, 'CreateTeamModal', page.getByRole('dialog', { name: /^nouvelle équipe$/i }));
});

test('MESURE · NewTeamProjectModal (« Nouveau projet »)', async ({ demoPage: page }) => {
  await versSection(page, /^projets/i, /\/entreprise\/projects/);
  await ouvrirAuClavier(page, visible(page.getByRole('button', { name: /nouveau projet/i })));
  await mesurerSurface(page, 'NewTeamProjectModal', page.getByRole('dialog', { name: /^nouveau projet d.équipe$/i }));
});

test('MESURE · ProjectEditDialog (« Modifier le projet »)', async ({ demoPage: page }) => {
  await versSection(page, /^projets/i, /\/entreprise\/projects/);
  // Le menu d'actions d'un projet vit sur la carte de la vue « Liste ».
  await visible(page.getByRole('group', { name: /^vue$/i }).getByRole('button', { name: /^liste$/i })).press('Enter');
  const trigger = visible(page.getByRole('button', { name: /^actions du projet /i }));
  await ouvrirAuClavier(page, trigger);
  const item = page.getByRole('menuitem', { name: /^modifier le projet$/i });
  await item.focus();
  await page.keyboard.press('Enter');
  await mesurerSurface(page, 'ProjectEditDialog', page.getByRole('dialog', { name: /^modifier le projet /i }));
});

test("MESURE · AssignEventDialog (« Assigner l'événement », tâches d'équipe)", async ({ demoPage: page }) => {
  await versSection(page, /^tâches/i, /\/entreprise\/tasks/);
  const trigger = visible(page.getByRole('button', { name: /^actions pour /i }));
  await ouvrirAuClavier(page, trigger);
  const item = page.getByRole('menuitem', { name: /^assigner l.événement$/i });
  await item.focus();
  await page.keyboard.press('Enter');
  await mesurerSurface(page, 'AssignEventDialog', page.getByRole('dialog', { name: /^assigner l.événement .{1,3} /i }));
});

/** Déplie un panneau des paramètres entreprise, au clavier (accordéon). */
async function ouvrirPanneauParametres(page: Page, id: string): Promise<void> {
  await versSection(page, /^paramètres/i, /\/entreprise\/settings/);
  const panneau = visible(page.locator(`[data-guide-id="settings-panel-${id}"]`));
  await expect(panneau).toBeVisible({ timeout: 20_000 });
  await panneau.focus();
  await page.keyboard.press('Enter');
}

test("MESURE · DeleteOrganizationDialog (« Supprimer l'entreprise »)", async ({ demoPage: page }) => {
  await ouvrirPanneauParametres(page, 'danger');
  await ouvrirAuClavier(page, visible(page.getByRole('button', { name: /^supprimer l.entreprise$/i })));
  await mesurerSurface(
    page,
    'DeleteOrganizationDialog',
    page.getByRole('alertdialog', { name: /^supprimer .+ \?$/i }),
    'alertdialog',
  );
});

test("MESURE · DeleteTeamCategoryConfirm (catégorie d'entreprise)", async ({ demoPage: page }) => {
  await ouvrirPanneauParametres(page, 'categories');
  const trigger = visible(page.getByRole('button', { name: /^plus d.actions pour /i }));
  await ouvrirAuClavier(page, trigger);
  const item = page.getByRole('menuitem', { name: /^supprimer$/i });
  await item.focus();
  await page.keyboard.press('Enter');
  await mesurerSurface(page, 'DeleteTeamCategoryConfirm', page.getByRole('alertdialog').or(page.getByRole('dialog')).filter({ hasText: /supprim/i }).last());
});

test('MESURE · InviteByEmailDialog (« Inviter par e-mail »)', async ({ demoPage: page }) => {
  await ouvrirPanneauParametres(page, 'invite');
  await ouvrirAuClavier(page, visible(page.getByRole('button', { name: /^placement, équipes et durée d.accès$/i })));
  await mesurerSurface(page, 'InviteByEmailDialog', page.getByRole('dialog', { name: /^inviter par e-mail$/i }));
});

test('MESURE · PyramidPlacementSheet (« Placer », organigramme)', async ({ demoPage: page }) => {
  await versSection(page, /^organigramme/i, /\/entreprise\/pyramid/);
  await ouvrirAuClavier(page, visible(page.getByRole('button', { name: /^placer$/i })));
  await mesurerSurface(page, 'PyramidPlacementSheet', page.getByRole('dialog').last());
});

// ── Surfaces perso ──────────────────────────────────────────────────

test('MESURE · LoginModal (« Se connecter », landing)', async ({ page }) => {
  // La landing n'est pas la démo : pas de `demoPage`. Le bandeau de cookies est
  // refusé d'avance (même geste que la fixture), sinon il recouvre le bas de page.
  await gotoTolerant(page, '/');
  await page.evaluate(() => {
    try { localStorage.setItem('cosmo_cookie_consent', 'refused'); } catch { /* ignore */ }
  });
  await gotoTolerant(page, '/');
  // Un `<a href="/login">` neutralisé : Entrée l'active comme un clic.
  await ouvrirAuClavier(page, visible(page.getByRole('link', { name: /se connecter/i })));
  await mesurerSurface(page, 'LoginModal', page.getByRole('dialog', { name: /^connexion ou inscription$/i }));
});

test('MESURE · WeeklyCheckinModal (check-in hebdo, carte d accueil)', async ({ demoPage: page }) => {
  // Le bouton « Check-in hebdo » de la page OKR est retiré (2026-10-29) : le
  // check-in s'ouvre depuis la carte de l'accueil, qui ne paraît que le lundi
  // et le mardi. On cale l'horloge du navigateur sur le prochain lundi midi.
  const lundi = new Date();
  lundi.setDate(lundi.getDate() + ((8 - lundi.getDay()) % 7 || 7));
  lundi.setHours(12, 0, 0, 0);
  await page.clock.install({ time: lundi });
  await page.goto('/dashboard');
  const declencheur = visible(page.getByRole('button', { name: /^faire le point$/i }));
  await expect(declencheur).toBeVisible({ timeout: 90_000 });
  await ouvrirAuClavier(page, declencheur);
  await mesurerSurface(page, 'WeeklyCheckinModal', page.locator('[role="dialog"][aria-labelledby="weekly-checkin-title"]'));
});

test('MESURE · OKRDeadlineReviewModal (objectif échu, page OKR)', async ({ demoPage: page }) => {
  // La revue s'ouvre D'ELLE-MÊME dès qu'un objectif non terminé a dépassé son
  // échéance : on avance l'horloge du navigateur de deux ans APRÈS le semis de la
  // démo (les seeds sont datés de l'heure réelle), puis on recharge la page OKR.
  // ⚠️ Pas de déclencheur à actionner : le focus d'origine est celui du corps de page.
  await page.clock.install({ time: new Date(Date.now() + 2 * 365 * 86_400_000) });
  await page.goto('/okr');
  const dialog = page.locator('[role="dialog"][aria-labelledby="okr-deadline-review-title"]');
  await expect(dialog).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => focusInside(dialog), { timeout: 3_000 }).toBe(true);
  expect(await dialog.getAttribute('aria-modal'), 'OKRDeadlineReviewModal: pas d aria-modal').toBe('true');
  expect(await firstTabEscapee(page, dialog), 'OKRDeadlineReviewModal: focus sorti').toBeNull();
  // Échap écarte l'objectif courant ; avec tous les objectifs échus, la revue passe
  // AUSSITÔT au suivant (règle « un à la fois »). On mesure donc que l'objectif
  // affiché CHANGE, ou que la surface se ferme : dans les deux cas Échap a agi.
  const titre = dialog.locator('#okr-deadline-review-title');
  const avant = await titre.textContent();
  await page.keyboard.press('Escape');
  await expect
    .poll(async () => ((await dialog.isVisible()) ? await titre.textContent() : null) !== avant, { timeout: 5_000 })
    .toBe(true);
});

test('MESURE · CollaborativeTasks (retrait d\'une tâche partagée, tableau de bord)', async ({ demoPage: page }) => {
  // Le widget n'existe que si une tâche DU COMPTE est collaborative : la démo n'en sème
  // aucune, on en marque une dans le stockage local de la démo, puis on recharge.
  await page.evaluate(() => {
    const brut = localStorage.getItem('cosmo_demo_tasks');
    const taches = brut ? JSON.parse(brut) : [];
    const cible = taches.find((t: { sharedBy?: string; completed?: boolean }) => !t.sharedBy && !t.completed) ?? taches[0];
    if (cible) cible.isCollaborative = true;
    localStorage.setItem('cosmo_demo_tasks', JSON.stringify(taches));
  });
  await page.reload();
  const widget = page.getByRole('listitem').filter({
    has: page.getByRole('heading', { name: /^tâches collaboratives$/i }),
  });
  await ouvrirAuClavier(page, widget.getByRole('button', { name: /^supprimer/i }).first());
  await mesurerSurface(page, 'CollaborativeTasks', page.getByRole('alertdialog', { name: /^supprimer la tâche$/i }), 'alertdialog');
});

test('MESURE · RemoveFriendConfirm (retirer un ami, boîte de réception)', async ({ demoPage: page }) => {
  await ouvrirAuClavier(page, visible(page.getByRole('button', { name: /^boîte de réception/i })));
  await visible(page.getByRole('button', { name: /^gérer mes amis$/i })).press('Enter');
  await ouvrirAuClavier(page, visible(page.getByRole('button', { name: /^retirer .+ de vos amis$/i })));
  await mesurerSurface(
    page,
    'RemoveFriendConfirm',
    page.getByRole('alertdialog', { name: /^confirmer la suppression de l.ami$/i }),
    'alertdialog',
  );
});

test('MESURE · ImportTasksDialog (« Importer », paramètres)', async ({ demoPage: page }) => {
  await navTo(page, /paramètres|settings/i, /\/settings/);
  await visible(page.getByRole('button', { name: /^mes données/i })).press('Enter');
  await ouvrirAuClavier(page, visible(page.getByRole('button', { name: /^importer$/i })));
  await mesurerSurface(page, 'ImportTasksDialog', page.getByRole('dialog').last());
});

test('MESURE · MobileTaskSearch (recherche ancrée en bas, mobile)', async ({ demoPage: page }) => {
  await passerEnMobile(page);
  await openTasksPage(page);
  await ouvrirAuClavier(page, visible(page.getByRole('button', { name: /^ouvrir la recherche/i })));
  await mesurerSurface(page, 'MobileTaskSearch', page.getByRole('dialog', { name: /^rechercher une tâche$/i }));
});

test('MESURE · ListActionsSheet (menu d\'une liste, mobile, touche Menu)', async ({ demoPage: page }) => {
  // Le menu d'une liste n'existait QUE par appui long : inatteignable au clavier
  // (WCAG 2.1.1). Il s'ouvre maintenant par la touche « menu contextuel » ou
  // Maj+F10 sur la puce de la liste, comme la feuille d'actions d'une tâche.
  await passerEnMobile(page);
  await openTasksPage(page);
  const puce = page.locator('button[aria-keyshortcuts="Shift+F10"]').filter({ visible: true }).first();
  await expect(puce).toBeVisible({ timeout: 30_000 });
  await puce.focus();
  await markTrigger(page);
  await page.keyboard.press('Shift+F10');
  await mesurerSurface(page, 'ListActionsSheet', page.getByRole('dialog', { name: /^actions pour la liste /i }));
});

/** Marque les tâches du compte « collaboratives » dans le stockage de la démo, puis recharge. */
async function rendreCollaboratives(page: Page): Promise<void> {
  await page.evaluate(() => {
    const brut = localStorage.getItem('cosmo_demo_tasks');
    const taches = brut ? JSON.parse(brut) : [];
    for (const t of taches) if (!t.sharedBy) t.isCollaborative = true;
    localStorage.setItem('cosmo_demo_tasks', JSON.stringify(taches));
  });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/bonjour/i, { timeout: 60_000 });
}

async function ouvrirMenuLigne(page: Page, entree: RegExp): Promise<void> {
  // Vue « Liste » (par défaut) : c'est elle qui porte le menu « Actions pour … » d'une ligne.
  await openTasksPage(page);
  await ouvrirAuClavier(page, visible(page.getByRole('button', { name: /^actions pour /i })));
  const item = page.getByRole('menuitem', { name: entree });
  await item.focus();
  await page.keyboard.press('Enter');
}

test('MESURE · DesktopAddToList (« Ajouter à une liste », vue Liste)', async ({ demoPage: page }) => {
  await ouvrirMenuLigne(page, /^ajouter à une liste$/i);
  await mesurerSurface(page, 'DesktopAddToList', page.getByRole('dialog', { name: /liste/i }));
});

test('MESURE · ConfirmDeleteSheet (suppression d\'une tâche, vue Liste)', async ({ demoPage: page }) => {
  // La confirmation n'existe QUE pour une tâche collaborative ou reçue : une tâche perso
  // est supprimée sans confirmation, réversible par le toast « Annuler ».
  await rendreCollaboratives(page);
  await ouvrirMenuLigne(page, /^supprimer$/i);
  await mesurerSurface(page, 'ConfirmDeleteSheet', page.getByRole('alertdialog', { name: /^supprimer la tâche$/i }), 'alertdialog');
});

test('MESURE · BulkAddToListModal (« Liste », barre de sélection)', async ({ demoPage: page }) => {
  await openTasksPage(page);
  await visible(page.getByRole('button', { name: /sélectionner/i })).press('Enter');
  const case1 = page.getByRole('checkbox', { name: /^s[ée]lectionner/i }).first();
  await expect(case1).toBeVisible({ timeout: 20_000 });
  // La case est cochée au clic : ce n'est pas la surface mesurée, et le clavier la
  // coche déjà (case native). Le déclencheur mesuré est le bouton « Liste » de la barre.
  await case1.click();
  // `.last()` : la barre d'actions groupées vient après le bouton « Liste » du sélecteur de vue.
  await ouvrirAuClavier(page, page.getByRole('button', { name: /^liste$/i }).last());
  await mesurerSurface(page, 'BulkAddToListModal', page.getByRole('dialog', { name: /ajouter à une liste/i }));
});

test('MESURE · MobileActionSheet (« Catégorie », tâche, mobile)', async ({ demoPage: page }) => {
  // La fiche complète d'une tâche s'ouvre en touchant une tâche existante (la
  // création passe par la saisie rapide). La carte est un arrêt de tabulation.
  await passerEnMobile(page);
  await openTasksPage(page);
  // Toucher la carte ouvre la fiche (geste de pointeur, hors de la surface mesurée ici).
  await visible(page.locator('[aria-keyshortcuts="Shift+F10"]:not(button)')).click();
  const fiche = page.getByRole('dialog').first();
  await expect(fiche).toBeVisible({ timeout: 30_000 });
  await ouvrirAuClavier(page, fiche.getByRole('button', { name: /^catégorie/i }).first());
  await mesurerSurface(page, 'MobileActionSheet', page.getByRole('dialog', { name: /^catégorie$/i }));
});

// ── Catégories : feuilles empilées sur « Modifier les catégories » ──

/** Ouvre « Modifier les catégories » depuis la saisie d'un événement, puis le menu d'une catégorie. */
async function ouvrirMenuCategorie(page: Page, entree: RegExp): Promise<void> {
  await navTo(page, /agenda/i, /\/agenda/);
  const nouveau = visible(page.getByRole('button', { name: /^nouveau$/i }));
  await nouveau.focus({ timeout: 20_000 });
  await nouveau.dispatchEvent('click');
  const evenement = page.getByRole('dialog', { name: /ajouter un événement/i });
  await expect(evenement).toBeVisible({ timeout: 20_000 });
  await evenement.getByRole('button', { name: /créer une catégorie/i }).first().click();
  const categories = page.getByRole('dialog', { name: /modifier les catégories/i });
  await expect(categories).toBeVisible({ timeout: 10_000 });
  await ouvrirAuClavier(page, categories.getByRole('button', { name: /^plus d.actions pour /i }).first());
  const item = page.getByRole('menuitem', { name: entree });
  await item.focus();
  await page.keyboard.press('Enter');
}

test('MESURE · MoveCategoryDialog (« Déplacer la catégorie »)', async ({ demoPage: page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirMenuCategorie(page, /^déplacer la catégorie$/i);
  await mesurerSurface(page, 'MoveCategoryDialog', page.getByRole('dialog', { name: /^déplacer la catégorie$/i }));
});

test('MESURE · DeleteCategoryDialog (« Supprimer la catégorie »)', async ({ demoPage: page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirMenuCategorie(page, /^supprimer la catégorie$/i);
  await mesurerSurface(
    page,
    'DeleteCategoryDialog',
    page.locator('[role="dialog"][aria-labelledby="delete-category-title"], [role="alertdialog"][aria-labelledby="delete-category-title"]'),
  );
});

test('MESURE · OrgWelcomeVideo (vidéo d\'accueil entreprise, première arrivée)', async ({ demoPage: page }) => {
  // La fixture pose le drapeau « vue » pour que la vidéo ne recouvre pas les autres
  // parcours : on le retire, la vidéo s'ouvre à la première arrivée sur /entreprise.
  await page.evaluate(() => {
    try { localStorage.removeItem('cosmo_org_welcome_seen_org-demo-1_demo-user'); } catch { /* ignore */ }
  });
  await navTo(page, /entreprise/i, /\/entreprise/);
  const dialog = page.getByRole('dialog', { name: /^bienvenue dans l.espace entreprise$/i });
  await expect(dialog).toBeVisible({ timeout: 45_000 });
  // Focus d'entrée sur l'action (`initialFocusRef`), pas sur la croix.
  await expect.poll(() => focusInside(dialog), { timeout: 3_000 }).toBe(true);
  expect(await dialog.getAttribute('aria-modal'), 'OrgWelcomeVideo: pas d aria-modal').toBe('true');
  expect(await firstTabEscapee(page, dialog, 25), 'OrgWelcomeVideo: focus sorti').toBeNull();
  // ÉCART DÉCLARÉ, mesuré le 2026-10-16 (cf. `stubbed/org-onboarding.spec.ts`) : une fois
  // le focus dans les commandes NATIVES du lecteur, Chromium ne laisse sortir AUCUNE
  // touche vers la page, Échap compris, et aucun écouteur ne peut l'entendre. On remet
  // donc le focus sur un bouton avant Échap, comme le fait ce spec-là ; Tab, lui, ressort
  // du lecteur. Ce n'est pas un défaut de la surface : c'est le lecteur du navigateur.
  await dialog.getByRole('button', { name: /^commencer/i }).focus();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden({ timeout: 5_000 });
});
