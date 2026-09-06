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
//
// ═══ MESURE DU 2026-09-04 (C-07) : CE QUE CE FICHIER PEUT, ET NE PEUT PAS ═══
//
// Les 16 feuilles ecrites a la main sont passees sur `useSheetMotion()` et le
// cliquet statique est a ZERO. En le faisant, une chose a ete mesuree qu'il
// faut ecrire ici, parce qu'elle contredit la justification de ce dossier.
//
// 🔴 SUR framer-motion 12.43.0, LA FORME DU 2026-08-24 NE SE REPRODUIT PLUS.
// `MobileMoreSheet` a ete REMISE dans sa forme cassee d'origine, un `initial`
// avec un `y` SEUL plus `animate={{ y: 0 }}`. Verifie que Vite servait bien la
// mutation (`initial: { y: "100%" }` dans le module servi, pas seulement dans
// le fichier), sous `reducedMotion: 'reduce'` reellement emule, voile temoin
// allume : la feuille s'ouvre ENTIEREMENT VISIBLE. Le test passe.
// Explication dans le code de la dependance (`motion-dom`, animateTarget) : en
// mouvement reduit, une cle de transform recoit `{ type: false }`, c'est-a-dire
// une transition INSTANTANEE vers la cible. Elle saute donc a `y: 0` au lieu de
// rester sur `initial`.
//
// ⚠️ CONSEQUENCE DIRECTE : ce test ne peut PAS echouer a cause du defaut de
// 2026-08-24 tant que cette version de framer-motion est installee. L'appeler
// « non-regression » sans cette phrase serait exactement le defaut catalogue le
// 2026-09-03, une garde qui repond sans mesurer.
//
// ✅ CE QU'IL MESURE VRAIMENT, ET C'EST PROUVE. Controle negatif joue le
// 2026-09-04 : la meme feuille privee de son `animate` rend
// « 0 px visibles sur 582 px de hauteur, transform matrix(1, 0, 0, 1, 0, 582) »,
// la signature exacte du 2026-08-24. La mesure sait donc dire NON a une feuille
// hors ecran ; c'est le produit qui ne la lui donne plus.
//
// ⚠️ ET LA MIGRATION RESTE JUSTE, pour deux raisons qui ne dependent pas de ce
// resultat : une seule ecriture au lieu de seize, et surtout une app qui ne
// depend plus du detail d'implementation d'une dependance. Ce qui a change une
// fois entre deux versions peut rechanger ; `useSheetMotion` n'emet aucune cle
// de transform en mouvement reduit, donc la question ne se pose plus.
//
// ═══ REJOUE LE 2026-09-06 : LES DEUX CONTROLES CI-DESSUS SONT CONFIRMES ═══
//
// Les deux paragraphes precedents avaient ete ECRITS par une session perdue,
// et rien ne prouvait qu'ils aient jamais tourne : pas de trace de run, un
// `pw-rm.tmp.config.ts` abandonne a la racine. Les deux controles ont donc ete
// REJOUES de bout en bout sur ce poste, framer-motion 12.43.0, project
// `chromium`, viewport 390x844, `reducedMotion: 'reduce'` emule.
//
//   1. Forme du 2026-08-24 remise a la main sur `MobileMoreSheet`
//      (`initial={{ y: '100%' }}` + `animate={{ y: 0 }}`, sans le helper) :
//      le test PASSE. La feuille s'ouvre entierement visible. Confirme.
//   2. Meme feuille privee de son `animate` : le test ECHOUE, sur
//      « 0 px visibles sur 582 px de hauteur (transform matrix(1, 0, 0, 1, 0, 582)) ».
//      La mesure sait donc dire NON, et elle le dit avec la signature exacte
//      du defaut d'origine.
//
// ⚠️ LE CONTROLE 2 EST AUSSI CE QUI VALIDE LE CONTROLE 1. Un « ca passe »
// obtenu sur une mutation que Vite n'aurait pas servie ne vaudrait rien — et
// c'est le doute que la session precedente avait du lever a la main, en allant
// lire le module servi. Ici les deux controles portent sur le MEME fichier :
// le second vire au rouge, donc le serveur servait bien les mutations, donc le
// vert du premier parle du produit et pas du harnais.
//
// La feuille a ete remise dans sa forme correcte apres chaque controle
// (empreinte md5 revérifiée identique a l'originale).
//
// 🔴 ET UN TROU A ETE TROUVE EN LES REJOUANT, ce qui est tout l'interet de
// rejouer : ce test etait `skip` sur le project `chromium` (viewport 1280 px,
// la feuille n'est pas montee au-dessus de 768 px), et sur le project
// `mobile-safari` — le seul a porter un viewport mobile — il n'atteignait
// jamais son corps, la fixture `e2e/fixtures.ts` echouant avant. La feuille qui
// a motive TOUT ce dossier n'etait donc mesuree NULLE PART, et ca se lisait
// dans un rapport exactement comme « rien a signaler ».
// Les deux causes sont traitees : le bloc « sous le point de rupture mobile »
// plus bas porte son propre viewport, et la fixture ne suppose plus un titre
// desktop (cf. le commentaire de `e2e/fixtures.ts`).
//
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

/** Mesure UN element designe, sans passer par la structure voile > panneau.
 *
 *  🔴 POURQUOI CE SECOND CHEMIN EXISTE. `measureTopSheet` suppose que le
 *  panneau est un ENFANT d'un voile plein ecran. `MobileMoreSheet` ne l'est
 *  pas : son voile et sa feuille sont FRERES (deux `motion.div` cote a cote
 *  dans un fragment). La feuille qui a motive tout ce fichier — 0 px visible
 *  le 2026-08-24, seul acces mobile a OKR, Statistiques, Parametres et a la
 *  deconnexion — etait donc precisement celle que le harnais ne savait pas
 *  lire. Mesure du 2026-09-04 : `measureTopSheet` levait « aucun voile plein
 *  ecran trouve » alors que la feuille etait bel et bien ouverte.
 *
 *  La lecon est celle de la passe du 2026-09-03 : une garde se verifie sur ce
 *  qu'elle REGARDE, pas sur le fait qu'elle tourne. */
async function measureBySelector(page: Page, selector: string): Promise<SheetMeasure> {
  const measured = await page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
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
  }, selector);

  if (!measured) throw new Error(`Élément introuvable dans le DOM : ${selector}`);
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
  // ── C-07 (2026-09-04) : les 16 feuilles ecrites a la main sont passees sur
  //    `useSheetMotion()`, et le cliquet statique est a ZERO.
  //
  //    Ce que ca change pour CE fichier : avant, chaque feuille portait son
  //    PROPRE litteral `initial={{ y: '100%' }}`, donc en mesurer deux ne
  //    disait rien des quatorze autres. Elles partagent maintenant un seul
  //    chemin de code — mesurer le helper porte plus loin qu'avant. Ce n'est
  //    pas une raison d'arreter de mesurer : les deux cas ci-dessous ajoutent
  //    la feuille qui a REELLEMENT ete cassee, et une des nouvelles migrees.

  // 🔴 VIEWPORT MOBILE PORTE PAR LE TEST, ET C'EST LE CŒUR DU FICHIER.
  //
  // `MobileMoreSheet` n'est montee que sous 768 px (`useIsMobile`, comparaison
  // sur `window.innerWidth`). Le project `chromium` rend en 1280x720 : le test
  // ci-dessous s'y SKIPPAIT. Et le project `mobile-safari`, seul a porter un
  // viewport mobile, n'atteignait jamais le corps du test : mesure du
  // 2026-09-06, la fixture `e2e/fixtures.ts` attendait un h1 « Bonjour » que le
  // dashboard rend `hidden md:block` — donc jamais sous 768 px, ou le titre est
  // la date. Une spec ANCIENNE et sans rapport (`demo-toggle-habit`) echouait
  // au meme endroit : ce n'etait pas cette mesure qui etait fausse, c'etait la
  // fixture qui supposait le desktop. Corrige a sa source.
  //
  // Resultat net avant ce bloc : la feuille qui a motive TOUT ce dossier — 0 px
  // visible le 2026-08-24, seul acces mobile a OKR, Statistiques, Parametres et
  // a la deconnexion — n'etait mesuree nulle part. Un `skip` sur un project et
  // un echec de fixture sur l'autre se lisent, dans un rapport, exactement
  // comme « rien a signaler ».
  //
  // Le viewport est donc porte par le TEST, pas par le project : la mesure ne
  // depend plus de la configuration sous laquelle on la lance.
  test.describe('sous le point de rupture mobile', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('MobileMoreSheet s’ouvre visible (la feuille du 2026-08-24)', async ({
      demoPage: page,
    }) => {
      // Filet : si le viewport ci-dessus disparaissait, ce test doit ECHOUER
      // bruyamment plutot que passer sans jamais trouver sa cible.
      const vw = page.viewportSize()?.width ?? 0;
      expect(
        vw,
        `Viewport ${vw} px : la feuille n'est pas montée au-dessus de 768 px, ` +
          'ce test ne mesurerait rien.',
      ).toBeLessThan(768);

      await assertPageIsPainting(page);
      await page.getByRole('button', { name: /plus d'options/i }).click();
      await expect(page.locator('[data-mobile-more-sheet]')).toBeVisible({ timeout: 5_000 });
      await page.waitForTimeout(800);

      // ⚠️ TÉMOIN LOCAL, et il n'est pas redondant avec celui du fichier.
      // Le temoin de tete passe par la landing, donc par un lien que le header
      // mobile ne monte pas : il ne peut pas arbitrer un run mobile. Ce test
      // porte donc le sien, et il est meme meilleur — le VOILE de cette feuille
      // est anime en opacite SEULE, donc sain par construction. Voile peint +
      // feuille absente = defaut produit ; les deux eteints = harnais qui ment,
      // et c'est exactement l'artefact de l'onglet cache decrit en tete.
      const backdrop = await measureBySelector(page, '[data-mobile-more-sheet-backdrop]');
      expect(
        backdrop.opacity,
        'Le voile lui-même est éteint : rien ne peint dans ce run, le verdict ' +
          "sur la feuille ne vaudrait rien (cf. en-tête de ce fichier).",
      ).toBeGreaterThan(0.1);

      expectSheetIsUsable(
        await measureBySelector(page, '[data-mobile-more-sheet]'),
        'MobileMoreSheet',
      );
    });
  });

  test('DeleteObjectiveConfirm s’ouvre visible', async ({ demoPage: page }) => {
    // Feuille migree le 2026-09-04 : elle combine `useSheetMotion` (mouvement)
    // et `useSheetDrag` (geste), la paire que C-07 demandait.
    await assertPageIsPainting(page);
    await page.goto('/okr');

    const del = page.getByRole('button', { name: /^supprimer l'objectif$/i }).first();
    await del.waitFor({ state: 'visible', timeout: 15_000 });
    await del.click();

    await page.waitForTimeout(800);

    expectSheetIsUsable(await measureTopSheet(page), 'DeleteObjectiveConfirm');
  });
});
