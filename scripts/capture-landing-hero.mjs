// ═══════════════════════════════════════════════════════════════════
// Capture du haut de la landing, peint par le prérendu de `/` et `/en/`
// ═══════════════════════════════════════════════════════════════════
//
// Usage, après tout changement du header ou du hero du parcours perso :
//
//   npm run build && npx vite preview --port 4173 --strictPort
//   npm run capture:landing-hero                     # autre terminal
//   npm run build                                    # le prérendu relit la capture
//
// Écrit `scripts/landing-hero/<locale>.html` : le balisage RÉEL rendu par
// React (header, rangée mobile, hero, bandeau), classes comprises, figé dans
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
//     une entrée, au lieu de disparaître pour réapparaître.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { heroSourcesDigest, SOURCES_MANIFEST } from './landing-hero-sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] ?? 'http://localhost:4173';
const PAGES = [{ locale: 'fr', path: '/' }, { locale: 'en', path: '/en/' }];

/** Exécuté DANS la page : rend le fragment nettoyé. */
function extraire() {
  // La copie posée par le prérendu porte aussi un <header> : ne jamais la
  // capturer elle-même (elle est normalement déjà relevée à ce stade).
  document.getElementById('lp-hero')?.remove();
  const ENTREES = ['hero-line-in', 'hero-rise', 'hero-chip', 'hero-window', 'hero-link', 'hero-dock-settle'];
  const header = document.querySelector('header');
  const racine = header.parentElement;
  const rangeeMobile = header.nextElementSibling;
  const parcours = document.querySelector('#track > div:last-child');
  const hero = parcours.querySelector('section');
  const bandeau = hero.nextElementSibling;

  // La tuile (le bouton de pause de la vitrine) et les éléments que l'app fait entrer.
  const tuile = hero.querySelector('button[aria-pressed], button[aria-label*="ause"], button[aria-label*="ecture"]');
  for (const el of [tuile?.parentElement, ...hero.querySelectorAll('.hero-chip, .hero-link, .hero-dock-settle, .hero-trace-h, .hero-trace-v')]) {
    if (el) el.setAttribute('data-lp-masque', '');
  }

  const coque = racine.cloneNode(false);
  const parcoursCopie = parcours.cloneNode(false);
  parcoursCopie.append(hero.cloneNode(true), bandeau.cloneNode(true));
  const main = document.createElement('div');
  main.append(parcoursCopie);
  coque.append(header.cloneNode(true), rangeeMobile.cloneNode(true), main);

  for (const el of [coque, ...coque.querySelectorAll('*')]) {
    el.removeAttribute('id');
    el.removeAttribute('aria-controls');
    if (el.hasAttribute('data-lp-masque')) {
      el.removeAttribute('data-lp-masque');
      el.style.visibility = 'hidden';
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
for (const { locale, path } of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + path);
  await page.waitForSelector('main h1');
  await page.waitForTimeout(2500);
  const fragment = await page.evaluate(extraire);
  const fichier = join(ROOT, 'scripts', 'landing-hero', `${locale}.html`);
  writeFileSync(fichier, `${fragment}\n`, 'utf8');
  console.log(`${locale} : ${fragment.length} caractères → ${fichier}`);
  await ctx.close();
}
await browser.close();

// L'empreinte des sources capturées : `src/prerender-hero.guard.test.ts` échoue
// dès qu'une d'elles bouge sans nouvelle capture (cf. landing-hero-sources.mjs).
writeFileSync(join(ROOT, SOURCES_MANIFEST), `${JSON.stringify(heroSourcesDigest(ROOT), null, 2)}
`, 'utf8');
console.log(`empreinte des sources → ${SOURCES_MANIFEST}`);
