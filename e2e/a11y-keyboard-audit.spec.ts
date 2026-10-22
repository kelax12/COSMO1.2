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

import { test, expect, navTo, openOrgSection } from './fixtures';
import type { Page, Locator } from '@playwright/test';

test.describe.configure({ timeout: 180_000 });

// ── C-118 · CE FICHIER JOUE AUSSI SOUS WEBKIT, EN CLAVIER DE BUREAU ─────────
//
// Le project `mobile-safari` (iPhone 12, 390 px, tactile) joue ce fichier, et
// c'est le seul moteur WebKit du job `e2e`. Mais un audit CLAVIER est un audit
// d'ordinateur : la personne qui navigue à la touche Tab est sur Safari macOS,
// à 1 280 px, sans écran tactile. À 390 px, les déclencheurs de bureau
// (« Nouveau », la création d'habitude) n'existent pas, et les cas expiraient
// sur un élément jamais monté. Mesuré le 2026-10-16 sur un build de production.
//
// On remet donc le viewport, le tactile et l'échelle d'un poste de bureau POUR
// CE FICHIER, quel que soit le project. Sous `chromium` ces trois valeurs sont
// déjà celles par défaut : rien ne change pour lui. Les cas qui ont besoin
// d'une feuille mobile redimensionnent eux-mêmes (`setViewportSize(375…)`),
// comme avant.
//
// ⚠️ Le user-agent reste celui de l'iPhone : l'application ne le lit que pour
// le libellé des raccourcis (⌘ ou Ctrl), identique pour Mac et iPhone.
test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

// ── ÉCART SAFARI N° 1 : Tab ne s'arrête pas sur les LIENS ───────────────────
//
// Safari (macOS) laisse désactivé par défaut « Appuyer sur Tab pour mettre en
// évidence chaque élément d'une page » : Tab saute les liens et ne s'arrête que
// sur les champs et les boutons ; Option+Tab parcourt tout. Mesuré le
// 2026-10-16 sous WebKit (Safari 26.5, build Playwright pour Windows) : après un
// chargement frais de /agenda, cinq Tab de suite traversent la barre latérale
// sans toucher un seul de ses liens, ni le lien d'évitement.
//
// ❌ Ce n'est PAS un défaut du produit : c'est le réglage par défaut du
// navigateur, et une personne qui navigue au clavier sous Safari connaît
// Option+Tab. ⚠️ Playwright ne sait pas l'émuler : `Alt+Tab` n'y change rien
// (mesuré), et sous le WebKit de Linux, qui est celui de la CI, ce serait
// l'inverse d'un réglage qui parcourt déjà les liens. On ne simule donc pas la
// touche : on SONDE le moteur (`tabAtteintLesLiens`) et le cas qui parcourt des
// liens (le lien d'évitement) mesure alors les MÊMES propriétés du produit sans
// passer par Tab : le lien est le premier focalisable dans l'ordre du document,
// sa cible accepte le focus, et Entrée l'y déplace.
// ❌ Ne pas appliquer ce repli aux cas qui mesurent des boutons et des champs
// (pièges de focus des modales) : Tab seul est ce que Safari fait, et c'est ce
// qu'ils doivent mesurer.

/** Tab s'arrête-t-il sur un lien dans ce navigateur ? (Faux par défaut sous Safari macOS.) */
async function tabAtteintLesLiens(page: Page): Promise<boolean> {
  const sonde = await page.context().newPage();
  try {
    await sonde.setContent('<a href="#x">lien</a><button>bouton</button>');
    await sonde.keyboard.press('Tab');
    return await sonde.evaluate(() => document.activeElement?.tagName === 'A');
  } finally {
    await sonde.close();
  }
}

const FOCALISABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), '
  + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Le premier arrêt de tabulation d'un conteneur, lu dans l'ORDRE DU DOCUMENT, et
 * le focus qui s'y pose : ce que ferait un Tab dans un moteur qui parcourt tout.
 */
async function premierArretDuDocument(page: Page, conteneurId?: string) {
  return page.evaluate(
    ({ sel, id }) => {
      const racine = id ? document.getElementById(id) : document;
      const el = racine?.querySelector<HTMLElement>(sel) ?? null;
      el?.focus();
      return {
        id: el?.id ?? '',
        tag: el?.tagName.toLowerCase() ?? '',
        name: (el?.getAttribute('aria-label') || el?.textContent || '').trim().slice(0, 40),
      };
    },
    { sel: FOCALISABLES, id: conteneurId },
  );
}

/**
 * Passe en gabarit téléphone ET attend que la barre d'onglets mobile soit
 * montée.
 *
 * 🔴 Sans cette attente, `navTo` cherchait ses liens pendant que la mise en page
 * bureau se démontait encore : sous WebKit, le lien « Tâches » n'était pas
 * encore atteignable, la fixture retombait sur la feuille « Plus », qui ne le
 * porte pas, et le cas expirait sur un élément qui n'existe pas dans cette
 * feuille (échec constant le 2026-10-16, absent sous Chromium).
 */
async function passerEnMobile(page: Page): Promise<void> {
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole('button', { name: /plus d'options/i }).filter({ visible: true }).first())
    .toBeVisible({ timeout: 20_000 });
}

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
  // ⚠️ Attendu jusqu'à 3 s, pas lu une fois : une surface pose son focus JUSTE
  // APRÈS son affichage, et la lecture immédiate tombait parfois avant
  // (MobileAddToList, instable en CI le 2026-10-10). Un focus qui n'entre
  // jamais rend toujours `false`, au bout des 3 s.
  const focusMovedIn = await expect
    .poll(() => focusInside(container), { timeout: 3_000 })
    .toBe(true)
    .then(() => true, () => false);
  const focusedOnOpen = await describeFocus(page);
  const role = await container.getAttribute('role');
  const ariaModal = await container.getAttribute('aria-modal');

  let firstEscapee: string | null = null;
  for (let i = 0; i < 15 && firstEscapee === null; i++) {
    await page.keyboard.press('Tab');
    if (!(await focusInside(container))) firstEscapee = await describeFocus(page);
  }

  await page.keyboard.press('Escape');
  // 5 s et non 2 : sous WebKit, machine chargée ou runner CI, la sortie animée
  // d'une modale dépasse 2 s (mesuré le 2026-10-16 : le TÉMOIN Radix lui-même
  // rendait « Échap ne ferme pas » une fois sur trois alors qu'il se fermait).
  // Le détecteur reste le même : une modale qu'Échap ne ferme JAMAIS échoue
  // toujours, au bout des 5 s.
  const escClosed = await container
    .waitFor({ state: 'hidden', timeout: 5_000 })
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
  // Attendu 3 s, même raison que les frères ci-dessous (instable le 2026-10-10).
  await expect
    .poll(() => focusInside(discard), {
      timeout: 3_000,
      message: `focus non entré dans la confirmation: ${await describeFocus(page)}`,
    })
    .toBe(true);
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
    // `dispatchEvent`, comme `MESURE — EventModal` plus haut : sous WebKit le
    // test « stable » de Playwright n'aboutit pas sur ce bouton animé (échec du
    // 2026-10-16, un run sur trois). Le focus est posé d'abord, comme au clavier.
    await trigger.focus({ timeout: 20_000 });
    await trigger.dispatchEvent('click');
    const eventModal = page.getByRole('dialog', { name: /ajouter un événement/i });
    await expect(eventModal).toBeVisible({ timeout: 20_000 });

    await eventModal.getByRole(child.role, { name: child.open }).first().click();
    const sibling = page.getByRole('dialog', { name: child.dialog });
    await expect(sibling).toBeVisible({ timeout: 10_000 });

    // ── Le piège est passé À L'ENFANT ──────────────────────────────
    // ⚠️ Attendu, pas lu une fois : la modale pose le focus JUSTE APRÈS son
    // affichage, et une lecture immédiate tombait parfois avant (instable en
    // CI le 2026-10-09). Un focus qui n'entre JAMAIS échoue toujours, en 3 s.
    await expect
      .poll(() => focusInside(sibling), {
        timeout: 3_000,
        message: `focus non entré dans ${child.surface}: ${await describeFocus(page)}`,
      })
      .toBe(true);
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

/**
 * Ouvre `TaskActionsSheet` depuis une carte de tâche MOBILE, au CLAVIER.
 *
 * 🔴 POURQUOI CE HELPER EXISTE (C-111, 2026-09-22). Ces cas cherchaient
 * `getByRole('button', { name: /afficher les actions|^actions pour /i })
 * .filter({ visible: true })`, et ils EXPIRAIENT — pas par lenteur, mais
 * parce qu'aucun bouton de ce nom n'est visible à 375 px. Mesuré dans le
 * navigateur : le seul élément qui le porte vit dans
 * `div.hidden md:block table-container`, soit la ligne DESKTOP, à `0 x 0 px`
 * sur téléphone. La maquette 86 a retiré le « ⋯ » des cartes mobiles, et
 * laissé trois chemins qui sont tous des gestes de pointeur.
 *
 * Le harnais emprunte donc le chemin CLAVIER, qui est celui que ce fichier a
 * vocation à mesurer, et qui est plus exigeant qu'un clic : la touche « menu
 * contextuel » (émulée par `Shift+F10`, comme le fait un vrai clavier) sur la
 * carte focalisée.
 *
 * ⚠️ Ce n'est PAS un contournement de la mesure : si le chemin clavier
 * disparaît, ce helper échoue, alors que l'ancien sélecteur échouait déjà
 * pour une raison qui n'avait plus rien à voir avec l'accessibilité.
 */
async function ouvrirActionsAuClavier(page: Page) {
  const carte = page.locator('[tabindex="0"][aria-keyshortcuts="Shift+F10"]').first();
  await expect(carte).toBeVisible({ timeout: 30_000 });
  await carte.focus();
  await markTrigger(page);
  await carte.press('Shift+F10');
  const sheet = page.getByRole('dialog', { name: /^actions pour /i });
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  return sheet;
}

test('MESURE — TaskActionsSheet (feuille d\'actions d\'une tâche)', async ({ demoPage: page }) => {
  // ⚠️ Viewport MOBILE : la feuille appartient à `TaskCard`, la carte mobile.
  // Au-dessus du point de rupture, le bouton « Actions pour … » existe encore
  // mais n'ouvre pas cette surface — mesuré le 2026-09-08, la garde cherchait
  // un `role="dialog"` qui n'était jamais monté.
  await passerEnMobile(page);
  await openTasksPage(page);

  const sheet = await ouvrirActionsAuClavier(page);

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
  await passerEnMobile(page);
  await openTasksPage(page);

  const actions = await ouvrirActionsAuClavier(page);

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
  // 🔴 La puce porte le nom « Nouvelle liste manuelle » depuis le 2026-10-09 :
  // la bascule de vue Liste / Tableau a aussi un bouton « Liste », et `^liste$`
  // cliquait celle-là (la vue Liste, déjà active), donc rien ne s'ouvrait.
  await page.getByRole('button', { name: /^nouvelle liste manuelle$/i }).filter({ visible: true }).first().click();
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

// ═══════════════════════════════════════════════════════════════════
// Rôles personnalisés (mig. 219, `a6562733`) : `AssignRoleDialog` et
// `RoleEditorSheet`, déclarées « dette » par C-96 du 2026-10-15 au 2026-10-22.
//
// La démo sème « Nova Studio » et deux rôles : les deux surfaces s'atteignent
// SANS le project `supabase-stub`. Les deux déclencheurs sont ouverts AU
// CLAVIER (focus puis Entrée, y compris l'entrée de menu Radix) : un déclencheur
// qu'on n'atteindrait qu'à la souris rendrait la mesure du piège sans objet.
//
// ⚠️ `RoleEditorSheet` est AUSSI ouverte depuis `AssignRoleDialog` (« Créer un
// rôle » au bas du sélecteur), en portail, donc en FRÈRE DOM de son parent : le
// cas de la pile (`openStack`) que `EventModal` couvre pour ses frères. La garde
// qui suit mesure l'aller ET le retour du piège, pour la même raison qu'eux.
// ═══════════════════════════════════════════════════════════════════

/**
 * Arrive sur `/entreprise` RENDUE. L'URL change avant que la page (lazy) ne
 * remplace le tableau de bord : attendre le nom de l'organisation démo, comme
 * `demo-entreprise.spec.ts`, sinon la navigation des sections n'existe pas encore.
 */
async function ouvrirEntreprise(page: Page): Promise<void> {
  await navTo(page, /entreprise/i, /\/entreprise/);
  await expect(page.getByRole('heading', { name: /nova studio/i })).toBeVisible({ timeout: 30_000 });
}

/** Ouvre `AssignRoleDialog` au clavier sur le premier membre qui le propose. */
async function ouvrirAttribuerUnRole(page: Page): Promise<Locator> {
  await ouvrirEntreprise(page);
  await openOrgSection(page, /^membres/i);
  const triggers = page.getByRole('button', { name: /^actions pour /i }).filter({ visible: true });
  await expect(triggers.first()).toBeVisible({ timeout: 20_000 });
  const item = page.locator('[data-guide-id="member-assign-role"]');
  // Le menu d'un membre ne porte « Attribuer un rôle » que dans la portée de
  // l'appelant : on prend le premier qui le propose, au lieu de supposer lequel.
  const n = await triggers.count();
  for (let i = 0; i < n; i++) {
    const trigger = triggers.nth(i);
    await trigger.focus();
    // Marqué AVANT d'ouvrir : un menu Radix ouvert rend le reste de la page
    // `aria-hidden`, et `getByRole` ne retrouverait plus ce bouton ensuite.
    await markTrigger(page);
    await page.keyboard.press('Enter');
    const propose = await item.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true, () => false);
    if (propose) {
      await item.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: /^attribuer un rôle à /i });
      await expect(dialog).toBeVisible({ timeout: 20_000 });
      // Le squelette (C-40) n'est pas focalisable : mesurer le piège APRÈS la réponse.
      await expect(dialog.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 20_000 });
      return dialog;
    }
    await page.keyboard.press('Escape');
  }
  throw new Error('aucun membre de la démo ne propose « Attribuer un rôle »');
}

test('MESURE — AssignRoleDialog (attribuer un rôle personnalisé)', async ({ demoPage: page }) => {
  // Le déclencheur marqué est le bouton « Actions pour … » du membre : c'est
  // lui qu'on attend au retour (l'entrée de menu, elle, a disparu).
  const dialog = await ouvrirAttribuerUnRole(page);
  const report = await measureFocus(page, dialog, true);
  console.log('[a11y-kbd] AssignRoleDialog', JSON.stringify(report));
  assertModalTrapsFocus('AssignRoleDialog', report);
});

test('MESURE — RoleEditorSheet (créer un rôle personnalisé)', async ({ demoPage: page }) => {
  await ouvrirEntreprise(page);
  await openOrgSection(page, /^paramètres/i);
  const panneau = page.locator('[data-guide-id="settings-panel-roles"]').filter({ visible: true }).first();
  await expect(panneau).toBeVisible({ timeout: 20_000 });
  await panneau.focus();
  await page.keyboard.press('Enter');
  const trigger = page.locator('[data-guide-id="settings-roles-new"]').filter({ visible: true }).first();
  await expect(trigger).toBeVisible({ timeout: 20_000 });
  await trigger.focus();
  await markTrigger(page);
  await page.keyboard.press('Enter');

  const sheet = page.getByRole('dialog', { name: /^éditeur du rôle/i });
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  const report = await measureFocus(page, sheet, true);
  console.log('[a11y-kbd] RoleEditorSheet', JSON.stringify(report));
  assertModalTrapsFocus('RoleEditorSheet', report);
});

test('GARDE — AssignRoleDialog : RoleEditorSheet prend le piège, puis le rend', async ({ demoPage: page }) => {
  const parent = await ouvrirAttribuerUnRole(page);
  // « Créer un rôle » au bas du sélecteur, au clavier : Entrée ouvre le menu,
  // Fin va au dernier item, Entrée le choisit.
  await parent.locator('#assign-role-select').focus();
  await page.keyboard.press('Enter');
  const creer = page.getByRole('menuitem', { name: /^créer un rôle$/i });
  await expect(creer).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('End');
  await expect(creer).toBeFocused();
  await page.keyboard.press('Enter');

  const child = page.getByRole('dialog', { name: /^éditeur du rôle/i });
  await expect(child).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => focusInside(child), { timeout: 3_000 }).toBe(true);
  expect(await firstTabEscapee(page, child), 'RoleEditorSheet (enfant) : focus sorti').toBeNull();

  // Échap ne ferme QUE l'enfant : le parent reste, et reprend le piège.
  await page.keyboard.press('Escape');
  await expect(child).toBeHidden({ timeout: 5_000 });
  await expect(parent).toBeVisible();
  expect(await firstTabEscapee(page, parent), 'AssignRoleDialog (parent rendu) : focus sorti').toBeNull();
  expect(await focusInside(parent), 'AssignRoleDialog : le focus n est pas revenu au parent').toBe(true);

  await page.keyboard.press('Escape');
  await expect(parent).toBeHidden({ timeout: 5_000 });
});

// ═══════════════════════════════════════════════════════════════════
// AM-2 (2026-10-22) · dix surfaces de plus, les plus fréquentées
//
// Tâche d'équipe, OKR, agenda, tableau de bord, raccourcis globaux et page
// Tâches. Avant ce lot, elles étaient câblées sur `useModalA11y` et déclarées
// « dette » dans `src/keyboard-audit-coverage.guard.test.ts` : jamais
// parcourues à la touche Tab.
//
// Mêmes trois détecteurs que le témoin Radix (`assertModalTrapsFocus`).
// Le déclencheur est actionné AU CLAVIER partout où il existe un chemin
// clavier (Entrée sur un bouton focalisé, ou le raccourci global lui-même) :
// c'est ce chemin que la personne emprunte, et il fait partie de la mesure.
// Une seule exception, déclarée dans son cas : le créneau de l'agenda.
// ═══════════════════════════════════════════════════════════════════

/** Ouvre une surface en pressant Entrée sur son déclencheur focalisé. */
async function ouvrirAuClavier(page: Page, trigger: Locator): Promise<void> {
  await expect(trigger).toBeVisible({ timeout: 30_000 });
  await trigger.focus();
  await markTrigger(page);
  await page.keyboard.press('Enter');
}

/**
 * Ouvre une surface par un RACCOURCI GLOBAL (N, ?, Ctrl+K).
 *
 * ⚠️ Ces trois surfaces sont `lazy` : leur écouteur `keydown` n'existe qu'une
 * fois leur chunk arrivé. Une touche pressée avant tombe dans le vide, d'où la
 * reprise. ⚠️ Deux des trois raccourcis BASCULENT (`?`, Ctrl+K) : on ne
 * represse donc que si la surface n'est pas déjà affichée, sinon une reprise
 * tardive la refermerait.
 */
async function ouvrirParRaccourci(page: Page, touche: string, dialog: Locator): Promise<void> {
  // Le raccourci est ignoré quand le focus est dans un champ : on part du corps.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(async () => {
    if (!(await dialog.isVisible())) await page.keyboard.press(touche);
    await expect(dialog).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

async function mesurerSurface(page: Page, surface: string, dialog: Locator): Promise<void> {
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  const report = await measureFocus(page, dialog, true);
  console.log(`[a11y-kbd] ${surface}`, JSON.stringify(report));
  assertModalTrapsFocus(surface, report);
}

test('MESURE · TeamTaskModal (« Nouvelle tâche » d\'équipe)', async ({ demoPage: page }) => {
  await navTo(page, /entreprise/i, /\/entreprise/);
  await openOrgSection(page, /^tâches/i);
  await page.waitForURL(/\/entreprise\/tasks/);
  await ouvrirAuClavier(page, page.getByRole('button', { name: /nouvelle tâche/i }).filter({ visible: true }).first());
  await mesurerSurface(page, 'TeamTaskModal', page.getByRole('dialog', { name: /nouvelle tâche d'équipe/i }));
});

test('MESURE · CompletedOKRsModal (« OKR terminés »)', async ({ demoPage: page }) => {
  await navTo(page, /okr/i, /\/okr/);
  await ouvrirAuClavier(
    page,
    page.getByRole('button', { name: /voir la liste des okr terminés/i }).filter({ visible: true }).first(),
  );
  await mesurerSurface(page, 'CompletedOKRsModal', page.getByRole('dialog', { name: /^okr terminés$/i }));
});

test('MESURE · DeleteObjectiveConfirm (suppression d\'un objectif)', async ({ demoPage: page }) => {
  await navTo(page, /okr/i, /\/okr/);
  await ouvrirAuClavier(
    page,
    page.getByRole('button', { name: /^supprimer l'objectif$/i }).filter({ visible: true }).first(),
  );
  await mesurerSurface(page, 'DeleteObjectiveConfirm', page.getByRole('dialog', { name: /^supprimer l'objectif$/i }));
});

test('MESURE · QuickEventCard (création rapide sur un créneau)', async ({ demoPage: page }) => {
  // ⚠️ SEUL déclencheur à la souris de ce lot, et c'est assumé : un créneau
  // FullCalendar n'est pas un arrêt de tabulation (C-54 a tranché que le
  // chemin clavier de l'agenda est « Nouveau », mesuré par EventModal). On
  // mesure ici la SURFACE, qu'un geste de pointeur ouvre, une fois ouverte.
  await page.setViewportSize({ width: 1280, height: 900 });
  await navTo(page, /agenda/i, /\/agenda/);
  const colonne = page.locator('.fc-timegrid-col[data-date]').first();
  await expect(colonne).toBeVisible({ timeout: 30_000 });
  // 06:00 : avant les événements du jeu de démo, pour viser un créneau VIDE
  // (un glisser sur un événement le déplacerait au lieu de sélectionner).
  const sixHeures = page.locator('td.fc-timegrid-slot-lane[data-time="06:00:00"]');
  const creneau = (await sixHeures.count()) > 0 ? sixHeures.first() : page.locator('td.fc-timegrid-slot-lane').first();
  await creneau.scrollIntoViewIfNeeded();
  const col = await colonne.boundingBox();
  const lane = await creneau.boundingBox();
  if (!col || !lane) throw new Error('grille horaire sans géométrie');
  const x = col.x + col.width / 2;
  const y = lane.y + lane.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + lane.height * 2, { steps: 5 });
  await page.mouse.up();
  await mesurerSurface(page, 'QuickEventCard', page.getByRole('dialog', { name: /création rapide d'un événement/i }));
});

test('MESURE · TodayTasks (confirmation de suppression, tableau de bord)', async ({ demoPage: page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // Les actions d'une ligne sont révélées AU FOCUS (`focus-within`) : Tab les
  // atteint, et c'est ce chemin qu'on emprunte.
  await ouvrirAuClavier(page, page.getByRole('button', { name: /^supprimer : /i }).first());
  await mesurerSurface(page, 'TodayTasks', page.getByRole('dialog', { name: /^supprimer la tâche$/i }));
});

test('MESURE · QuickAddBar (touche N)', async ({ demoPage: page }) => {
  await ouvrirParRaccourci(page, 'n', page.getByRole('dialog', { name: /^créer une tâche rapidement$/i }));
  await mesurerSurface(page, 'QuickAddBar', page.getByRole('dialog', { name: /^créer une tâche rapidement$/i }));
});

test('MESURE · CommandPalette (Ctrl+K)', async ({ demoPage: page }) => {
  const palette = page.getByRole('dialog', { name: /rechercher une tâche, une page, une commande/i });
  await ouvrirParRaccourci(page, 'Control+k', palette);
  await mesurerSurface(page, 'CommandPalette', palette);
});

test('MESURE · ShortcutsHelp (touche ?)', async ({ demoPage: page }) => {
  const aide = page.getByRole('dialog', { name: /^raccourcis clavier$/i });
  await ouvrirParRaccourci(page, '?', aide);
  await mesurerSurface(page, 'ShortcutsHelp', aide);
});

test('MESURE · MoveTaskSheet (« Déplacer vers… », vue Tableau)', async ({ demoPage: page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openTasksPage(page);
  const vue = page.getByRole('group', { name: /^affichage$/i }).filter({ visible: true }).first();
  await vue.getByRole('button', { name: /tableau/i }).press('Enter');
  // Le bouton est révélé au survol ET au focus (`group-focus-within`).
  await ouvrirAuClavier(page, page.getByRole('button', { name: /^déplacer « /i }).first());
  await mesurerSurface(page, 'MoveTaskSheet', page.getByRole('dialog', { name: /^déplacer « .+ » vers$/i }));
});

test('MESURE · CreateListSheet (« Nouvelle liste », mobile)', async ({ demoPage: page }) => {
  // ⚠️ Viewport MOBILE : sur desktop la création de liste est INLINE (cf.
  // ShareListSheet plus haut), et le bouton « + » qui ouvre cette feuille est
  // `sm:hidden`.
  await passerEnMobile(page);
  await openTasksPage(page);
  await ouvrirAuClavier(page, page.getByRole('button', { name: /^nouvelle liste$/i }).filter({ visible: true }).first());
  await mesurerSurface(page, 'CreateListSheet', page.getByRole('dialog', { name: /^nouvelle liste$/i }));
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
  // 🔴 Attendre un élément DE LA PAGE, pas un délai : la page Tâches est lazy, et
  // sous WebKit son rendu arrivait APRÈS le délai fixe ci-dessous. Les sondes
  // qui suivent (`isVisible`, qui n'attend pas) lisaient alors un `<main>` vide
  // et concluaient « mode sélection introuvable » (échec constant le 2026-10-16,
  // alors que le bouton était là quelques secondes plus tard).
  await expect(page.getByRole('button', { name: /^créer une (nouvelle )?tâche$/i }).first())
    .toBeVisible({ timeout: 30_000 });
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
  const tabSurLesLiens = await tabAtteintLesLiens(page);
  console.log("[a11y-kbd] C-118 Tab s'arrête sur les liens :", tabSurLesLiens);
  let first;
  if (tabSurLesLiens) {
    await page.keyboard.press('Tab');
    first = await focusedIdentity(page);
  } else {
    // Écart Safari n° 1 (cf. plus haut) : même propriété, lue sans Tab.
    first = await premierArretDuDocument(page);
  }
  expect(first.tag, `premier arrêt de tabulation: ${JSON.stringify(first)}`).toBe('a');
  expect(first.name).toMatch(/contenu principal/i);

  // 2. Entrée pose le focus SUR le <main>, pas seulement le défilement.
  await page.keyboard.press('Enter');
  expect((await focusedIdentity(page)).id).toBe('main-content');

  // 3. Le premier arrêt À L'INTÉRIEUR du main est le second lien d'évitement,
  //    celui qui saute le panneau des tâches.
  let second;
  if (tabSurLesLiens) {
    await page.keyboard.press('Tab');
    second = await focusedIdentity(page);
  } else {
    second = await premierArretDuDocument(page, 'main-content');
  }
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
