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

// ═══════════════════════════════════════════════════════════════════
// C-55 — les TROIS surfaces que l'audit A-3 n'avait PAS su mesurer
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 Ce n'étaient pas des findings : c'étaient trois trous de COUVERTURE, et
// l'item les nommait pour qu'on ne les croie pas vérifiés. Ils sont mesurés ici
// le 2026-09-12, dans un vrai navigateur.
//
// ⚠️ Ce que la première tentative a appris, et qui vaut au-delà de C-55 : la
// mesure a d'abord été faite dans le panneau navigateur de l'agent, qui ne
// PEINT pas quand il est caché. Les animations CSS n'y progressent donc pas,
// `animationend` n'arrive jamais, et un menu Radix en cours de fermeture reste
// indéfiniment dans le DOM, `data-state="closed"` et pourtant opaque. On y
// « mesurait » un menu impossible à fermer au clavier — un défaut du HARNAIS,
// pris pour un défaut du produit. C'est très exactement la leçon de C-74 : un
// rouge ne dit pas où est le défaut, il dit qu'il y en a un quelque part entre
// le produit et sa mesure.
//
// Deux obstacles de décor l'ont aussi retardée, et ils sont traités ici plutôt
// que contournés : le tutoriel de `/tasks` et le bandeau cookies couvrent
// littéralement la zone à mesurer.

/**
 * Ouvre `/tasks` DÉBARRASSÉE de son décor : tutoriel de page, bandeau cookies,
 * toast de rappel d'échéance.
 *
 * 🔴 Les trois recouvrent littéralement la zone à mesurer, et le troisième est
 * exactement la cause de C-74 (« un toast Sonner intercepte le clic »). Les
 * contourner par `force: true` aurait mesuré un clic qu'aucune personne ne peut
 * faire ; on les ferme.
 *
 * ⚠️ `goto` et non `navTo` : le parcours de navigation ramenait le tableau de
 * bord dans `#main-content` alors que l'URL disait `/tasks`. On mesure une
 * PAGE, pas une navigation — même choix que `e2e/touch-targets.spec.ts`.
 */
async function openTasksBare(page: Page): Promise<void> {
  await page.goto('/tasks');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1_200);

  const skip = page.getByRole('button', { name: /passer le tutoriel/i }).first();
  if (await skip.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await skip.click().catch(() => {});
    await page.waitForTimeout(400);
  }
  const refuse = page.getByRole('button', { name: /^refuser$/i }).first();
  if (await refuse.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await refuse.click().catch(() => {});
    await page.waitForTimeout(400);
  }
  // Le toast de rappel se ferme par sa propre croix, jamais par Échap.
  for (let i = 0; i < 3; i++) {
    const close = page.getByRole('button', { name: /close toast/i }).first();
    if (!(await close.isVisible({ timeout: 1_500 }).catch(() => false))) break;
    await close.click().catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(400);
}

test('MESURE C-55 — le calendrier ouvert depuis une ENTRÉE DE MENU', async ({ demoPage: page }) => {
  // La surface que A-3 jugeait « la plus risquée des huit » : une GRILLE vit à
  // l'intérieur d'un `role="menu"`, ce que l'ARIA n'autorise pas, et les
  // correctifs de C-51 (`autoFocus`) n'y avaient jamais été éprouvés.
  await openTasksBare(page);

  const trigger = page.getByRole('button', { name: /tout replanifier/i }).first();
  // ⚠️ A-3 concluait « n'apparaît pas dans le jeu de démo, aucune tâche en
  // retard ». REMESURÉ : le bandeau EST là. L'énoncé décrivait un autre seed.
  const bannerPresent = await trigger.isVisible({ timeout: 8_000 }).catch(() => false);
  expect(bannerPresent, 'le bandeau « En retard » doit être dans le jeu de démo').toBe(true);

  await trigger.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  const menu = page.locator('[role="menu"]').filter({ visible: true }).first();
  expect(await menu.isVisible().catch(() => false), "Entrée n'ouvre pas le menu").toBe(true);

  // Descendre jusqu'à « Choisir une date… ».
  //
  // 🔴 Surtout PAS un `ArrowUp` « qui va à la dernière entrée » : mesuré, il
  // pose le focus sur « Demain », et l'Entrée qui suit REPLANIFIE toutes les
  // tâches en retard au lieu d'ouvrir le calendrier. Le test passait alors à
  // côté de ce qu'il prétend mesurer, en modifiant les données au passage. On
  // descend donc jusqu'à l'entrée VOULUE, en vérifiant son nom.
  let onPick = await describeFocus(page);
  for (let i = 0; i < 8 && !/choisir une date/i.test(onPick); i++) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);
    onPick = await describeFocus(page);
  }
  expect(onPick, "« Choisir une date… » n'est pas atteignable aux flèches").toMatch(/choisir une date/i);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);

  const grid = page.locator('[role="grid"]').filter({ visible: true }).first();
  const gridVisible = await grid.isVisible().catch(() => false);
  const gridInsideMenu = gridVisible
    ? await page.evaluate(() => !!document.querySelector('[role="grid"]')?.closest('[role="menu"]'))
    : null;
  const focusInGrid = gridVisible
    ? await page.evaluate(() => !!document.activeElement?.closest('[role="grid"]'))
    : false;
  const dayOnOpen = await describeFocus(page);

  // Les flèches doivent parcourir le calendrier, PAS les entrées du menu :
  // c'est tout le risque d'une grille dans un `role="menu"`.
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(250);
  const afterRight = await describeFocus(page);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(250);
  const afterDown = await describeFocus(page);

  await page.keyboard.press('Escape');
  const calendarClosed = await grid
    .waitFor({ state: 'hidden', timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  await page.waitForTimeout(600);
  const focusAfterEsc = await describeFocus(page);
  const menuStillOpen = await menu.isVisible().catch(() => false);

  console.log(
    '[C-55] calendrier dans un menu',
    JSON.stringify({ onPick, gridVisible, gridInsideMenu, focusInGrid, dayOnOpen, afterRight, afterDown, calendarClosed, focusAfterEsc, menuStillOpen }),
  );

  // ── ASSERTIONNÉ : ce que C-51 promet doit tenir DANS ce conteneur ────
  expect(gridVisible, "Entrée sur « Choisir une date… » n'ouvre pas le calendrier").toBe(true);
  expect(focusInGrid, `le focus n'entre pas dans la grille (${dayOnOpen})`).toBe(true);
  expect(afterRight, 'ArrowRight ne déplace pas le focus dans la grille').not.toBe(dayOnOpen);
  expect(afterDown, 'ArrowDown ne déplace pas le focus (le menu l’intercepte ?)').not.toBe(afterRight);
  expect(calendarClosed, 'Échap ne referme pas le calendrier').toBe(true);

  // ── IMPRIMÉ, pas assertionné : `gridInsideMenu` ──────────────────────
  // Une grille dans un `role="menu"` est bien une entorse ARIA, et elle est
  // RÉELLE. Mais la corriger demande de sortir le calendrier du menu, ce que
  // `OverdueBanner` documente comme ayant déjà été essayé DEUX fois et mesuré
  // cassé (course au focus entre le menu et un second `DismissableLayer`). En
  // faire une gate imposerait de rouvrir cet arbitrage sans l'avoir rendu.
  console.log('[C-55] grille dans un role="menu" :', gridInsideMenu);
});

test('MESURE C-55 — barre de sélection : stabilité et noms en mode sélection', async ({ demoPage: page }) => {
  // Deux des trois trous d'A-3 d'un coup : la barre d'actions groupées n'était
  // jamais jugée STABLE par Playwright (34 tentatives), et les cases à cocher
  // gardaient le nom « Marquer … comme terminée » alors qu'elles sélectionnent.
  await openTasksBare(page);

  const selectMode = page.getByRole('button', { name: /sélectionner/i }).first();
  const hasSelectMode = await selectMode.isVisible({ timeout: 8_000 }).catch(() => false);
  if (!hasSelectMode) {
    // Un « rien » se DIT. A-3 avait échoué sans laisser de trace lisible.
    console.log('[C-55] mode sélection introuvable sur /tasks — rien mesuré');
    expect(hasSelectMode, 'le mode sélection doit exister sur /tasks').toBe(true);
    return;
  }
  await selectMode.click();
  await page.waitForTimeout(500);

  // Nom accessible des cases à cocher UNE FOIS le mode sélection actif.
  const names = await page.evaluate(() =>
    [...document.querySelectorAll('input[type="checkbox"], [role="checkbox"], button[aria-pressed]')]
      .filter((n) => (n as HTMLElement).offsetParent !== null)
      .map((n) => (n.getAttribute('aria-label') || n.textContent || '').trim().slice(0, 60))
      .filter((v, i, a) => v && a.indexOf(v) === i)
      .slice(0, 8),
  );
  console.log('[C-55] noms des cases en mode sélection', JSON.stringify(names));

  // Sélectionner une tâche, puis PROUVER que la sélection a pris.
  //
  // 🔴 A-3 s'est arrêté ici : « cocher une tâche laissait 0 sélectionnée, donc
  // la barre restait désactivée ». Sans cette preuve, tout ce qui suit
  // mesurerait une barre inerte et conclurait à tort.
  // 🔴 La case de SELECTION, pas celle qui termine la tache. Les deux sont
  // cote a cote dans la rangee desktop, et A-3 a clique sur la mauvaise : sa
  // conclusion « 0 selectionnee » decrivait un clic qui cochait « terminee ».
  const firstCheck = page.getByRole('checkbox', { name: /^s[ée]lectionner/i }).first();
  await firstCheck.click({ timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(700);
  const selectionCount = await page.evaluate(() => {
    const m = document.body.innerText.match(/(\d+)\s+s[ée]lectionn/i);
    return m ? Number(m[1]) : null;
  });
  console.log('[C-55] sélection après un clic :', selectionCount);

  const more = page.getByRole('button', { name: /plus d.actions/i }).first();
  const moreVisible = await more.isVisible({ timeout: 5_000 }).catch(() => false);
  let moreStable: boolean | null = null;
  let moreOpens: boolean | null = null;
  if (moreVisible) {
    // 🔴 LE point d'A-3 : « jamais jugé stable, 34 tentatives ». On mesure la
    // stabilité par la boîte, deux fois à 400 ms d'intervalle, plutôt que de
    // laisser l'auto-attente de Playwright échouer sans rien dire.
    const b1 = await more.boundingBox();
    await page.waitForTimeout(400);
    const b2 = await more.boundingBox();
    moreStable = !!b1 && !!b2 && b1.x === b2.x && b1.y === b2.y;
    await more.click({ timeout: 10_000, force: !moreStable }).catch(() => {});
    await page.waitForTimeout(500);
    moreOpens = await page.locator('[role="menu"]').filter({ visible: true }).first()
      .isVisible().catch(() => false);
  }
  console.log('[C-55] barre de sélection', JSON.stringify({ moreVisible, moreStable, moreOpens, selectionCount }));

  // ── ASSERTIONNÉ : la stabilité, c'est-à-dire le point 2 de C-55 ───────
  // A-3 rapportait « jamais jugé stable, 34 tentatives ». Si la mesure le
  // trouve stable, l'énoncé était un artefact de harnais, et il faut le DIRE
  // plutôt que laisser l'item porter un soupçon.
  expect(moreVisible, "la barre d'actions groupées ne s'affiche pas").toBe(true);
  expect(moreStable, '« Plus d’actions » bouge encore entre deux mesures').toBe(true);
  expect(selectionCount, 'cocher une tâche en mode sélection ne sélectionne rien').toBeGreaterThan(0);

  // ── ASSERTIONNÉ : une case qui SÉLECTIONNE ne doit pas dire qu'elle termine.
  const selectors = names.filter((n) => /^s[ée]lectionner\s+[«"]/i.test(n));
  expect(
    selectors.length,
    'en mode sélection, la case qui SÉLECTIONNE doit porter un nom qui le dit. '
      + 'Noms relevés : ' + JSON.stringify(names),
  ).toBeGreaterThan(0);
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
