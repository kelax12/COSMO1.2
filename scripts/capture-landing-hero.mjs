// ═══════════════════════════════════════════════════════════════════
// Capture du haut de la landing, peint par le prérendu de ses deux parcours
// ═══════════════════════════════════════════════════════════════════
//
// Usage, après tout changement du header ou du hero d'un des deux parcours :
//
//   npm run build && npx vite preview --port 4173 --strictPort
//   npm run capture:landing-hero                     # autre terminal
//   npm run build                                    # le prérendu relit la capture
//
// Écrit `scripts/landing-hero/<track>-<locale>.html` : le balisage RÉEL rendu
// par React (header, rangée mobile, hero, bandeau), classes comprises, figé dans
// son état final (`prefers-reduced-motion: reduce`, donc aucune entrée en
// cours). `prerender.mjs` l'injecte dans `#lp-hero` avec la CSS extraite par
// `landing-hero-css.mjs`. Pourquoi : `src/lib/prerender-hero.ts`.
//
// Ce qui est retiré ou masqué, et pourquoi :
//   · les `id` : la copie et l'app coexistent un instant dans le document ;
//   · les classes d'entrée (`hero-line-in`…) et leurs `--d` : la copie est
//     l'état final, elle ne doit rien rejouer ;
//   · la tuile, les quatre puces, leurs filets et les traces d'encre restent
//     dans la mise en page mais en `visibility: hidden` : l'app les fait
//     ENTRER (arrimage, rotation), ils apparaissent donc à la relève comme
//     une entrée, au lieu de disparaître pour réapparaître (une image masquée
//     perd aussi son `src` : rien ne part sur le réseau pour elle) ;
//   · le <canvas> du shader entreprise : cloné, il serait vide.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { heroSourcesDigest, SOURCES_MANIFEST } from './landing-hero-sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] ?? 'http://localhost:4173';
// Une capture par parcours et par langue : `<track>-<locale>.html`.
const PAGES = [
  { track: 'perso', locale: 'fr', path: '/' },
  { track: 'perso', locale: 'en', path: '/en/' },
  { track: 'entreprise', locale: 'fr', path: '/entreprise-presentation/', mobile: true },
  { track: 'entreprise', locale: 'en', path: '/en/for-companies/', mobile: true },
];
// Le hero entreprise se rend AUTREMENT sous 768 px (`useIsMobile` : pile
// simple, pas de shader). Seconde capture à 412 px, `<track>-<locale>-mobile.html`,
// que la copie affiche sous ce seuil (cf. injectHeroCopy de prerender.mjs).
const VUES = {
  bureau: { width: 1440, height: 900, suffixe: '' },
  mobile: { width: 412, height: 823, suffixe: '-mobile' },
};

/** Exécuté DANS la page : rend le fragment nettoyé. */
function extraire(track) {
  // La copie posée par le prérendu porte aussi un <header> : ne jamais la
  // capturer elle-même (elle est normalement déjà relevée à ce stade).
  document.getElementById('lp-hero')?.remove();
  const ENTREES = ['hero-line-in', 'hero-rise', 'hero-chip', 'hero-window', 'hero-link', 'hero-dock-settle'];
  const header = document.querySelector('header');
  const racine = header.parentElement;
  const main = racine.querySelector(':scope > main');
  // Tout ce qui précède <main> : header, rangée mobile du sélecteur, et (entreprise)
  // la capsule du sommaire collée sous le header.
  const avant = [];
  for (let el = racine.firstElementChild; el && el !== main; el = el.nextElementSibling) avant.push(el);
  const parcours = main.querySelector('#track > div:last-child');
  const hero = parcours.querySelector('section');
  // Perso : le bandeau qui défile sous le hero est dans le premier écran.
  const suite = track === 'perso' ? [hero.nextElementSibling] : [];

  // Ce que l'app fait ENTRER : présent dans la mise en page, invisible dans la copie.
  const aMasquer = [];
  if (track === 'perso') {
    const tuile = hero.querySelector('button[aria-pressed], button[aria-label*="ause"], button[aria-label*="ecture"]');
    aMasquer.push(tuile?.parentElement, ...hero.querySelectorAll('.hero-chip, .hero-link, .hero-dock-settle, .hero-trace-h, .hero-trace-v'));
  }
  // Entreprise : RIEN de masqué. La pile garde son image : même URL que celle
  // de React (aucun octet perdu), et le plus grand élément du hero. Masquée,
  // elle devenait le LCP à la relève (6,4 s mesurés le 2026-10-21).
  for (const el of aMasquer) if (el) el.setAttribute('data-lp-masque', '');

  const coque = racine.cloneNode(false);
  const parcoursCopie = parcours.cloneNode(false);
  parcoursCopie.append(hero.cloneNode(true), ...suite.map((el) => el.cloneNode(true)));
  const mainCopie = document.createElement('div');
  mainCopie.append(parcoursCopie);
  coque.append(...avant.map((el) => el.cloneNode(true)), mainCopie);

  // Le shader WebGL ne se recopie pas : un <canvas> cloné est vide.
  for (const c of coque.querySelectorAll('canvas')) c.remove();
  for (const el of [coque, ...coque.querySelectorAll('*')]) {
    el.removeAttribute('id');
    el.removeAttribute('aria-controls');
    if (el.hasAttribute('data-lp-masque')) {
      el.removeAttribute('data-lp-masque');
      el.style.visibility = 'hidden';
      for (const img of el.querySelectorAll('img')) {
        img.removeAttribute('src');
        img.removeAttribute('srcset');
      }
    }
    for (const c of ENTREES) el.classList.remove(c);
    el.style?.removeProperty('--d');
    el.style?.removeProperty('--tx');
    el.style?.removeProperty('--ty');
    if (el.getAttribute('style') === '') el.removeAttribute('style');
  }
  return coque.outerHTML;
}

const browser = await chromium.launch();
mkdirSync(join(ROOT, 'scripts', 'landing-hero'), { recursive: true });
for (const { track, locale, path, mobile } of PAGES) {
  for (const vue of mobile ? ['bureau', 'mobile'] : ['bureau']) {
    const { width, height, suffixe } = VUES[vue];
    // `locale` explicite : sans elle Playwright parle `en-US`, et `/` sert la
    // landing anglaise à la capture `perso-fr` (relevé le 2026-10-23).
    const ctx = await browser.newContext({
      viewport: { width, height },
      reducedMotion: 'reduce',
      locale: locale === 'fr' ? 'fr-FR' : 'en-US',
    });
    const page = await ctx.newPage();
    await page.goto(BASE + path);
    await page.waitForSelector('main h1');
    await page.waitForTimeout(2500);
    const fragment = await page.evaluate(extraire, track);
    const fichier = join(ROOT, 'scripts', 'landing-hero', `${track}-${locale}${suffixe}.html`);
    writeFileSync(fichier, `${fragment}\n`, 'utf8');
    console.log(`${track}-${locale}${suffixe} : ${fragment.length} caractères → ${fichier}`);
    await ctx.close();
  }
}
await browser.close();

// L'empreinte des sources capturées : `src/prerender-hero.guard.test.ts` échoue
// dès qu'une d'elles bouge sans nouvelle capture (cf. landing-hero-sources.mjs).
writeFileSync(join(ROOT, SOURCES_MANIFEST), `${JSON.stringify(heroSourcesDigest(ROOT), null, 2)}
`, 'utf8');
console.log(`empreinte des sources → ${SOURCES_MANIFEST}`);
