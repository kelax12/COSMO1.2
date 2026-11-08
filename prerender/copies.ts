// Les copies peintes AVANT React, dans le calque `#lp-hero` posé hors de #root.
//
//   · home et entreprise : une COPIE du header et du hero de leur parcours,
//     capturée sur le rendu React (`scripts/capture-landing-hero.mjs`) ;
//   · pages de contenu (blog, articles, `/pour-*`, à-propos, pages légales,
//     guide) : leur PROPRE rendu React, produit ici par leurs composants
//     (`src/prerender/content-copy.tsx`, chargé par Vite en SSR).
//
// Dans les deux cas la CSS vient de la feuille buildée, confinée sous
// `#lp-hero` (`scripts/landing-hero-css.mjs`). Le calque est HORS de #root :
// React ne l'efface pas, la landing le retire dans l'image où elle peint son
// hero. `inert` : ni focus ni lecteur d'écran sur une copie aux boutons morts.
// Pourquoi : `src/lib/prerender-hero.ts`.
//
// ❌ Pas de copie absente qui passerait en silence : le build échoue, sinon la
// page repeindrait le mur de texte sans que rien ne le signale.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locale } from '@/i18n/locale';
import { scopedCssFor } from '../scripts/landing-hero-css.mjs';
import { demoteH1 } from '../scripts/prerender-h1.mjs';
import { localizePath } from '../src/i18n/seo-urls.mjs';
import { DIST, ROOT } from './config.ts';

const ROOT_MARKER = '<div id="root">';

let landingCss: string | null = null;

/** La feuille de style buildée qui porte le hero (une seule, sinon le build échoue). */
function heroCssSource(): string {
  if (landingCss !== null) return landingCss;
  const assets = join(DIST, 'assets');
  const sheets = readdirSync(assets)
    .filter((f) => f.endsWith('.css'))
    .filter((f) => readFileSync(join(assets, f), 'utf8').includes('.hero-line-mask'));
  if (sheets.length !== 1) {
    throw new Error(`prerender: feuille du hero introuvable ou ambiguë dans dist/assets (${sheets.join(', ') || 'aucune'})`);
  }
  landingCss = readFileSync(join(assets, sheets[0]), 'utf8');
  return landingCss;
}

/** Pose le <style> de la copie en fin de <head> et le calque juste avant #root. */
function poserCalque(page: string, css: string, calque: string): string {
  if (!page.includes(ROOT_MARKER)) throw new Error('prerender: <div id="root"> introuvable, copie non posée');
  let out = page.replace('</head>', () => `    <style id="lp-hero-css">${css}</style>
  </head>`);
  out = out.replace(ROOT_MARKER, () => `${calque}
    <div id="root">`);
  return out;
}

/**
 * Copie du hero d'un parcours (home `perso`, `entreprise`). Un hero rendu
 * AUTREMENT sous 768 px (`useIsMobile`, parcours entreprise) a sa seconde
 * capture : les deux vues sont posées, une media query choisit, au même seuil
 * que le hook. Une image `eager` de la vue masquée part quand même : c'est la
 * même URL dans les deux (premier écran de la pile).
 */
export function injectHeroCopy(page: string, locale: Locale, track: string): string {
  const file = join(ROOT, 'scripts', 'landing-hero', `${track}-${locale}.html`);
  if (!existsSync(file)) {
    throw new Error(`prerender: ${file} absent, lancer npm run capture:landing-hero (cf. son en-tête)`);
  }
  let fragment = readFileSync(file, 'utf8').trim();
  const mobileFile = join(ROOT, 'scripts', 'landing-hero', `${track}-${locale}-mobile.html`);
  const mediaVues = '#lp-hero>.lp-vue-mobile{display:none}@media (max-width:767px){#lp-hero>.lp-vue-bureau{display:none}#lp-hero>.lp-vue-mobile{display:block}}';
  let css: string;
  if (existsSync(mobileFile)) {
    const mobile = readFileSync(mobileFile, 'utf8').trim();
    css = `${scopedCssFor(`${fragment}${mobile}`, heroCssSource())}\n${mediaVues}`;
    fragment = `<div class="lp-vue-bureau">${fragment}</div><div class="lp-vue-mobile">${mobile}</div>`;
  } else {
    css = scopedCssFor(fragment, heroCssSource());
  }
  return poserCalque(
    page,
    css,
    `<div id="lp-hero" inert data-locale="${locale}" data-track="${track}">${demoteH1(fragment)}</div>`
  );
}

// ── Rendu des pages de contenu, par les composants de l'application ─────────
// Pas de capture à refaire : le balisage est recalculé à chaque build, il ne
// peut pas diverger de la page. Les classes de thème (`dark`, `gris`, `noir`)
// sont lues sur <html>, où le script inline d'index.html les pose avant la
// première peinture.
interface ContentCopyModule {
  renderContentCopy: (page: string, url: string, locale: Locale) => Promise<string | undefined>;
}
interface ViteSsr {
  ssrLoadModule: (url: string) => Promise<unknown>;
  close: () => Promise<void>;
}

let viteSsr: ViteSsr | null = null;
let contentCopyModule: ContentCopyModule | null = null;

async function contentCopy(): Promise<ContentCopyModule> {
  if (contentCopyModule) return contentCopyModule;
  const { createServer } = await import('vite');
  viteSsr = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'error',
    // Pas de pré-bundling : le scan des dépendances parcourt toute l'app, et
    // le rendu serveur n'en a pas besoin.
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  contentCopyModule = (await viteSsr.ssrLoadModule('/src/prerender/content-copy.tsx')) as ContentCopyModule;
  return contentCopyModule;
}

/** Ferme le serveur Vite du rendu : sans cela le processus du build ne rend pas la main. */
export async function closeContentCopy(): Promise<void> {
  if (viteSsr) await viteSsr.close();
}

const AVERTISSEMENT_SSR = /useLayoutEffect does nothing on the server/;

/** Rend la copie d'une page de contenu en silençant l'avertissement SSR attendu. */
async function renderFragment(page: string, url: string, locale: Locale): Promise<string | undefined> {
  const { renderContentCopy } = await contentCopy();
  // React prévient qu'un useLayoutEffect ne s'exécute pas côté serveur (celui
  // du routeur) : c'est attendu, la copie est inerte. Le reste passe.
  const error = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && AVERTISSEMENT_SSR.test(args[0])) return;
    error(...args);
  };
  try {
    return await renderContentCopy(page, url, locale);
  } finally {
    console.error = error;
  }
}

/** Copie d'une page de contenu : son rendu React, peint avant React. */
export async function injectContentCopy(out: string, locale: Locale, page: string, path: string): Promise<string> {
  const prefixe = localizePath('/', locale).replace(/\/$/, '');
  const url = path.slice(prefixe.length) || '/';
  const fragment = await renderFragment(page, url, locale);
  if (!fragment || fragment.length < 200) {
    throw new Error(`prerender: copie de ${path} vide ou presque (${fragment?.length ?? 0} o), page introuvable par son routeur ?`);
  }
  const css = scopedCssFor(fragment, heroCssSource(), '#lp-hero', { themeSurHtml: true });
  if (!out.includes(ROOT_MARKER)) throw new Error('prerender: <div id="root"> introuvable, copie de page non posée');
  const marquee = out.replace(/<html(?![^>]*data-prerendered)/, '<html data-prerendered');
  return poserCalque(
    marquee,
    css,
    `<div id="lp-hero" inert data-locale="${locale}" data-track="contenu">${demoteH1(fragment)}</div>`
  );
}
