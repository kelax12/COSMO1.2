import { test, expect, navTo } from './fixtures';

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
  const unchecked = list.locator('[role="checkbox"][aria-checked="false"]').filter({ visible: true });
  await expect(unchecked.first()).toBeVisible({ timeout: 10_000 });
  const box = await unchecked.first().boundingBox();
  if (!box) throw new Error('checkbox sans bounding box');
  // ~90 px à droite de la checkbox = milieu du titre, dans la card draggable.
  return { x: box.x + box.width + 90, y: box.y + box.height / 2, unchecked };
}

test('mobile : swipe droit sur une TaskCard la complète', async ({ demoPage: page }) => {
  const vw = page.viewportSize();
  test.skip(!vw || vw.width >= 768, 'gestes tactiles — viewport mobile uniquement');

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
  const vw = page.viewportSize();
  test.skip(!vw || vw.width >= 768, 'gestes tactiles — viewport mobile uniquement');

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
  test.skip(!vw || vw.width >= 768, 'gestes tactiles — viewport mobile uniquement');

  await page.getByRole('button', { name: /plus d'options/i }).click();
  const logout = page.getByRole('button', { name: /déconnexion/i });
  await expect(logout).toBeVisible({ timeout: 5_000 });

  // Tap sur le backdrop (haut de l'écran, hors du sheet ancré en bas).
  await page.mouse.click(vw!.width / 2, 80);
  await expect(logout).toBeHidden({ timeout: 5_000 });
});
