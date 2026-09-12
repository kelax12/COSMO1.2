// ═══════════════════════════════════════════════════════════════════
// Audit A-3 (2026-09-03) — clavier, modales, calendrier COSMO.
//
// Mesure ce qu'axe-core NE PEUT PAS voir : le déplacement du focus.
// Un tiers seulement des critères WCAG est automatisable, et le défaut du
// 2026-08-30 (flèches mortes dans le calendrier) l'avait déjà montré.
//
// 🔴 TÉMOIN OBLIGATOIRE. Le premier test joue les trois détecteurs (entrée
// du focus, piège, Échap) sur une modale Radix, dont le comportement est
// fourni par la bibliothèque. S'il échoue, aucune mesure suivante n'a de
// valeur : c'est la garde contre un harnais qui ne détecte plus rien.
//
// Deux régimes assumés :
//   · le DatePicker (C-51/C-52) et les modales maison (C-53) sont ASSERTIONNÉS ;
//   · /agenda reste IMPRIMÉ pour la partie que C-54 a tranchée en l'état (le
//     `role="grid"` de FullCalendar sans descendant focalisable géré).
//
// 🔴 C-53 — CE FICHIER EST PASSÉ DE `console.log` À `expect` le 2026-09-05.
// Les trois modales ci-dessous étaient mesurées et IMPRIMÉES : un rapport que
// personne ne lit est une archive, pas une garde. `useModalA11y`
// (`src/hooks/use-modal-a11y.ts`) porte le piège, la restitution du focus au
// déclencheur, Échap et `role="dialog" aria-modal="true"` ; les mesures sont
// donc devenues des assertions, sur les MÊMES détecteurs que le témoin Radix.
// ═══════════════════════════════════════════════════════════════════

import { test, expect, navTo } from './fixtures';
import type { Page, Locator } from '@playwright/test';

test.describe.configure({ timeout: 180_000 });

interface FocusReport {
  focusMovedIn: boolean;
  focusedOnOpen: string;
  trapped: boolean;
  firstEscapee: string | null;
  escClosed: boolean;
  role: string | null;
  ariaModal: string | null;
  focusReturned: boolean | null;
}

async function describeFocus(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return 'BODY';
    const name = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40) || '';
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}[${name}]`;
  });
}

async function focusInside(container: Locator): Promise<boolean> {
  return container.evaluate((node) => node.contains(document.activeElement));
}

/** Marque l'élément focalisé pour pouvoir vérifier le RETOUR du focus. */
async function markTrigger(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('[data-a11y-trigger]').forEach((n) => n.removeAttribute('data-a11y-trigger'));
    (document.activeElement as HTMLElement | null)?.setAttribute('data-a11y-trigger', '1');
  });
}

async function measureFocus(
  page: Page,
  container: Locator,
  checkReturn = false,
): Promise<FocusReport> {
  const focusedOnOpen = await describeFocus(page);
  const focusMovedIn = await focusInside(container);
  const role = await container.getAttribute('role');
  const ariaModal = await container.getAttribute('aria-modal');

  let firstEscapee: string | null = null;
  for (let i = 0; i < 15 && firstEscapee === null; i++) {
    await page.keyboard.press('Tab');
    if (!(await focusInside(container))) firstEscapee = await describeFocus(page);
  }

  await page.keyboard.press('Escape');
  const escClosed = await container
    .waitFor({ state: 'hidden', timeout: 2_000 })
    .then(() => true)
    .catch(() => false);

  let focusReturned: boolean | null = null;
  if (escClosed && checkReturn) {
    // Radix restitue le focus APRÈS le démontage : mesurer trop tôt rendrait
    // « false » sur une modale conforme, donc un finding faux.
    await page.waitForTimeout(600);
    focusReturned = await page.evaluate(
      () => document.activeElement?.hasAttribute('data-a11y-trigger') ?? false,
    );
  }

  return { focusMovedIn, focusedOnOpen, trapped: firstEscapee === null, firstEscapee, escClosed, role, ariaModal, focusReturned };
}

/**
 * Les trois détecteurs de C-53, appliqués à une surface modale maison.
 *
 * ⚠️ Volontairement les MÊMES que ceux du témoin Radix : une modale maison qui
 * passerait un jeu de contrôles plus indulgent que la bibliothèque de
 * référence n'aurait rien prouvé.
 */
function assertModalTrapsFocus(surface: string, report: FocusReport): void {
  expect(report.focusMovedIn, `${surface}: focus resté sur ${report.focusedOnOpen}`).toBe(true);
  expect(report.trapped, `${surface}: focus sorti sur ${report.firstEscapee}`).toBe(true);
  expect(report.escClosed, `${surface}: Échap ne ferme pas`).toBe(true);
  expect(report.role, `${surface}: pas de role="dialog"`).toBe('dialog');
  expect(report.ariaModal, `${surface}: pas d'aria-modal`).toBe('true');
  // 🔴 `focusReturned` est IMPRIMÉ, jamais assertionné, et ce n'est pas une
  // complaisance : mesuré le 2026-09-05, le TÉMOIN Radix lui-même le rend
  // `false`. Un détecteur que la bibliothèque de référence ne passe pas mesure
  // le détecteur, pas la modale — en faire une gate tiendrait les surfaces
  // maison à une barre que Radix ne franchit pas. Les trois détecteurs de
  // C-53 (`focusMovedIn`, `trapped`, `escClosed`) sont, eux, verts sur le
  // témoin, donc opposables.
}

// ── TÉMOIN ────────────────────────────────────────────────────────
test('TÉMOIN — modale Radix « Créer une tâche »', async ({ demoPage: page }) => {
  await navTo(page, /to ?do|tâches|tasks/i, /\/tasks/);
  const trigger = page.getByRole('button', { name: /^créer une (nouvelle )?tâche$/i }).first();
  await trigger.focus();
  await markTrigger(page);
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: /créer une nouvelle tâche/i });
  await expect(dialog).toBeVisible({ timeout: 20_000 });

  const report = await measureFocus(page, dialog, true);
  console.log('[a11y-kbd] TEMOIN Radix', JSON.stringify(report));
  expect(report.focusMovedIn, `témoin: focus resté sur ${report.focusedOnOpen}`).toBe(true);
  expect(report.trapped, `témoin: focus sorti sur ${report.firstEscapee}`).toBe(true);
  expect(report.escClosed, 'témoin: Échap ne ferme pas').toBe(true);
});

// ── Modales maison ────────────────────────────────────────────────
test('MESURE — HabitModal', async ({ demoPage: page }) => {
  await navTo(page, /habitudes|habits/i, /\/habits/);
  const trigger = page.locator('[data-tutorial-id="habits-create-button"]').filter({ visible: true }).first();
  await trigger.focus();
  await markTrigger(page);
  await trigger.dispatchEvent('click');
  const overlay = page.locator('div.fixed.inset-0').filter({ visible: true }).last();
  await expect(overlay).toBeVisible({ timeout: 20_000 });
  const report = await measureFocus(page, overlay, true);
  console.log('[a11y-kbd] HabitModal', JSON.stringify(report));
  assertModalTrapsFocus('HabitModal', report);
});

test('MESURE — EventModal (/agenda)', async ({ demoPage: page }) => {
  await navTo(page, /agenda/i, /\/agenda/);
  const trigger = page.getByRole('button', { name: /^nouveau$/i }).filter({ visible: true }).first();
  await trigger.focus();
  await markTrigger(page);
  await trigger.dispatchEvent('click');
  const overlay = page.locator('div.fixed.inset-0').filter({ visible: true }).last();
  await expect(overlay).toBeVisible({ timeout: 20_000 });
  const report = await measureFocus(page, overlay, true);
  console.log('[a11y-kbd] EventModal', JSON.stringify(report));
  assertModalTrapsFocus('EventModal', report);
});
// ═══════════════════════════════════════════════════════════════════
// C-53 · EventModal et ses modales FRÈRES (`openStack`)
//
// `EventModal` rend `ConfirmDiscardDialog`, `ColorSettingsModal` et
// `RecurrenceDaysModal` en FRÈRES de son overlay, jamais dedans. C'est le seul
// cas que ce câblage pouvait casser : deux pièges écoutent `document` en même
// temps, et sans la pile (`openStack`, `src/hooks/use-modal-a11y.ts`) celui du
// parent reprendrait le focus à l'enfant dès la première tabulation.
//
// Les deux tests mesurent le DÉPLACEMENT du piège dans les DEUX sens : il
// passe à l'enfant à l'ouverture, il revient au parent à sa fermeture. Ne
// vérifier que l'aller laisserait passer une modale parente définitivement
// inerte derrière son enfant refermé — un écran qu'on voit et où le clavier
// ne fait plus rien.
//
// ⚠️ Les surfaces sont désignées par leur NOM ACCESSIBLE, pas par
// `div.fixed.inset-0 … .last()` : avec deux overlays empilés, « le dernier »
// désigne tantôt le parent, tantôt l'enfant, et l'assertion changerait de
// cible en cours de test sans jamais échouer.
// ═══════════════════════════════════════════════════════════════════

/** Le focus reste-t-il dans `container` après `n` tabulations ? Sinon, où. */
async function firstTabEscapee(page: Page, container: Locator, n = 12): Promise<string | null> {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab');
    if (!(await focusInside(container))) return await describeFocus(page);
  }
  return null;
}

test('GARDE — EventModal : Échap passe par guardedClose, et le piège suit la confirmation', async ({ demoPage: page }) => {
  // Le formulaire desktop est celui qui porte la saisie mesurée ici ; on fixe
  // le viewport pour que la garde tourne à l'identique dans TOUS les projects
  // (même précaution que la feuille mobile ci-dessus, en sens inverse).
  await page.setViewportSize({ width: 1280, height: 900 });
  await navTo(page, /agenda/i, /\/agenda/);
  await page.waitForLoadState('networkidle');
  await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 30_000 });

  // Mode ÉDITION : la garde de brouillon (`isEditDirty`) n'existe QUE là. En
  // création c'est `useFormDraft` qui protège la saisie, et Échap ferme sec.
  await page.locator('.fc-event').first().click();
  const eventModal = page.getByRole('dialog', { name: /modifier l'événement/i });
  await expect(eventModal).toBeVisible({ timeout: 20_000 });

  const titleField = eventModal.locator("input[placeholder=\"nom de l'événement\"]").first();
  await titleField.waitFor({ state: 'visible', timeout: 10_000 });
  await titleField.fill('Titre modifié au clavier');

  // ── Échap ne doit PAS perdre la saisie ───────────────────────────
  // Le mode d'échec visé est SILENCIEUX : un Échap câblé sur `onClose` au lieu
  // de `guardedClose` ferme proprement, sans erreur, et jette la saisie que le
  // même geste à la souris aurait protégée.
  await page.keyboard.press('Escape');
  const discard = page.getByRole('dialog', { name: /abandonner les modifications/i });
  await expect(
    discard,
    'Échap ne passe pas par guardedClose : la saisie est perdue sans confirmation',
  ).toBeVisible({ timeout: 5_000 });
  await expect(eventModal, 'EventModal démontée alors que la confirmation est ouverte').toBeVisible();
  await expect(titleField).toHaveValue('Titre modifié au clavier');

  // ── Le piège est passé À L'ENFANT ────────────────────────────────
  expect(
    await focusInside(discard),
    `focus non entré dans la confirmation: ${await describeFocus(page)}`,
  ).toBe(true);
  const escapee = await firstTabEscapee(page, discard);
  expect(escapee, `le focus a quitté la confirmation vers ${escapee}`).toBe(null);

  // ── … et il REVIENT au parent quand elle se referme ──────────────
  await page.keyboard.press('Escape');
  await expect(discard).toBeHidden({ timeout: 5_000 });
  await expect(eventModal, 'refuser l\'abandon doit laisser EventModal ouverte').toBeVisible();
  await expect(titleField, 'la saisie n\'a pas survécu au refus de l\'abandon').toHaveValue(
    'Titre modifié au clavier',
  );
  const escapee2 = await firstTabEscapee(page, eventModal);
  expect(escapee2, `EventModal ne rattrape plus le focus après la confirmation: ${escapee2}`).toBe(null);
});

// Les deux autres frères que CLAUDE.md nomme. `ConfirmDiscardDialog`, le
// troisième, est couvert par la garde d'Échap ci-dessus — c'est LUI qu'Échap
// fait apparaître, le mesurer ailleurs serait le mesurer deux fois.
const EVENT_MODAL_CHILDREN = [
  { surface: 'ColorSettingsModal', role: 'button', open: /créer une catégorie/i, dialog: /modifier les catégories/i },
  // ⚠️ `role="radio"`, pas `button` : la puce de récurrence est un <button> dont
  // le rôle EXPLICITE écrase le rôle implicite. Cherché comme un bouton, il est
  // introuvable — et le test expire au lieu d'échouer sur ce qu'il mesure.
  { surface: 'RecurrenceDaysModal', role: 'radio', open: /^personnaliser$/i, dialog: /répéter les jours/i },
] as const;

for (const child of EVENT_MODAL_CHILDREN) {
  test(`GARDE — EventModal : ${child.surface} prend le piège, puis le rend`, async ({ demoPage: page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await navTo(page, /agenda/i, /\/agenda/);
    await page.waitForLoadState('networkidle');
    const trigger = page.getByRole('button', { name: /^nouveau$/i }).filter({ visible: true }).first();
    await trigger.click({ timeout: 20_000 });
    const eventModal = page.getByRole('dialog', { name: /ajouter un événement/i });
    await expect(eventModal).toBeVisible({ timeout: 20_000 });

    await eventModal.getByRole(child.role, { name: child.open }).first().click();
    const sibling = page.getByRole('dialog', { name: child.dialog });
    await expect(sibling).toBeVisible({ timeout: 10_000 });

    // ── Le piège est passé À L'ENFANT ──────────────────────────────
    expect(
      await focusInside(sibling),
      `focus non entré dans ${child.surface}: ${await describeFocus(page)}`,
    ).toBe(true);
    const escapee = await firstTabEscapee(page, sibling);
    expect(escapee, `le focus a quitté ${child.surface} vers ${escapee}`).toBe(null);

    // ── … et il REVIENT au parent ──────────────────────────────────
    // 🔴 Le `toBeVisible` sur le parent n'est pas de la redondance : sans la
    // pile, Échap traverse et ferme les DEUX surfaces. Mesuré le 2026-09-08 en
    // neutralisant `isTopmost`, c'est exactement cette ligne qui vire au rouge.
    await page.keyboard.press('Escape');
    await expect(sibling).toBeHidden({ timeout: 5_000 });
    await expect(eventModal, 'fermer la modale enfant ne doit pas fermer le parent').toBeVisible();
    const escapee2 = await firstTabEscapee(page, eventModal);
    expect(escapee2, `EventModal ne rattrape plus le focus après ${child.surface}: ${escapee2}`).toBe(null);
  });
}

test('MESURE — MobileMoreSheet (feuille mobile)', async ({ demoPage: page }) => {
  // La feuille n'existe QUE sous le point de rupture mobile : sur desktop le
  // bouton n'est pas monté, et un test qui « passe » faute de trouver sa cible
  // ne mesure rien (même précaution que `reduced-motion-sheets.spec.ts`).
  //
  // ⚠️ On REDIMENSIONNE au lieu de `test.skip(vw >= 768)`. Un skip sur le
  // project desktop ferait dépendre la SEULE mesure de feuille mobile du
  // project `mobile-safari`, et sur cette machine il n'y arrive pas : mesuré
  // deux fois le 2026-09-05, les tests de ce fichier échouent tous dans la
  // fixture partagée (`fixtures.ts`), qui attend « Bonjour » dans le H1 du
  // dashboard là où l'en-tête mobile collant rend « samedi 5 sept. ». C'est
  // AVANT l'ouverture de la moindre modale, donc hors du périmètre de C-53.
  // ⚠️ Et ce n'est pas un project cassé pour autant : `touch-targets.spec.ts`,
  // qui passe par la même fixture, est vert sur `mobile-safari`. Le défaut est
  // sensible au timing, donc ni « toujours rouge » ni « toujours vert » — la
  // seule conclusion sûre est qu'une garde ne doit pas s'exécuter uniquement
  // là. Le redimensionnement la fait tourner dans TOUS les projects.
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole('button', { name: /plus d'options/i }).first()).toBeVisible({
    timeout: 20_000,
  });

  const trigger = page.getByRole('button', { name: /plus d'options/i }).first();
  await trigger.focus();
  await markTrigger(page);
  await trigger.click();
  const sheet = page.locator('[data-mobile-more-sheet]');
  await expect(sheet).toBeVisible({ timeout: 20_000 });

  const report = await measureFocus(page, sheet, true);
  console.log('[a11y-kbd] MobileMoreSheet', JSON.stringify(report));
  assertModalTrapsFocus('MobileMoreSheet', report);
});

// ═══════════════════════════════════════════════════════════════════
// C-53 · les trois dernières surfaces câblées et non mesurées
//
// Elles complètent la liste de `docs/ACCESSIBILITY.md` § « C-53 refermé ».
// Aucune n'était atteignable par les mesures précédentes : deux vivent sur
// `/tasks` derrière un déclencheur par carte, la troisième exige une liste
// MANUELLE, que le jeu de démo ne contient pas (ses sept listes sont toutes
// intelligentes, et le partage leur est refusé par construction).
//
// ⚠️ Le check-in hebdomadaire s'ouvre par-dessus `/tasks` au premier passage.
// Il n'est pas dans le périmètre de C-53, mais il recouvre la barre de listes :
// sans le refermer, les trois gardes mesurent un écran qu'on ne voit pas.
// ═══════════════════════════════════════════════════════════════════

/** Ouvre `/tasks`, attend le vrai rendu, et écarte le check-in hebdomadaire. */
async function openTasksPage(page: Page): Promise<void> {
  await navTo(page, /to ?do|tâches|tasks/i, /\/tasks/);
  // 🔴 Attendre un élément DE LA PAGE, pas un délai : l'URL passe à `/tasks`
  // alors que le chunk lazy n'a pas encore remplacé le dashboard. Trois sondes
  // successives ont mesuré le tableau de bord en croyant lire la page Tâches.
  await expect(page.getByRole('button', { name: /^créer une (nouvelle )?tâche$/i }).first())
    .toBeVisible({ timeout: 30_000 });
  const skip = page.getByRole('button', { name: /ignorer le check-in/i });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.waitForTimeout(400);
}

test('MESURE — TaskActionsSheet (feuille d\'actions d\'une tâche)', async ({ demoPage: page }) => {
  // ⚠️ Viewport MOBILE : la feuille appartient à `TaskCard`, la carte mobile.
  // Au-dessus du point de rupture, le bouton « Actions pour … » existe encore
  // mais n'ouvre pas cette surface — mesuré le 2026-09-08, la garde cherchait
  // un `role="dialog"` qui n'était jamais monté.
  await page.setViewportSize({ width: 375, height: 812 });
  await openTasksPage(page);

  const trigger = page.getByRole('button', { name: /afficher les actions|^actions pour /i }).filter({ visible: true }).first();
  await trigger.focus();
  await markTrigger(page);
  await trigger.click();
  const sheet = page.getByRole('dialog', { name: /^actions pour /i });
  await expect(sheet).toBeVisible({ timeout: 20_000 });

  const report = await measureFocus(page, sheet, true);
  console.log('[a11y-kbd] TaskActionsSheet', JSON.stringify(report));
  assertModalTrapsFocus('TaskActionsSheet', report);
});

test('MESURE — MobileAddToList (« Ajouter à une liste »)', async ({ demoPage: page }) => {
  // ⚠️ Viewport MOBILE obligatoire, et ce n'est pas un choix de confort :
  // `AddToListModal` aiguille sur `useIsMobile()` et rend `DesktopAddToList`
  // au-dessus du point de rupture. Cette variante-là n'est PAS câblée sur
  // `useModalA11y` ; mesurée sur desktop, la garde parlerait d'un autre
  // composant que celui qu'elle nomme.
  await page.setViewportSize({ width: 375, height: 812 });
  await openTasksPage(page);

  const trigger = page.getByRole('button', { name: /afficher les actions|^actions pour /i }).filter({ visible: true }).first();
  await trigger.click();
  const actions = page.getByRole('dialog', { name: /^actions pour /i });
  await expect(actions).toBeVisible({ timeout: 20_000 });

  await actions.getByRole('button', { name: /^ajouter à une liste$/i }).first().click();
  // `TaskActionsSheet` se FERME en s'ouvrant sur celle-ci (`open={actionsVisible
  // && !addToListMode}`) : c'est un relais, pas un empilement. La garde des
  // frères d'EventModal couvre l'empilement ; ici on vérifie le relais.
  const sheet = page.getByRole('dialog', { name: /^listes$/i });
  await expect(sheet).toBeVisible({ timeout: 10_000 });

  const report = await measureFocus(page, sheet, true);
  console.log('[a11y-kbd] MobileAddToList', JSON.stringify(report));
  assertModalTrapsFocus('MobileAddToList', report);
});

test('MESURE — ShareListSheet (partage d\'une liste manuelle)', async ({ demoPage: page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await openTasksPage(page);

  // 🔴 Le jeu de démo n'a QUE des listes intelligentes, et le bouton
  // « Partager » n'est monté que pour `list.type !== 'smart'` : sans créer une
  // liste manuelle, la garde ne trouverait jamais son déclencheur et
  // EXPIRERAIT — un timeout n'est pas un résultat.
  //
  // ⚠️ Sur desktop la création est INLINE (`CreateListForm variant="inline"`),
  // pas une feuille, et son déclencheur est la puce « Liste » — le bouton
  // « Nouvelle liste » est `sm:hidden`, donc mobile uniquement. Viser ce
  // dernier ici faisait attendre 3 min un élément jamais monté.
  await page.getByRole('button', { name: /^liste$/i }).filter({ visible: true }).first().click();
  const nameField = page.getByPlaceholder(/nom de la liste/i).first();
  await expect(nameField).toBeVisible({ timeout: 10_000 });
  await nameField.fill('Liste a11y');
  await nameField.press('Enter');

  const chip = page.getByRole('button', { name: /^liste a11y/i }).filter({ visible: true }).first();
  await expect(chip).toBeVisible({ timeout: 15_000 });

  // 🔴 C-74 : attendre que le TOAST de création ait disparu.
  //
  // Sans cette attente, ce cas expirait au bout de 180 s dans tous les runs CI
  // depuis le 2026-09-10, et le journal de Playwright nommait le coupable sans
  // que personne ne l'ouvre :
  //
  //   <li data-sonner-toast ...> from <section aria-label="Notifications alt+T">
  //   subtree intercepts pointer events
  //
  // La confirmation « liste créée » s'affiche en HAUT À DROITE, c'est-à-dire
  // exactement là où vit la rangée de puces et son bouton de partage. Playwright
  // réessayait le clic, le survol finissait par se perdre, la commande révélée
  // au survol se démontait, et l'erreur finale — « element was detached » —
  // désignait le symptôme au lieu de la cause.
  //
  // ⚠️ Ce n'est PAS qu'un défaut de test : pendant ces quelques secondes, la
  // même chose arrive à une vraie personne qui vient de créer une liste et veut
  // la partager. Noté dans C-74 ; ici on mesure le clavier, pas la fenêtre de
  // recouvrement, et un test qui met trois minutes à échouer ne mesure plus rien.
  //
  // ❌ Ne pas remplacer par un `waitForTimeout` : la durée d'un toast n'est pas
  // un contrat, et une attente fixe redeviendrait fausse au premier réglage.
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 30_000 });

  // Les actions de la puce sont révélées au SURVOL sur desktop.
  await chip.hover();
  const trigger = page.getByRole('button', { name: /^partager la liste$/i }).filter({ visible: true }).first();
  await expect(trigger).toBeVisible({ timeout: 10_000 });
  await trigger.focus();
  await markTrigger(page);
  await trigger.click();

  const sheet = page.getByRole('dialog', { name: /^partager la liste liste a11y$/i });
  await expect(sheet).toBeVisible({ timeout: 20_000 });

  const report = await measureFocus(page, sheet, true);
  console.log('[a11y-kbd] ShareListSheet', JSON.stringify(report));
  assertModalTrapsFocus('ShareListSheet', report);
});

test('MESURE — DatePicker ancré à un champ (modale OKR)', async ({ demoPage: page }) => {
  await navTo(page, /okr/i, /\/okr/);
  await page.waitForLoadState('networkidle');
  const trigger = page.getByRole('button', { name: /créer un nouvel objectif/i }).filter({ visible: true }).first();
  await trigger.click({ timeout: 20_000 });
  await page.waitForTimeout(800);

  const dateBtn = page
    .locator('button')
    .filter({ hasText: /\d{1,2}\s+\p{L}+\s+\d{4}|jj\/mm\/aaaa|\d{2}\/\d{2}\/\d{4}|choisir une date/iu })
    .filter({ visible: true })
    .first();
  const hasField = await dateBtn.isVisible({ timeout: 8_000 }).catch(() => false);
  if (!hasField) {
    const btns = await page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .filter((b) => (b as HTMLElement).offsetParent !== null)
        .map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 40))
        .slice(0, 60),
    );
    console.log('[a11y-kbd] DatePicker — aucun champ date. Boutons visibles:', JSON.stringify(btns));
    return;
  }
  await dateBtn.focus();
  // Ouverture au CLAVIER, comme un utilisateur sans souris.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);

  const grid = page.locator('[role="grid"]').filter({ visible: true }).last();
  const gridVisible = await grid.isVisible().catch(() => false);
  const focusOnOpen = await describeFocus(page);
  let arrowMoved: boolean | null = null;
  let presetsReachable: string | null = null;
  let escClosed: boolean | null = null;
  if (gridVisible) {
    const f0 = await describeFocus(page);
    const ctx = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      const root = document.querySelector('.rdp-root, [data-slot="calendar"]');
      return {
        caption: root?.querySelector('.rdp-month_caption, [class*="month_caption"]')?.textContent?.trim() ?? null,
        focusedInGrid: !!(el && root?.contains(el)),
        focusedVisible: !!(el && el.offsetParent !== null),
        fieldLabel: document.querySelector('[data-slot="popover-trigger"], button[aria-expanded="true"]')?.textContent?.trim() ?? null,
      };
    });
    console.log('[a11y-kbd] DatePicker contexte', JSON.stringify(ctx));
    const trace = [f0];
    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowDown']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(250);
      trace.push(key + ' -> ' + (await describeFocus(page)));
    }
    console.log('[a11y-kbd] DatePicker fleches', JSON.stringify(trace));
    arrowMoved = (await describeFocus(page)) !== f0;
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(150);
    presetsReachable = await describeFocus(page);
    await page.keyboard.press('Escape');
    escClosed = await grid.waitFor({ state: 'hidden', timeout: 1_500 }).then(() => true).catch(() => false);
  }
  console.log('[a11y-kbd] DatePicker', JSON.stringify({ gridVisible, focusOnOpen, arrowMoved, presetsReachable, escClosed }));

  // Noms accessibles réellement annoncés par le calendrier.
  await dateBtn.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const names = await page.evaluate(() => {
    const root = document.querySelector('.rdp-root, [data-slot="popover-content"]');
    if (!root) return null;
    return [...root.querySelectorAll('[aria-label]')]
      .map((n) => n.getAttribute('aria-label'))
      .filter((v, i, a) => v && a.indexOf(v) === i)
      .slice(0, 12);
  });
  console.log('[a11y-kbd] DatePicker noms accessibles', JSON.stringify(names));

  // ── RÉGRESSION (findings C-51 et C-52) ──────────────────────────
  // 1. Ouvrir le calendrier au clavier doit poser le focus DANS la grille.
  //    `initialFocus` est mort en react-day-picker 9 (seul `autoFocus` est lu),
  //    et le focus tombait sur la rangée de presets, où les flèches ne font
  //    rien. Même classe que le `Button` non-forwardRef du 2026-08-30.
  expect(gridVisible, "le calendrier ne s'ouvre pas au clavier").toBe(true);
  expect(arrowMoved, "ArrowRight ne deplace pas le focus a l'ouverture").toBe(true);

  // 2. Aucun nom accessible en anglais dans un produit francophone.
  //    react-day-picker n'a AUCUNE traduction de ses labels ARIA : `locale`
  //    ne traduit que les DATES, pas les libellés de navigation.
  const english = (names ?? []).filter((n) => /^(Navigation bar|Go to the|Today,)/i.test(n ?? ''));
  expect(english, `noms accessibles anglais: ${JSON.stringify(english)}`).toHaveLength(0);
});

test('MESURE — /agenda FullCalendar au clavier', async ({ demoPage: page }) => {
  await navTo(page, /agenda/i, /\/agenda/);
  await page.waitForLoadState('networkidle');
  await page.locator('.fc').first().waitFor({ state: 'attached', timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const stats = await page.evaluate(() => {
    const root =
      document.querySelector('.fc') ??
      document.querySelector('[data-tutorial-id="agenda-calendar-grid"]');
    if (!root) {
      return {
        found: false,
        mainClasses: [...document.querySelectorAll('main *')]
          .slice(0, 40)
          .map((n) => (n as HTMLElement).className)
          .filter((c) => typeof c === 'string' && c)
          .slice(0, 15),
      } as Record<string, unknown>;
    }
    const q = (sel: string) => root.querySelectorAll(sel).length;
    return {
      found: true,
      rootClass: (root as HTMLElement).className.slice(0, 80),
      focusables: q('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      events: q('.fc-event'),
      focusableEvents: q('.fc-event[tabindex]:not([tabindex="-1"]), a.fc-event[href], button.fc-event'),
      dayCells: q('.fc-daygrid-day, .fc-timegrid-col'),
      focusableDays: q('.fc-daygrid-day[tabindex]:not([tabindex="-1"]), .fc-timegrid-col[tabindex]:not([tabindex="-1"])'),
      tableRoles: [...root.querySelectorAll('table')].map((t) => t.getAttribute('role')),
      gridRoles: [...root.querySelectorAll('[role="grid"], [role="rowgroup"], [role="gridcell"]')].length,
    };
  });
  console.log('[a11y-kbd] Agenda', JSON.stringify(stats));

  // Marche clavier réelle : combien de Tab pour traverser l'agenda, et
  // atteint-on un événement ?
  await page.locator('body').press('Tab');
  const walk: string[] = [];
  let reachedEvent = false;
  for (let i = 0; i < 60; i++) {
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return { label: 'NULL', isEvent: false };
      const isEvent = !!el.closest('.fc-event');
      const name = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30) || '';
      return { label: `${el.tagName.toLowerCase()}[${name}]`, isEvent };
    });
    if (info.isEvent) { reachedEvent = true; walk.push('EVENT:' + info.label); break; }
    walk.push(info.label);
    await page.keyboard.press('Tab');
  }
  console.log('[a11y-kbd] Agenda marche clavier', JSON.stringify({ reachedEvent, steps: walk.length, walk: walk.slice(0, 30) }));
});

// ═══════════════════════════════════════════════════════════════════
// C-54 · liens d'évitement + chemin clavier de création (/agenda)
//
// Ces trois tests sont ASSERTIONNÉS, pas imprimés : ils portent la décision
// prise le 2026-09-04 (cf. docs/ACCESSIBILITY.md § « C-54 tranché »), à savoir
// que le motif grille de FullCalendar n'est PAS adopté et que le bouton
// « Nouveau » est le chemin clavier de la création. Une décision qui n'est
// gardée par rien redevient un oubli à la première refonte.
//
// Le mode d'échec qu'ils visent est SILENCIEUX : un lien d'évitement dont la
// cible a perdu son `tabIndex={-1}` fait défiler la page sans déplacer le
// focus. On vérifie donc `document.activeElement`, jamais le défilement.
// ═══════════════════════════════════════════════════════════════════

/** Identité de l'élément focalisé : id, rôle implicite, nom accessible. */
async function focusedIdentity(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return { id: '', tag: '', name: '' };
    return {
      id: el.id,
      tag: el.tagName.toLowerCase(),
      name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
    };
  });
}

test('GARDE — /agenda : les deux liens d\'évitement déplacent le focus', async ({ demoPage: page }) => {
  await navTo(page, /agenda/i, /\/agenda/);
  await page.waitForLoadState('networkidle');
  await page.locator('.fc').first().waitFor({ state: 'attached', timeout: 30_000 });
  await page.waitForTimeout(1_000);

  // 1. Premier arrêt de tabulation de la page = le lien d'évitement global.
  //
  //    🔴 Il faut repartir d'un CHARGEMENT, pas d'un simple `body.press('Tab')`.
  //    `navTo` a cliqué le lien « Agenda » de la barre latérale : Chromium garde
  //    ce lien comme point de départ de la navigation séquentielle, et le Tab
  //    suivant reprend au MILIEU de la nav (on tombait sur « OKR »). Un `blur()`
  //    ne suffit pas, le point de départ survit au relâchement du focus.
  //    C'est exactement ce biais qui rendait les « 38 tabulations » du
  //    2026-09-03 optimistes : elles étaient comptées depuis ce lien, donc plus
  //    bas que le haut de page réel.
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.locator('.fc').first().waitFor({ state: 'attached', timeout: 30_000 });
  await page.waitForTimeout(1_000);
  await page.keyboard.press('Tab');
  const first = await focusedIdentity(page);
  expect(first.tag, `premier arrêt de tabulation: ${JSON.stringify(first)}`).toBe('a');
  expect(first.name).toMatch(/contenu principal/i);

  // 2. Entrée pose le focus SUR le <main>, pas seulement le défilement.
  await page.keyboard.press('Enter');
  expect((await focusedIdentity(page)).id).toBe('main-content');

  // 3. Le premier arrêt À L'INTÉRIEUR du main est le second lien d'évitement,
  //    celui qui saute le panneau des tâches.
  await page.keyboard.press('Tab');
  const second = await focusedIdentity(page);
  expect(second.name, `premier arrêt dans le main: ${JSON.stringify(second)}`).toMatch(/calendrier/i);

  // 4. Il pose le focus sur le conteneur du calendrier DESKTOP.
  await page.keyboard.press('Enter');
  expect((await focusedIdentity(page)).id).toBe('agenda-calendar');

  // 5. Et de là, le premier événement est à quelques tabulations, contre 38
  //    avant correctif (finding C-54).
  let steps = 0;
  let reached = false;
  for (; steps < 10 && !reached; steps++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(() => !!(document.activeElement as HTMLElement)?.closest('.fc-event'));
  }
  console.log('[a11y-kbd] C-54 tabulations calendrier → 1er événement', JSON.stringify({ reached, steps }));
  expect(reached, `premier événement non atteint en ${steps} tabulations depuis le calendrier`).toBe(true);
});

test('GARDE — /agenda : le bouton « Nouveau » est atteignable au clavier et ouvre la saisie', async ({ demoPage: page }) => {
  await navTo(page, /agenda/i, /\/agenda/);
  await page.waitForLoadState('networkidle');
  await page.locator('.fc').first().waitFor({ state: 'attached', timeout: 30_000 });
  await page.waitForTimeout(1_000);

  // On part du calendrier et on REMONTE l'ordre de tabulation : le bouton de
  // création le précède dans le DOM. Preuve d'atteignabilité au clavier, pas
  // un `focus()` programmatique qui prouverait seulement que l'élément existe.
  await page.evaluate(() => document.getElementById('agenda-calendar')?.focus());
  let found = false;
  const walk: string[] = [];
  for (let i = 0; i < 20 && !found; i++) {
    await page.keyboard.press('Shift+Tab');
    const id = await focusedIdentity(page);
    walk.push(id.name);
    found = /^nouveau$/i.test(id.name);
  }
  expect(found, `bouton « Nouveau » non atteint en remontant: ${JSON.stringify(walk)}`).toBe(true);

  // Entrée l'active. La saisie offre un jour ET une heure, tous deux
  // atteignables en continuant simplement à tabuler : c'est ce qui rend la
  // décision « le bouton Nouveau est le chemin clavier » tenable.
  //
  // ⚠️ Le focus n'ENTRE PAS dans la modale à l'ouverture (finding C-53, encore
  // ouvert) : il reste sur le bouton, et la modale se rejoint en tabulant à
  // travers les événements du calendrier qui la précèdent dans le DOM. Mesuré
  // le 2026-09-04 : 4 tabulations jusqu'au bouton « Fermer » de la modale,
  // 7 jusqu'au premier champ d'heure. La borne de 12 laisse la marge d'un
  // jeu de démo plus fourni sans laisser passer une régression d'ordre.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  expect(
    await page.locator('input[type="time"]:visible').count(),
    "la saisie ouverte ne propose aucun champ d'heure visible",
  ).toBeGreaterThan(0);

  const fieldWalk: string[] = [];
  let onTimeField = false;
  for (let i = 0; i < 12 && !onTimeField; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return {
        isTime: el?.getAttribute('type') === 'time',
        name: `${el?.tagName.toLowerCase()}[${(el?.getAttribute('aria-label') || el?.textContent || el?.getAttribute('type') || '').trim().slice(0, 25)}]`,
      };
    });
    fieldWalk.push(info.name);
    onTimeField = info.isTime;
  }
  console.log('[a11y-kbd] C-54 chemin clavier de création', JSON.stringify({ tabs: fieldWalk.length, fieldWalk }));
  expect(onTimeField, `aucun champ d'heure atteint en tabulant depuis « Nouveau »: ${JSON.stringify(fieldWalk)}`).toBe(true);
});
