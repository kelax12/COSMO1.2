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
  const box = await target.boundingBox();
  if (!box) throw new Error('case de complétion sans bounding box');
  // ~90 px à droite de la case = milieu du titre, dans la card draggable.
  return { x: box.x + box.width + 90, y: box.y + box.height / 2, unchecked };
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
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(x + (i * 130) / 6, y, { steps: 2 });
  }
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
