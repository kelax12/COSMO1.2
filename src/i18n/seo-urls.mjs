// Helpers d'URL localisées pour le SEO — partagés par `prerender.mjs`.
//
// En `.mjs` et non en `.ts` : `prerender.mjs` tourne dans Node brut, après
// `vite build`, sans bundler ni transpilation. Il ne peut pas importer du
// TypeScript. La table des slugs, elle, est lue depuis le MÊME
// `route-slugs.json` que `src/i18n/routes.ts` — c'est ce qui garantit que
// l'URL servie par l'app et l'URL déclarée canonique ne peuvent pas diverger.
//
// ─── Pourquoi INDEXABLE_LOCALES ≠ SUPPORTED_LOCALES ───
//
// « Servie » et « indexable » sont deux choses différentes. L'anglais est servi
// depuis la phase 2 (`/en/` répond), mais le CORPS des pages est encore
// français : seules les méta le sont. Laisser Google indexer ça produirait
// exactement le duplicate content que ce chantier cherche à éviter — du contenu
// français sur des URLs anglaises.
//
// Tant qu'une locale n'est pas ici, elle n'est ni prérendue, ni annoncée en
// `hreflang`, ni listée au sitemap, et `vercel.json` la met en `noindex`.
// La phase 5 (traduction du contenu long) l'ajoute et retire la règle Vercel —
// `npm run i18n:check` échoue si les deux ne sont pas cohérents.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const SITE_ORIGIN = 'https://thecosmo.app';

export const DEFAULT_LOCALE = 'fr';

/** Locales réellement indexables. Voir l'en-tête pour la distinction. */
export const INDEXABLE_LOCALES = ['fr'];

/** Étiquettes BCP 47 — miroir de `BCP47_TAG` dans src/i18n/locale.ts. */
export const BCP47_TAG = { fr: 'fr-FR', en: 'en-US', es: 'es-ES' };

/** Valeurs `og:locale` — miroir de `OG_LOCALE` dans src/i18n/locale.ts. */
export const OG_LOCALE = { fr: 'fr_FR', en: 'en_US', es: 'es_ES' };

export const ROUTE_SLUGS = JSON.parse(
  readFileSync(join(HERE, 'route-slugs.json'), 'utf8')
);

/** Index inverse `slug → routeId`, toutes langues confondues. */
const SLUG_TO_ROUTE = new Map();
for (const [routeId, byLocale] of Object.entries(ROUTE_SLUGS)) {
  for (const slug of Object.values(byLocale)) SLUG_TO_ROUTE.set(slug, routeId);
}

/** Slug d'une route publique dans une locale donnée. */
export function routeSlug(routeId, locale) {
  return ROUTE_SLUGS[routeId]?.[locale] ?? null;
}

/**
 * Chemin équivalent dans la locale cible — préfixe ajusté ET slug public
 * traduit. Doit produire exactement le même résultat que `localizePath` de
 * `src/i18n/routes.ts` (vérifié par src/i18n/seo-urls.test.mjs).
 */
export function localizePath(pathname, locale) {
  const segments = pathname.split('/').filter(Boolean);

  // Retire un éventuel préfixe de locale existant.
  if (segments.length > 0 && Object.keys(BCP47_TAG).includes(segments[0])) {
    segments.shift();
  }

  if (segments.length > 0) {
    const routeId = SLUG_TO_ROUTE.get(segments[0]);
    if (routeId) segments[0] = routeSlug(routeId, locale);
  }

  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  const body = segments.length > 0 ? `/${segments.join('/')}` : '';
  return `${prefix}${body || '/'}`;
}

/** URL absolue canonique d'un chemin dans une locale. */
export function canonicalUrl(pathname, locale) {
  return `${SITE_ORIGIN}${localizePath(pathname, locale)}`;
}

/**
 * Balises `<link rel="alternate" hreflang>` d'une page.
 *
 * Deux règles que Google applique sans indulgence :
 *   1. les alternates doivent être RÉCIPROQUES — chaque version déclare toutes
 *      les autres, elle-même comprise. Une déclaration unilatérale est
 *      silencieusement ignorée, et le groupe entier avec elle ;
 *   2. ne jamais déclarer une alternate vers une page qui n'existe pas. D'où
 *      `availableLocales` : les articles de blog restent français, ils ne
 *      reçoivent donc que `x-default`.
 *
 * `x-default` désigne la version servie à un visiteur dont la langue ne
 * correspond à aucune alternate — la locale par défaut.
 */
export function hreflangLinks(pathname, availableLocales = INDEXABLE_LOCALES) {
  const locales = availableLocales.filter((l) => INDEXABLE_LOCALES.includes(l));
  if (locales.length === 0) return '';

  const links = locales.map(
    (locale) =>
      `<link rel="alternate" hreflang="${BCP47_TAG[locale]}" href="${canonicalUrl(pathname, locale)}" />`
  );
  links.push(
    `<link rel="alternate" hreflang="x-default" href="${canonicalUrl(pathname, DEFAULT_LOCALE)}" />`
  );
  return links.join('\n    ');
}

/**
 * Entrées `<xhtml:link>` d'une URL de sitemap.
 *
 * Google exige les mêmes alternates réciproques dans le sitemap que dans le
 * `<head>` ; les omettre revient à ne pas déclarer le groupe du tout.
 */
export function sitemapAlternates(pathname, availableLocales = INDEXABLE_LOCALES) {
  const locales = availableLocales.filter((l) => INDEXABLE_LOCALES.includes(l));
  if (locales.length < 2) return '';

  return locales
    .map(
      (locale) =>
        `    <xhtml:link rel="alternate" hreflang="${BCP47_TAG[locale]}" href="${canonicalUrl(pathname, locale)}" />`
    )
    .join('\n');
}
