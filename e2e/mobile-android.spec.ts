// ═══════════════════════════════════════════════════════════════════
// C-97 — Android, PAYSAGE, texte agrandi, CPU bridé
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CE FICHIER EXISTE.
//
// Vérifié le 2026-09-20 sur `playwright.config.ts` : tout ce que le dépôt
// mesurait en mobile tournait sur UN modèle (iPhone 12), UN moteur (WebKit),
// AUCUN Android. Or Chrome Android est le premier navigateur mobile du
// marché. Et rien, nulle part, ne jouait :
//
//   · le mode PAYSAGE — un téléphone tourné fait ~360 px de haut, ce qui est
//     moins que la hauteur combinée d'un en-tête et d'un clavier virtuel.
//     C'est la configuration où un écran se coupe, et elle n'était pas jouée ;
//   · une TAILLE DE POLICE SYSTÈME augmentée — le réglage d'accessibilité le
//     plus utilisé au monde. WCAG 1.4.4 exige 200 % sans perte de contenu ni
//     de fonctionnalité ;
//   · un CPU BRIDÉ — et c'est celui qui coûte le plus cher d'être absent.
//     C-68 (fil principal bloqué 3 637 ms sur 4 000 au repos) a été trouvé À
//     LA MAIN. Un project qui ne bride rien ne reverra jamais cette classe de
//     défaut, quel que soit le nombre de parcours qu'il joue.
//
// ── CE QUE CHAQUE CAS MESURE, ET CE QU'IL NE MESURE PAS ─────────────
//
// ⚠️ Ces cas mesurent un appareil ÉMULÉ sur un runner, pas un téléphone. Le
// bridage CPU de CDP ralentit l'exécution JavaScript ; il ne reproduit ni la
// thermique, ni le GPU mobile, ni la mémoire. Le volet « appareil réel » reste
// `a-faire-manuel.md` (audit A-4, moitié appareil NON FAITE).
//
// ❌ Ne jamais lire un vert ici comme « le produit va bien sur Android ».
//    Il dit : sur ces trois configurations, ces invariants-là tiennent.
//
// ── LES TÉMOINS ─────────────────────────────────────────────────────
//
// Chaque détecteur de ce fichier est d'abord soumis au défaut qu'il doit
// voir. Sans ça, une mesure cassée rendrait le fichier vert pour toujours —
// la règle de `scripts/CLAUDE.md`, appliquée ici.
// ═══════════════════════════════════════════════════════════════════

import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

test.describe.configure({ timeout: 240_000 });

/**
 * Le débordement HORIZONTAL, en pixels CSS.
 *
 * 🔴 CE DÉTECTEUR A ÉTÉ ÉCRIT FAUX, ET SON PROPRE TÉMOIN L'A ATTRAPÉ.
 * La première version rendait `documentElement.scrollWidth - clientWidth`.
 * Mesuré : on insère un bloc de 3 000 px dans la page, et la valeur reste
 * **ZÉRO**. L'application pose `overflow-x: hidden` sur la racine — ce qui
 * SUPPRIME le défilement sans supprimer le débordement. Les cinq cas de
 * paysage auraient donc été verts quoi qu'il arrive : la garde aurait
 * répondu sans mesurer, sur le fichier même qui prétend chercher ça.
 *
 * On mesure donc ce qui déborde RÉELLEMENT : le bord droit de chaque élément
 * par rapport à la largeur de la fenêtre. Avec `overflow-x: hidden`, le
 * symptôme n'est pas une barre de défilement, c'est du contenu COUPÉ — le
 * même défaut, dans sa forme la plus sournoise puisqu'elle ne laisse aucune
 * trace visible.
 *
 * ⚠️ Deux garde-fous contre le bruit :
 *   · les éléments `position: fixed` hors écran par conception (feuilles
 *     fermées, menus repliés, panneaux à `translateX(-100%)`) sont ignorés :
 *     ils sont *censés* être à côté ;
 *   · tolérance de 1 px, pour les arrondis sub-pixel d'un
 *     `deviceScaleFactor` non entier ;
 *   · 🔴 (2026-09-23) un élément rangé dans un CARROUSEL de composant n'est
 *     pas perdu : une rangée de puces ou d'onglets en `overflow-x: auto`,
 *     qui tient elle-même dans l'écran, se fait défiler au doigt. C'est ce
 *     qui a fait mesurer 1 182 px à `/tasks` et 649 à `/settings` le
 *     2026-09-20 : les puces de listes et les onglets de réglages, pas une
 *     perte de contenu. Le vrai défaut de `/tasks` était ailleurs, 218 px de
 *     métadonnées de tâche qui refusaient de passer à la ligne, et ce bruit le
 *     noyait. ❌ `main`, `body` et `html` ne comptent PAS comme carrousel :
 *     le `<main overflow-auto>` de `Layout` excuserait sinon toute la page.
 *     Et un carrousel qui sort LUI-MÊME de l'écran reste un débordement.
 */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const largeur = document.documentElement.clientWidth;
    // Le défilement, quand il existe : c'est le cas franc.
    let deborde = Math.max(0, Math.round(document.documentElement.scrollWidth - largeur));
    for (const el of document.body.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      // Un élément volontairement garé hors champ n'est pas un débordement.
      if (cs.position === 'fixed' && cs.transform !== 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right <= largeur + 1) continue;
      let dansUnCarrousel = false;
      for (let a = el.parentElement; a && !['MAIN', 'BODY', 'HTML'].includes(a.tagName); a = a.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(a).overflowX)) {
          dansUnCarrousel = a.getBoundingClientRect().right <= largeur + 1;
          break;
        }
      }
      if (!dansUnCarrousel) deborde = Math.max(deborde, Math.round(r.right - largeur));
    }
    return deborde;
  });
}

/**
 * Les éléments dont le texte est ROGNÉ par leur propre boîte.
 *
 * Le mode de défaillance d'un texte agrandi n'est pas le débordement de page
 * (souvent absorbé par `overflow: hidden`), c'est le mot coupé au milieu dans
 * un bouton dont la hauteur est figée. On compare donc le contenu réel à la
 * boîte, sur les éléments qui portent du texte et bornent leur hauteur.
 *
 * ⚠️ Deux pixels de tolérance : les arrondis sub-pixel d'un
 * `deviceScaleFactor` non entier produisent des écarts de 1 px sur des
 * éléments parfaitement rendus.
 */
async function clippedText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const candidats = document.querySelectorAll('button, a, h1, h2, h3, label, [role="button"]');
    for (const el of candidats) {
      if (!(el instanceof HTMLElement)) continue;
      const texte = (el.textContent ?? '').trim();
      if (!texte) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      // Un élément qui assume son débordement (`overflow: visible`) ne rogne
      // rien : le texte dépasse, il reste lisible. Ce n'est pas ce cas-ci.
      if (cs.overflowY === 'visible' && cs.overflowX === 'visible') continue;
      if (el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0) {
        out.push(`${texte.slice(0, 40)} (${el.clientHeight}px de boite, ${el.scrollHeight}px de texte)`);
      }
    }
    return out;
  });
}

// ═══════════════════════════════════════════════════════════════════
// 1. PAYSAGE
// ═══════════════════════════════════════════════════════════════════
test.describe('C-97 — mode paysage', () => {
  // Pixel 7 tourné : 863 x 360. La hauteur est le point dur.
  test.use({ viewport: { width: 863, height: 360 } });

  test('TEMOIN : le detecteur de debordement voit un debordement', async ({ demoPage }) => {
    // Sans cette sonde, un détecteur cassé rendrait les deux cas suivants
    // verts pour toujours.
    expect(await horizontalOverflow(demoPage)).toBe(0);
    await demoPage.evaluate(() => {
      const d = document.createElement('div');
      d.id = 'c97-temoin-overflow';
      // ⚠️ `position: absolute; left: 0` et une largeur franche : un bloc en
      // flux normal se ferait contraindre par son parent, et le témoin
      // mesurerait la contrainte au lieu du débordement.
      d.style.cssText = 'position:absolute;left:0;top:0;width:3000px;height:10px';
      document.body.appendChild(d);
    });
    expect(await horizontalOverflow(demoPage)).toBeGreaterThan(1000);
    await demoPage.evaluate(() => document.getElementById('c97-temoin-overflow')?.remove());
    expect(await horizontalOverflow(demoPage)).toBe(0);
  });

  test('TEMOIN : un carrousel qui tient dans l ecran est excuse, pas un carrousel qui en sort', async ({ demoPage }) => {
    // Les deux moitiés de l'exception du 2026-09-23, chacune vue.
    await demoPage.evaluate(() => {
      const c = document.createElement('div');
      c.id = 'c97-temoin-carrousel';
      c.style.cssText = 'position:absolute;left:0;top:0;width:200px;overflow-x:auto;display:flex';
      c.innerHTML = '<span style="flex:none;width:3000px;height:10px;display:block"></span>';
      document.body.appendChild(c);
    });
    expect(await horizontalOverflow(demoPage), 'un carrousel qui tient dans l ecran se fait defiler : rien n est perdu').toBe(0);
    // Le même carrousel, élargi au-delà de l'écran : son propre bord est coupé.
    await demoPage.evaluate(() => { document.getElementById('c97-temoin-carrousel')!.style.width = '3000px'; });
    expect(await horizontalOverflow(demoPage), 'un carrousel qui sort lui-meme de l ecran reste un debordement').toBeGreaterThan(1000);
    await demoPage.evaluate(() => document.getElementById('c97-temoin-carrousel')?.remove());
    expect(await horizontalOverflow(demoPage)).toBe(0);
  });

  /**
   * 🔴 LE PLAFOND PAR ROUTE, POSÉ AU MESURÉ DU 2026-09-20 — et ce que ces
   * chiffres veulent dire.
   *
   * C'est la PREMIÈRE fois que le paysage est mesuré : aucun project du dépôt
   * ne l'avait jamais joué. Deux routes sur cinq débordent, et franchement :
   *
   *     /agenda   447 px hors écran
   *     /tasks    619 px hors écran
   *
   * ⚠️ Le symptôme n'est PAS une barre de défilement — la racine porte
   * `overflow-x: hidden`. C'est du contenu COUPÉ, sans aucune trace visible :
   * la moitié droite d'un tableau de tâches, en paysage, n'existe simplement
   * pas pour l'utilisateur. C'est exactement pour ça que personne ne l'avait
   * signalé.
   *
   * POURQUOI UN CLIQUET ET PAS UN ZÉRO. Exiger 0 aujourd'hui rendrait ces
   * deux cas rouges en permanence, et un rouge permanent finit ignoré — il
   * rendrait muets les trois qui tiennent déjà. Le plafond est donc posé AU
   * MESURÉ : il ne peut que DESCENDRE, et les trois routes propres restent
   * à zéro, donc protégées.
   *
   * ❌ NE JAMAIS REMONTER UN DE CES NOMBRES. Un dépassement dit qu'une
   *    largeur de plus s'est figée. La sortie de dette est de les ramener à
   *    zéro, pas de les recaler.
   */
  const PLAFOND_PAYSAGE: Record<string, number> = {
    '/dashboard': 0,
    '/habits': 0,
    '/settings': 0,
    '/agenda': 447,
    // 619 → 0 le 2026-09-23 : c'était la rangée de puces de listes, un
    // carrousel qui se fait défiler (cf. `horizontalOverflow`), pas une perte.
    '/tasks': 0,
  };

  for (const [route, plafond] of Object.entries(PLAFOND_PAYSAGE)) {
    test(`${route} : debordement en paysage sous son plafond (${plafond} px)`, async ({ demoPage }) => {
      await demoPage.goto(route);
      await demoPage.waitForLoadState('networkidle');
      await demoPage.waitForTimeout(800);
      const deborde = await horizontalOverflow(demoPage);
      if (deborde > 0) {
        console.log(`::notice title=c97-paysage::${route} deborde de ${deborde} px (plafond ${plafond})`);
      }
      expect(
        deborde,
        `Un debordement lateral en paysage veut dire qu une largeur est figee `
          + `quelque part au lieu de suivre le viewport. Et avec overflow-x: hidden, `
          + `le contenu n est pas decale : il est COUPE, sans rien a l ecran qui le dise.`,
      ).toBeLessThanOrEqual(plafond);
    });
  }

  test('la navigation principale reste atteignable en paysage', async ({ demoPage }) => {
    // 🔴 Le vrai risque du paysage n'est pas le débordement, c'est la
    // DISPARITION : 360 px de haut, moins un en-tête, laissent peu de place, et
    // une barre d'onglets ancrée en bas peut se retrouver hors de la fenêtre
    // ou recouverte. Un écran sans navigation est un cul-de-sac.
    await demoPage.goto('/dashboard');
    await demoPage.waitForLoadState('networkidle');
    await demoPage.waitForTimeout(800);

    const atteignables = await demoPage.evaluate(() => {
      const h = window.innerHeight;
      const w = window.innerWidth;
      let n = 0;
      for (const el of document.querySelectorAll('nav a, nav button, [role="navigation"] a, [role="navigation"] button')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // Au moins à moitié dans la fenêtre : une commande coupée par le bord
        // n'est pas atteignable au doigt.
        if (r.top + r.height / 2 < h && r.bottom - r.height / 2 > 0 && r.left < w && r.right > 0) n += 1;
      }
      return n;
    });
    expect(
      atteignables,
      'Aucune commande de navigation dans la fenetre en paysage : l ecran est un cul-de-sac.',
    ).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. TAILLE DE POLICE SYSTÈME AUGMENTÉE (WCAG 1.4.4)
// ═══════════════════════════════════════════════════════════════════
test.describe('C-97 — texte agrandi', () => {
  test.use({ viewport: { width: 412, height: 839 } });

  /**
   * 200 % de la racine, c'est-à-dire 32 px au lieu de 16.
   *
   * ⚠️ On pose `font-size` sur `html` et pas un zoom de page : un zoom
   * navigateur réduit le viewport CSS d'autant, ce qui MASQUE le défaut qu'on
   * cherche. Le réglage système d'un téléphone, lui, agrandit le texte SANS
   * changer la largeur disponible — c'est ce cas-là qui casse les mises en
   * page, et c'est celui-ci qu'on reproduit.
   *
   * ⚠️ `!important` : Tailwind ne pose pas de `font-size` sur `html`, mais un
   * reset pourrait. On ne veut pas dépendre de l'ordre des feuilles.
   */
  const AGRANDIR = 'html{font-size:32px !important}';

  test('TEMOIN : le detecteur de rognage voit un texte rogne', async ({ demoPage }) => {
    await demoPage.evaluate(() => {
      const d = document.createElement('div');
      d.id = 'c97-temoin-clip';
      d.innerHTML =
        '<button style="height:10px;overflow:hidden;display:block">Un libelle beaucoup trop long pour dix pixels de haut</button>'
        + '<button style="height:80px;overflow:hidden;display:block">Court</button>';
      document.body.appendChild(d);
    });
    const vus = await clippedText(demoPage);
    expect(vus.some((v) => v.startsWith('Un libelle beaucoup trop long'))).toBe(true);
    expect(vus.some((v) => v.startsWith('Court'))).toBe(false);
    await demoPage.evaluate(() => document.getElementById('c97-temoin-clip')?.remove());
  });

  /**
   * 🔴 LE PLAFOND PAR ROUTE À 200 % DE POLICE, posé au mesuré du 2026-09-20.
   *
   * Première mesure de ce réglage, lui aussi jamais joué :
   *
   *     /dashboard    12 px    (une rangée qui ne passe pas à la ligne)
   *     /settings    649 px
   *     /tasks      1182 px    — trois fois la largeur de l'écran
   *
   * WCAG 1.4.4 exige 200 % « sans perte de contenu ni de fonctionnalité ».
   * `/tasks` à 1 182 px de débordement, c'est un tableau dont les deux tiers
   * droits sont inatteignables pour quelqu'un qui a grossi sa police — donc
   * pour une partie de ceux qui en ont le plus besoin.
   *
   * Même raisonnement que pour le paysage : cliquet au mesuré plutôt que zéro
   * permanent. ❌ Ces trois nombres ne remontent pas.
   */
  /*
   * 🔴 2026-09-23 · les trois à ZÉRO, et ce que la baisse doit à chacun :
   *   /settings 649 → 0  la rangée d'onglets, un carrousel défilant : le
   *                      détecteur la comptait comme une perte
   *   /tasks   1182 → 0  même cause (les puces de listes), qui NOYAIT le vrai
   *                      défaut : 218 px de métadonnées de tâche qui ne
   *                      passaient pas à la ligne. Corrigé (`flex-wrap`)
   *   /dashboard 12 → 0  l'en-tête mobile compensait une gouttière de 1rem
   *                      sur une page à `p-3` : 4 px de trop, 8 à 200 %
   * Ils avaient aussi un défaut de pose : mesurés sous Windows, ils rendaient
   * 13 / 650 / 1 187 sous Linux en CI, et le job e2e restait rouge sur 1 à
   * 5 px de rendu de police. À zéro, il n'y a plus d'écart à arrondir.
   */
  const PLAFOND_TEXTE: Record<string, number> = {
    '/dashboard': 0,
    '/settings': 0,
    '/tasks': 0,
  };

  for (const [route, plafond] of Object.entries(PLAFOND_TEXTE)) {
    test(`${route} : a 200 % de police, debordement sous ${plafond} px`, async ({ demoPage }) => {
      await demoPage.addStyleTag({ content: AGRANDIR });
      await demoPage.goto(route);
      await demoPage.addStyleTag({ content: AGRANDIR });
      await demoPage.waitForLoadState('networkidle');
      await demoPage.waitForTimeout(800);

      // WCAG 1.4.4 : « sans perte de contenu ni de fonctionnalité ». Un
      // contenu qui sort de l'écran EST une perte — et ici il ne se décale
      // même pas, il est coupé.
      const deborde = await horizontalOverflow(demoPage);
      if (deborde > 0) {
        console.log(`::notice title=c97-texte-200::${route} deborde de ${deborde} px (plafond ${plafond})`);
      }
      expect(
        deborde,
        'A 200 % de police, la page deborde lateralement : une largeur est '
          + 'exprimee en unites liees a la police sans borne, ou une rangee '
          + 'refuse de passer a la ligne.',
      ).toBeLessThanOrEqual(plafond);

      // 🔴 Le rognage est RAPPORTÉ, pas bloquant, et c'est un arbitrage écrit.
      // Aucune mesure de référence n'existe (ce cas n'a jamais tourné) : poser
      // un zéro aujourd'hui rendrait la gate rouge en permanence, donc ignorée
      // — la règle de `scripts/CLAUDE.md`. Le chiffre est imprimé pour être lu
      // au premier run, et le plancher se posera au mesuré, pas avant.
      const rognes = await clippedText(demoPage);
      if (rognes.length > 0) {
        console.log(`::notice title=c97-texte-agrandi::${route} — ${rognes.length} element(s) rogne(s) a 200 % : ${rognes.slice(0, 5).join(' | ')}`);
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// 3. CPU BRIDÉ — la classe de défaut de C-68
// ═══════════════════════════════════════════════════════════════════
test.describe('C-97 — CPU bride', () => {
  test.use({ viewport: { width: 412, height: 839 } });

  /**
   * Facteur 4 : ce que Lighthouse applique en preset mobile, et l'ordre de
   * grandeur entre un runner de CI et un téléphone d'entrée de gamme.
   *
   * ⚠️ Un facteur plus agressif rendrait le cas instable sur un runner
   * partagé, et une gate instable finit désarmée.
   */
  const FACTEUR = 4;

  test('la landing reste interactive avec un CPU 4x plus lent', async ({ page, context }) => {
    // 🔴 CE QUE CE CAS MESURE, ET POURQUOI IL N'EST PAS UN BUDGET DE TEMPS.
    // Un seuil en millisecondes sur un runner partagé produit du bruit, et un
    // rouge qu'on rejoue est un rouge qu'on ignore. Ce qui est mesuré ici est
    // BINAIRE : la page, CPU bridé, répond-elle encore à un geste ? C'est
    // exactement ce que C-68 avait cassé — 3 637 ms de fil bloqué sur 4 000,
    // donc une page peinte et sourde.
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: FACTEUR });

    await context.clearCookies();
    await page.goto('/', { timeout: 180_000, waitUntil: 'domcontentloaded' });

    // Le CTA de la landing est le signal produit de disponibilité (cf.
    // `gotoTolerant` dans `fixtures.ts`) : pas `load`, qui n'arrive jamais.
    const cta = page.getByRole('button', { name: /sans inscription/i }).first();
    await expect(cta, 'CTA de la landing invisible avec un CPU 4x plus lent.').toBeVisible({
      timeout: 120_000,
    });

    // Le fil principal répond-il ? Un `evaluate` qui revient prouve que la
    // boucle d'évènements n'est pas monopolisée.
    const debut = Date.now();
    await page.evaluate(() => document.title);
    const latence = Date.now() - debut;
    console.log(`::notice title=c97-cpu::landing, CPU x${FACTEUR} — reponse du fil principal en ${latence} ms`);

    // Et le geste principal fonctionne-t-il vraiment ?
    await cta.click({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 120_000 });

    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  });

  test('TEMOIN : le bridage CPU ralentit reellement la page', async ({ page, context }) => {
    // 🔴 Sans ce témoin, un `setCPUThrottlingRate` qui cesserait de s'appliquer
    // (session CDP fermée, renommage du domaine, navigateur qui l'ignore)
    // laisserait le cas ci-dessus vert en ne bridant plus rien : la garde
    // répondrait sans mesurer. On chronomètre donc la MÊME boucle de calcul
    // avec et sans bridage, dans le même contexte.
    await page.goto('/', { timeout: 180_000, waitUntil: 'domcontentloaded' });
    const boucle = () =>
      page.evaluate(() => {
        const t0 = performance.now();
        let x = 0;
        for (let i = 0; i < 12_000_000; i += 1) x += i % 7;
        return { ms: performance.now() - t0, x };
      });

    const libre = (await boucle()).ms;
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: FACTEUR });
    const bride = (await boucle()).ms;
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    console.log(`::notice title=c97-temoin-cpu::libre ${Math.round(libre)} ms · bride ${Math.round(bride)} ms`);
    // Facteur 4 demandé, facteur 2 exigé : un runner partagé ne rend jamais le
    // rapport nominal, mais il ne rend pas non plus 1,0 si le bridage marche.
    expect(
      bride,
      `Le bridage CPU ne s applique plus : ${Math.round(libre)} ms libre contre `
        + `${Math.round(bride)} ms bride. Le cas precedent ne mesure alors plus rien.`,
    ).toBeGreaterThan(libre * 2);
  });
});
