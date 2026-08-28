// ═══════════════════════════════════════════════════════════════════
// Feuilles et modals sous `prefers-reduced-motion: reduce`
//
// POURQUOI CE FICHIER EXISTE
//
// `App.tsx` monte `<MotionConfig reducedMotion="user">`. Chez un utilisateur
// en mouvement réduit, Framer ne joue pas les animations de transform et la
// valeur `initial` RESTE APPLIQUÉE : un `initial={{ y: '100%' }}` sur une
// feuille la laisse 100 % sous l'écran, définitivement.
//
// Ce défaut a été mesuré le 2026-08-24 sur `MobileMoreSheet` (0 px visible,
// donc la navigation mobile sans issue), puis corrigé par `useSheetMotion()`.
// Une garde STATIQUE existe depuis (`src/design-system.guard.test.ts`) : elle
// interdit d'écrire un nouveau `y: '100%'` à la main, et gèle les fichiers
// historiques dans `KNOWN_HANDROLLED_SHEETS`.
//
// ⚠️ MAIS UNE GARDE STATIQUE NE MESURE RIEN. Elle compte des chaînes de
// caractères dans des fichiers ; elle ne dit pas si une feuille s'OUVRE. La
// note « 0 feuille cassée » de docs/MOBILE.md reposait sur une présomption :
// « un `initial` qui contient aussi une clé non-transform se résout ». Cette
// phrase n'avait été vérifiée que sur UNE feuille, et le 2026-08-27 le
// correctif de `LoginModal` (commit a1debe3) a affirmé le contraire sur une
// feuille de la MÊME forme, sans mesure non plus. Deux affirmations opposées,
// zéro mesure : c'est ce trou que ce fichier ferme.
//
// CE QU'IL MESURE, ET POURQUOI C'EST UNE MESURE
//
// Playwright émule réellement `prefers-reduced-motion: reduce` (option de
// contexte, pas un `matchMedia` bricolé), rend la page dans un navigateur qui
// composite, puis on lit `getComputedStyle` et la boîte réelle.
//
// 🔴 PIÈGE, ET IL A DÉJÀ FAUSSÉ UNE MESURE LE 2026-08-27. Dans un onglet
// caché (`document.visibilityState === 'hidden'`), `requestAnimationFrame` ne
// tourne pas : TOUT reste sur `initial`, transform ET opacité, y compris les
// feuilles saines. Une première mesure faite dans le panneau navigateur non
// affiché a ainsi conclu que `HabitModal` était cassée. Elle ne l'était pas :
// c'était l'onglet qui ne peignait pas. D'où les deux protections ci-dessous :
//   1. le test refuse de tourner si la page se déclare `hidden` ;
//   2. un TÉMOIN POSITIF (`LoginModal`, déjà migrée sur `useSheetMotion`) doit
//      être visible dans le même run. S'il ne l'est pas, ce n'est pas une
//      régression produit, c'est le harnais qui ment, et le test le dit.
//
// Sans témoin, un harnais qui gèle tout produit un rapport « tout est cassé »
// parfaitement convaincant et parfaitement faux.
// ═══════════════════════════════════════════════════════════════════
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

// Émulation réelle du réglage système, pour tout ce fichier.
//
// ⚠️ `test.use({ reducedMotion })` seul ne suffit PAS ici : mesuré le
// 2026-08-27, `matchMedia('(prefers-reduced-motion: reduce)')` répondait
// encore `false` dans les trois tests. On émule donc explicitement sur la
// page, et `assertPageIsPainting` le VÉRIFIE avant chaque mesure — un test
// qui croit émuler un réglage sans le contrôler ne teste rien.
test.use({ reducedMotion: 'reduce' });

interface SheetMeasure {
  opacity: number;
  height: number;
  visibleHeight: number;
  visibleRatio: number;
  transform: string;
}

/** Lit l'état PEINT de la feuille du dessus : opacité calculée et hauteur
 *  réellement dans le viewport.
 *
 *  On ne se fie pas à `toBeVisible()` de Playwright, qui considère visible un
 *  élément à `opacity: 0` ou entièrement hors écran — c'est-à-dire exactement
 *  les deux symptômes qu'on cherche.
 *
 *  ⚠️ AUCUN SÉLECTEUR DE CLASSE. Une première version visait
 *  `rounded-t-[28px]` : elle ne trouvait pas `CompletedOKRsModal`, qui arrondit
 *  en `rounded-t-2xl`. Un test de design system qui dépend de la classe
 *  utilitaire choisie par chaque feuille ne mesure que la mode du jour. On
 *  cible donc la STRUCTURE, commune à toutes : un voile `position: fixed`
 *  couvrant l'écran, et dedans le panneau, plus grand enfant. */
async function measureTopSheet(page: Page): Promise<SheetMeasure> {
  const measured = await page.evaluate(() => {
    const overlays = [...document.querySelectorAll<HTMLElement>('div')].filter((el) => {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' || cs.display === 'none') return false;
      const r = el.getBoundingClientRect();
      return r.width >= window.innerWidth * 0.95 && r.height >= window.innerHeight * 0.95;
    });
    if (overlays.length === 0) return null;

    // Le dernier en ordre DOM est le plus récemment monté, donc celui du dessus.
    const overlay = overlays[overlays.length - 1];
    const children = [...overlay.children].filter(
      (c): c is HTMLElement => c instanceof HTMLElement,
    );
    if (children.length === 0) return null;

    const panel = children.reduce((biggest, c) => {
      const a = c.getBoundingClientRect();
      const b = biggest.getBoundingClientRect();
      return a.width * a.height > b.width * b.height ? c : biggest;
    });

    const cs = getComputedStyle(panel);
    const r = panel.getBoundingClientRect();
    const visibleHeight = Math.max(
      0,
      Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0),
    );
    return {
      opacity: Number(cs.opacity),
      height: r.height,
      visibleHeight,
      visibleRatio: r.height > 0 ? visibleHeight / r.height : 0,
      transform: cs.transform,
    };
  });

  if (!measured) throw new Error('Aucun voile plein écran trouvé : la feuille ne s’est pas ouverte.');
  return measured;
}

/** Le harnais peint-il vraiment ? Cf. le piège de l'onglet caché ci-dessus. */
async function assertPageIsPainting(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const state = await page.evaluate(() => ({
    visibility: document.visibilityState,
    reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }));
  expect(
    state.visibility,
    'Onglet caché : rAF ne tourne pas, tout resterait sur `initial` et la ' +
      'mesure ne vaudrait rien (cf. en-tête de ce fichier).',
  ).toBe('visible');
  expect(
    state.reduce,
    "L'émulation `reducedMotion: 'reduce'` n'est pas active : ce fichier ne " +
      'testerait alors rien du tout.',
  ).toBe(true);
}

/** Une feuille ouverte doit être VUE : opaque, et majoritairement à l'écran. */
function expectSheetIsUsable(m: SheetMeasure, label: string): void {
  expect(
    m.opacity,
    `${label} : opacité calculée ${m.opacity} sous mouvement réduit. ` +
      "L'animation d'entrée n'a pas joué et `initial` est resté appliqué. " +
      'Passer par `useSheetMotion()` (src/components/mobile/mobile-motion.ts).',
  ).toBeGreaterThan(0.9);

  expect(
    m.visibleRatio,
    `${label} : ${Math.round(m.visibleHeight)} px visibles sur ` +
      `${Math.round(m.height)} px de hauteur (transform ${m.transform}). ` +
      'La feuille est hors écran : la position finale doit venir du CSS, ' +
      "l'animation ne portant que sur l'opacité.",
  ).toBeGreaterThan(0.9);
}

test.describe('mouvement réduit — les feuilles s’ouvrent réellement', () => {
  test('TÉMOIN : une feuille migrée sur useSheetMotion est visible', async ({ page }) => {
    // `LoginModal` est le témoin POSITIF du harnais : migrée le 2026-08-27,
    // elle DOIT passer. Un échec ici invalide tous les autres résultats du
    // fichier — il signifie que rien ne s'anime, pas que le produit est cassé.
    await page.goto('/');
    await page.evaluate(() => {
      try {
        localStorage.setItem('cosmo_cookie_consent', 'refused');
      } catch {
        /* ignore */
      }
    });
    await page.goto('/');
    await assertPageIsPainting(page);

    // ⚠️ C'est un `<a href="/login">` neutralisé par `preventDefault`, pas un
    // bouton (LandingPage) : `getByRole('button')` ne le trouve pas.
    await page.getByRole('link', { name: /se connecter/i }).first().click();

    // Laisser une fenêtre d'animation généreuse : on veut l'état STABLE, pas
    // la première frame. Sous mouvement réduit il n'y a de toute façon rien à
    // attendre, c'est justement le point.
    await page.waitForTimeout(800);

    expectSheetIsUsable(await measureTopSheet(page), 'LoginModal (témoin)');
  });

  test('HabitModal s’ouvre visible', async ({ demoPage: page }) => {
    await assertPageIsPainting(page);
    await page.goto('/habits');

    await page.getByRole('button', { name: /^nouvelle$/i }).first().click();

    await page.waitForTimeout(800);

    expectSheetIsUsable(await measureTopSheet(page), 'HabitModal');
  });

  test('CompletedOKRsModal s’ouvre visible', async ({ demoPage: page }) => {
    await assertPageIsPainting(page);
    await page.goto('/okr');

    const create = page
      .getByRole('button', { name: /voir la liste des OKR terminés/i })
      .first();
    await create.waitFor({ state: 'visible', timeout: 15_000 });
    await create.click();

    await page.waitForTimeout(800);

    expectSheetIsUsable(await measureTopSheet(page), 'CompletedOKRsModal');
  });
});
