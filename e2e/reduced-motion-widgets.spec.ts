// ═══════════════════════════════════════════════════════════════════
// Widgets du tableau de bord sous `prefers-reduced-motion: reduce`
//
// POURQUOI CE FICHIER EXISTE
//
// `ApercuWidgetGrid` (Aperçu entreprise ET tableau de bord perso, même
// composant) a porté du 2026-10-19 au 2026-10-22 un
// `<MotionConfig reducedMotion="never">` : en mode édition, les blocs
// vibraient EN BOUCLE et glissaient en ressort même quand le système demande
// moins d'animation (WCAG 2.3.3). Noté « arbitrage écrit, à revoir » par
// l'audit a11y du 2026-10-20, retiré le 2026-10-22.
//
// CE QU'IL MESURE
//
// Sous mouvement réduit réellement émulé, on lit `getComputedStyle().transform`
// à CHAQUE frame pendant et après un déplacement :
//   1. en édition, aucun bloc ne vibre (transform du bloc intérieur = aucun) ;
//   2. un déplacement au clavier (« Reculer … ») met le bloc à sa place finale
//      SANS une seule frame de transform (ni ressort `layout`, ni résidu) ;
//   3. un glisser à la souris réordonne, puis le bloc relâché est à sa place,
//      sans transform résiduel. PENDANT le glisser, en revanche, le voisin qui
//      cède sa place DOIT glisser (FLIP natif, décision d'Axel du 2026-10-29 :
//      sans lui, les blocs se téléportaient chez qui a coupé les animations
//      Windows). C'est le seul mouvement admis sous mouvement réduit, et il
//      est déclenché par le geste de la personne.
// Le contrôle positif est l'ordre : le déplacement doit AVOIR EU LIEU, sinon
// « aucun transform » ne dirait rien.
//
// Contrôle négatif joué le 2026-10-22 : `reducedMotion="never"` remis en
// place, les cas 1 et 2 échouent (rotation de la vibration, puis frames de
// translation du ressort `layout`).
// ═══════════════════════════════════════════════════════════════════
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });

const NEUTRE = new Set(['none', 'matrix(1, 0, 0, 1, 0, 0)']);

async function preparer(page: Page): Promise<void> {
  // Même piège que `reduced-motion-sheets` : `test.use` seul ne suffisait pas.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const etat = await page.evaluate(() => ({
    visibility: document.visibilityState,
    reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }));
  expect(etat.visibility, 'Onglet caché : rAF ne tourne pas, la mesure ne vaudrait rien.').toBe('visible');
  expect(etat.reduce, "L'émulation du mouvement réduit n'est pas active.").toBe(true);

  await page.goto('/dashboard');
  await page.getByTestId('apercu-edit').click();
  await expect(page.getByRole('button', { name: /^Terminé$/ })).toBeVisible();
}

/** Ordre des widgets dans la grille. */
const ordre = (page: Page) =>
  page.locator('.apercu-widget-grid > li[data-widget]').evaluateAll((els) => els.map((e) => e.getAttribute('data-widget')));

/** Lance un échantillonneur : chaque frame, le transform de chaque bloc. */
async function demarrerEchantillonnage(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __echantillons: string[]; __stop: boolean };
    w.__echantillons = [];
    w.__stop = false;
    const tick = () => {
      if (w.__stop) return;
      document.querySelectorAll<HTMLElement>('.apercu-widget-grid > li[data-widget]').forEach((li) => {
        const t = getComputedStyle(li).transform;
        const inner = li.firstElementChild instanceof HTMLElement ? getComputedStyle(li.firstElementChild).transform : 'none';
        w.__echantillons.push(`${li.dataset.widget}|${t}|${inner}`);
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function arreterEchantillonnage(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __echantillons: string[]; __stop: boolean };
    w.__stop = true;
    return w.__echantillons;
  });
}

function hors(echantillons: string[]): string[] {
  return echantillons.filter((e) => {
    const [, li, inner] = e.split('|');
    return !NEUTRE.has(li) || !NEUTRE.has(inner);
  });
}

test.describe('mouvement réduit · widgets du tableau de bord', () => {
  // Les widgets n'existent qu'au bureau (`DashboardPage` : « le mobile n'a pas
  // de widgets ») ; un appareil mobile émulé n'a rien à mesurer ici.
  test.skip(({ isMobile }) => isMobile, 'Pas de widgets sur mobile.');

  test('édition + déplacement au clavier : aucune frame de transform', async ({ demoPage: page }) => {
    await preparer(page);
    const avant = await ordre(page);
    expect(avant.length, 'Il faut au moins deux widgets pour déplacer.').toBeGreaterThanOrEqual(2);

    await demarrerEchantillonnage(page);
    // Laisser vivre l'édition : la vibration tournerait ici.
    await page.waitForTimeout(600);

    const bouton = page.getByRole('button', { name: /^Reculer / }).first();
    await bouton.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    const echantillons = await arreterEchantillonnage(page);

    const apres = await ordre(page);
    expect(apres, 'Le déplacement au clavier n’a pas eu lieu.').toEqual([avant[1], avant[0], ...avant.slice(2)]);
    expect(echantillons.length, 'Aucune frame mesurée.').toBeGreaterThan(20);
    const mobiles = hors(echantillons);
    expect(
      mobiles.slice(0, 5),
      `${mobiles.length} mesures sur ${echantillons.length} portent un transform sous mouvement réduit ` +
        '(vibration ou ressort `layout`). Un `MotionConfig reducedMotion="never"` est-il revenu dans ApercuWidgetGrid ?',
    ).toEqual([]);
  });

  test('glisser à la souris : réordonne, et le bloc relâché est à sa place', async ({ demoPage: page }) => {
    await preparer(page);
    const avant = await ordre(page);
    const items = page.locator('.apercu-widget-grid > li[data-widget]');
    const a = await items.nth(0).boundingBox();
    const b = await items.nth(1).boundingBox();
    if (!a || !b) throw new Error('Widgets sans boîte.');

    // Saisir le bloc loin de ses contrôles (croix en haut à gauche, flèches en haut à droite).
    const sx = a.x + a.width / 2;
    const sy = a.y + a.height * 0.6;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await demarrerEchantillonnage(page);
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height * 0.6;
    for (let i = 1; i <= 15; i++) {
      await page.mouse.move(sx + ((cx - sx) * i) / 15, sy + ((cy - sy) * i) / 15);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(400);
    const pendant = await arreterEchantillonnage(page);
    await page.mouse.up();

    // Témoin positif : le voisin qui cède sa place a GLISSÉ (frames de
    // translation sur un autre bloc que celui qu'on tient).
    const voisinGlisse = pendant.some((e) => {
      const [id, li] = e.split('|');
      return id !== avant[0] && !NEUTRE.has(li);
    });
    expect(voisinGlisse, 'Le voisin s’est téléporté : aucun glissement mesuré pendant le glisser.').toBe(true);

    // Laisser finir le glissement, puis rien ne doit plus bouger.
    await page.waitForTimeout(300);
    await demarrerEchantillonnage(page);
    await page.waitForTimeout(500);
    const echantillons = await arreterEchantillonnage(page);

    const apres = await ordre(page);
    expect(apres, 'Le glisser n’a pas réordonné les widgets.').not.toEqual(avant);
    expect(apres[1], 'Le bloc glissé n’est pas à la place visée.').toBe(avant[0]);
    const mobiles = hors(echantillons);
    expect(
      mobiles.slice(0, 5),
      `${mobiles.length} mesures sur ${echantillons.length} portent un transform après le relâcher : ` +
        'la position finale dépend d’une animation.',
    ).toEqual([]);
  });
});
