// Une page prérendue : la coquille d'index.html, avec son <head> réécrit
// (title, description, canonical, OG, Twitter, hreflang, JSON-LD) et le contenu
// indexable injecté dans #root.
import type { Locale } from '@/i18n/locale';
import { BCP47_TAG, OG_LOCALE, canonicalUrl, hreflangLinks, INDEXABLE_LOCALES } from '../src/i18n/seo-urls.mjs';
import { staticFooterNav } from './chrome.ts';
import { ld, ogImageFor } from './ld.ts';
import { requis, type Route } from './types.ts';

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/**
 * Locales réellement publiables pour une route : celles qui ont À LA FOIS des
 * méta et du contenu. C'est ce qui rend impossible la publication d'une page
 * anglaise au corps français (duplicate content), et ce qui garde les
 * `hreflang` exacts : ils ne peuvent pas annoncer une page non écrite.
 */
export function availableLocales(route: Route): Locale[] {
  return (INDEXABLE_LOCALES as Locale[]).filter((locale) => route.meta?.[locale] && route.content?.[locale]);
}

/**
 * Injecte le contenu indexable dans <div id="root">, AVANT #boot-screen.
 *
 * Présent dans le balisage, donc lu par les crawlers qui n'exécutent pas le JS ;
 * `#seo-fallback{display:none}` (<style> d'index.html) fait qu'un navigateur ne
 * le peint JAMAIS. ⚠ Ne PAS masquer ce bloc en JS : la CSP de vercel.json est
 * `script-src 'self'`, un <script> inline y est bloqué. Le masquage reste CSS.
 *
 * Le <noscript id="seo-noscript"> d'origine devient redondant (celui du <head>
 * réaffiche #seo-fallback sans JS) et est retiré, par son id.
 */
function injectStaticContent(page: string, content: string, locale: Locale): string {
  const marker = '<div id="root">';
  if (!page.includes(marker)) {
    console.warn('  ⚠ marqueur <div id="root"> introuvable, contenu statique non injecté');
    return page;
  }
  let out = page.replace(
    marker,
    `${marker}\n      <div id="seo-fallback">\n        ${content}\n        ${staticFooterNav(locale)}\n      </div>`
  );
  out = out.replace(/<noscript id="seo-noscript">[\s\S]*?<\/noscript>\s*/, '');
  return out;
}

/** Les balises de partage (OG, Twitter) réécrites pour une page. */
function rewriteSocialTags(page: string, o: { title: string; description: string; url: string; locale: Locale }): string {
  const { title, description, url, locale } = o;
  let out = page;
  out = out.replace(/<meta property="og:url" content="[\s\S]*?" \/>/, `<meta property="og:url" content="${url}" />`);
  out = out.replace(/<meta property="og:title" content="[\s\S]*?" \/>/, `<meta property="og:title" content="${esc(title)}" />`);
  out = out.replace(/<meta property="og:description" content="[\s\S]*?" \/>/, `<meta property="og:description" content="${esc(description)}" />`);
  out = out.replace(/<meta property="og:locale" content="[\s\S]*?" \/>/, `<meta property="og:locale" content="${OG_LOCALE[locale]}" />`);
  out = out.replace(/<meta name="twitter:title" content="[\s\S]*?" \/>/, `<meta name="twitter:title" content="${esc(title)}" />`);
  out = out.replace(/<meta name="twitter:description" content="[\s\S]*?" \/>/, `<meta name="twitter:description" content="${esc(description)}" />`);
  return out;
}

/** Image de partage propre à la page, si `capture-og-images.mjs` l'a rendue. */
function rewriteOgImage(page: string, ogImage: string, title: string): string {
  if (ogImage.endsWith('/og-card.png')) return page;
  let out = page;
  out = out.replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${ogImage}" />`);
  out = out.replace(/<meta property="og:image:secure_url" content="[^"]*" \/>/, `<meta property="og:image:secure_url" content="${ogImage}" />`);
  out = out.replace(/<meta property="og:image:type" content="[^"]*" \/>/, '<meta property="og:image:type" content="image/jpeg" />');
  out = out.replace(/<meta property="og:image:alt" content="[^"]*" \/>/, `<meta property="og:image:alt" content="${esc(title)}" />`);
  out = out.replace(/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${ogImage}" />`);
  out = out.replace(/<meta name="twitter:image:alt" content="[^"]*" \/>/, `<meta name="twitter:image:alt" content="${esc(title)}" />`);
  return out;
}

/**
 * Construit la page d'une route dans une locale à partir de la coquille
 * `html` (index.html) : méta, hreflang réciproques, JSON-LD de la route, corps.
 */
export function buildPage(html: string, route: Route, locale: Locale, alternates: Locale[]): string {
  let out = html;
  const { title, description } = requis(route.meta[locale], `méta de ${route.path} en « ${locale} »`);
  const url = canonicalUrl(route.path, locale);

  // Langue du document, lue par les lecteurs d'écran et les moteurs.
  out = out.replace(/<html([^>]*)\slang="[^"]*"/, `<html$1 lang="${locale}"`);

  // `data-prerendered` : la page est peinte avant React (LCP mobile), mais
  // SEULEMENT celles qui ont une copie de leur hero (`heroTrack`). Les pages de
  // contenu (`copy`) posent l'attribut elles-mêmes (injectContentCopy).
  if (route.heroTrack) out = out.replace(/<html(?![^>]*data-prerendered)/, '<html data-prerendered');

  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  out = out.replace(/<meta name="description" content="[\s\S]*?" \/>/, `<meta name="description" content="${esc(description)}" />`);
  out = out.replace(/<link rel="canonical" href="[\s\S]*?" \/>/, `<link rel="canonical" href="${url}" />`);
  out = rewriteSocialTags(out, { title, description, url, locale });
  out = rewriteOgImage(out, ogImageFor(route.path, locale), title);

  // `inLanguage` des JSON-LD génériques d'index.html (Organization, WebSite…).
  out = out.replace(/"inLanguage":\s*"[^"]*"/g, `"inLanguage": "${BCP47_TAG[locale]}"`);

  // hreflang : alternates réciproques + x-default.
  const links = hreflangLinks(route.path, alternates);
  if (links) out = out.replace('</head>', `    ${links}\n  </head>`);

  // JSON-LD spécifique à la route, injecté avant </head>.
  const extra = route.extraLd?.(locale) ?? [];
  if (extra.length) {
    out = out.replace('</head>', `    ${extra.map(({ obj, id }) => ld(obj, id)).join('\n    ')}\n  </head>`);
  }

  // Contenu indexable visible de la route, injecté dans #root.
  return injectStaticContent(out, requis(route.content[locale], `contenu de ${route.path} en « ${locale} »`), locale);
}
