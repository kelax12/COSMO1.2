import { test, expect, navTo, TASK_TOGGLE_UNCHECKED } from './fixtures';

/**
 * Interactions tactiles mobile (a-faire.md #4) — swipe, long-press, bottom-sheet.
 *
 * Ces tests ne tournent que sur le project mobile (viewport < 768 px) : la
 * TaskCard swipeable est `md:hidden`, le desktop utilise la <table>.
 *
 * Les gestes passent par `page.mouse` (PointerEvents réels dispatchés par le
 * navigateur) — contrairement aux events synthétiques `preview_eval` qui ne
 * mettaient pas à jour le `useMotionValue` de Framer Motion (cf. a-faire.md).
 *
 * Le point de départ du geste est pris à DROITE de la checkbox (sur le titre,
 * zone sans bouton) pour ne pas déclencher le onClick de la checkbox au
 * pointerup.
 */

/** Point de départ sûr pour un geste sur la 1ʳᵉ card non complétée. */
async function firstCardGestureStart(page: import('@playwright/test').Page) {
  const list = page.locator('[data-tutorial-id="tasks-list"]');
  await expect(list).toBeVisible({ timeout: 15_000 });
  // TASK_TOGGLE_UNCHECKED : la TaskCard mobile est un <button aria-pressed>,
  // pas une checkbox ARIA (cf. fixtures.ts).
  const unchecked = list.locator(TASK_TOGGLE_UNCHECKED).filter({ visible: true });
  const target = unchecked.first();
  await expect(target).toBeVisible({ timeout: 10_000 });

  // ⚠️ `filter({ visible: true })` ne veut PAS dire « dans le viewport » : la
  // 1ʳᵉ tâche non complétée se trouvait à y≈1031 dans un viewport de 664 px
  // (filtres + cartes de synthèse au-dessus). Or `page.mouse` ne scrolle pas,
  // contrairement à `locator.click()` — le geste partait donc hors écran et
  // n'atteignait aucun élément (`document.elementFromPoint()` → null), ce qui
  // faisait échouer swipe ET long-press sans erreur explicite.
  await target.scrollIntoViewIfNeeded();

  // 🔴 POSITION STABLE AVANT DE MESURER (2026-10-22). Les deux correctifs de
  // frame n'ont pas suffi : la PR #94 a rejoué ce cas ×5 sans retry, et le
  // PREMIER passage du run (page `/tasks` froide, 42,9 s contre 4 s pour les
  // autres) a encore échoué, compteur inchangé. Une boîte lue pendant que
  // l'écran se met en place (bandeaux et filtres paresseux au-dessus de la
  // liste) fait partir le geste à côté de la carte. On attend donc deux
  // lectures identiques à 250 ms d'écart.
  let box = await target.boundingBox();
  await expect
    .poll(async () => {
      const next = await target.boundingBox();
      const stable = !!box && !!next && next.x === box.x && next.y === box.y;
      box = next;
      return stable;
    }, { timeout: 15_000, intervals: [250] })
    .toBe(true);
  if (!box) throw new Error('case de complétion sans bounding box');
  // ~90 px à droite de la case = milieu du titre, dans la card draggable.
  const x = box.x + box.width + 90;
  const y = box.y + box.height / 2;

  // Et le point de départ doit tomber SUR la carte visée, vérifié dans la
  // page : un geste parti à côté échouait jusqu'ici en silence (« compteur
  // inchangé »), sans dire ce qu'il avait touché.
  const card = target.locator('xpath=ancestor::*[@data-testid="task-card"][1]');
  const pointSurLaCarte = await card.evaluate(
    (el, [px, py]) => el.contains(document.elementFromPoint(px, py)),
    [x, y] as const,
  );
  expect(pointSurLaCarte, `le geste part de (${x}, ${y}), hors de la carte visée`).toBe(true);
  return { x, y, unchecked };
}

// Skip au niveau du describe, PAS dans le corps de chaque test : un
// `test.skip()` dans le corps du test s'évalue APRÈS que les fixtures
// destructurées dans les paramètres (ici `demoPage`) aient déjà tourné — la
// condition sur `page.viewportSize()` ne peut de toute façon être lue qu'une
// fois la page créée. Résultat sur chromium : les 3 tests payaient le login
// démo complet (jusqu'à 120 s sous charge) pour finalement skip.
//
// ⚠️ Piège vérifié : `test.skip()` appelé directement dans le corps d'un
// `describe` (pas dans un test/hook) ne reçoit qu'UN seul argument — les
// fixtures. `testInfo` y est `undefined` (« Cannot read properties of
// undefined (reading 'project') », confirmé en pratique — a fait planter TOUT
// le fichier : 2 tests en erreur + 4 « did not run »). `browserName` est un
// fixture standard disponible à ce stade sans coût (config, pas de page) ; le
// project chromium utilise le moteur chromium et mobile-safari le moteur
// webkit, donc l'équivalence tient pour cette config à 2 projects.
test.describe('gestes tactiles (mobile uniquement)', () => {
  test.skip(({ browserName }) => browserName === 'chromium',
    'gestes tactiles — viewport mobile uniquement (project mobile-safari)');

test('mobile : swipe droit sur une TaskCard la complète', async ({ demoPage: page }) => {
  await navTo(page, /to ?do|tâches|tasks/i, /\/tasks/);
  const { x, y, unchecked } = await firstCardGestureStart(page);
  const before = await unchecked.count();
  expect(before).toBeGreaterThan(0);

  // Swipe droit > 80 px (seuil onDragEnd) — rapide (< 500 ms) pour ne pas
  // déclencher le long-press.
  //
  // 🔴 LE GESTE DOIT DURER AU MOINS UNE FRAME, et c'était la cause des
  // instables WebKit (2026-10-09, 10-20, 10-21 : compteur inchangé, même après
  // un second glissé). Framer Motion (`PanSession`, v12) ne reconnaît le
  // glissé qu'à la frame SUIVANT le mouvement (`frame.update(updatePoint)`), et
  // `pointerup` annule cette frame : si le moteur traite `down`, les 12
  // `move` et `up` sans rendre une seule frame, ce qui arrive sous WebKit
  // chargé en CI, `onDragEnd` n'est jamais appelé et le geste compte pour un
  // simple appui. Un doigt reste au moins une frame sur l'écran : on attend
  // donc deux frames rendues après le premier mouvement, puis avant de lever.
  // ❌ Ne pas remettre de « seconde tentative » : la cause est traitée, et une
  // carte qui ne se complète pas doit échouer du premier coup.
  const deuxFrames = () =>
    page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(x + (i * 130) / 6, y, { steps: 2 });
    if (i === 1) await deuxFrames();
  }
  await deuxFrames();
  await page.mouse.up();

  // La complétion passe par isExiting (300 ms) puis la mutation — on poll.
  await expect.poll(() => unchecked.count(), { timeout: 7_000 }).toBe(before - 1);
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
});

test('mobile : long-press sur une TaskCard révèle la rangée d\'actions', async ({ demoPage: page }) => {
  await navTo(page, /to ?do|tâches|tasks/i, /\/tasks/);
  const { x, y } = await firstCardGestureStart(page);

  // Pointer down maintenu 650 ms sans mouvement (seuil long-press = 500 ms).
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();

  // La rangée d'actions expose « Supprimer la tâche » (fallback visible du swipe).
  await expect(
    page.getByRole('button', { name: 'Supprimer la tâche' }).filter({ visible: true }).first()
  ).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
});

test('mobile : le bottom-sheet « Plus » s\'ouvre et se ferme au tap backdrop', async ({ demoPage: page }) => {
  const vw = page.viewportSize();
  await page.getByRole('button', { name: /plus d'options/i }).click();
  const logout = page.getByRole('button', { name: /déconnexion/i });
  await expect(logout).toBeVisible({ timeout: 5_000 });

  const sheet = page.locator('[data-mobile-more-sheet]');
  await expect(sheet).toBeVisible({ timeout: 5_000 });

  // Tap sur le backdrop, entre le bas des toasts et le haut du sheet.
  //
  // ⚠️ Le point fixe (width/2, 80) tombait sur le TOASTER Sonner : le rappel
  // « N en retard — Touchez pour voir vos tâches » s'affiche ~3 s après
  // l'arrivée sur le dashboard, occupe y≈16→90 sur toute la largeur, porte un
  // z-index de 999999999 et NE se ferme PAS tout seul (toast à action). Le tap
  // atterrissait donc sur lui — ni la souris ni `touchscreen.tap()` ne
  // fermaient le sheet. On calcule maintenant la zone libre dynamiquement.
  const sheetBox = await sheet.boundingBox();
  if (!sheetBox) throw new Error('sheet sans bounding box');
  const toastBottom = await page.evaluate(() =>
    [...document.querySelectorAll('li[data-sonner-toast]')]
      .reduce((max, t) => Math.max(max, t.getBoundingClientRect().bottom), 0)
  );
  const y = (toastBottom + sheetBox.y) / 2;
  expect(y, 'aucune bande libre entre les toasts et le sheet').toBeGreaterThan(toastBottom);

  await page.mouse.click(vw!.width / 2, y);
  await expect(logout).toBeHidden({ timeout: 5_000 });
});

}); // fin test.describe('gestes tactiles (mobile uniquement)')
