// Constantes, catalogues SEO et dates de contenu du prérendu.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Locale } from '@/i18n/locale';
import { INDEXABLE_LOCALES } from '../src/i18n/seo-urls.mjs';
import type { LocaleMeta, SeoMeta } from './types.ts';

/** Racine du dépôt : le prérendu s'exécute depuis `prerender/`. */
export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const DIST = join(ROOT, 'dist');
export const BASE = 'https://thecosmo.app';

/** Mêmes fichiers que ceux de l'app (src/lib/useSeoMeta.ts) : un titre ne diffère pas. */
const SEO: Partial<Record<Locale, Record<string, SeoMeta>>> = Object.fromEntries(
  INDEXABLE_LOCALES.map((locale) => [
    locale,
    JSON.parse(readFileSync(join(ROOT, 'src/locales', locale, 'seo.json'), 'utf8')),
  ])
);

/** Méta d'une route dans une locale, ou `null` si non traduite. */
export const seoFor = (routeId: string, locale: Locale): SeoMeta | null =>
  SEO[locale]?.[routeId] ?? null;

/** Métadonnées tirées des catalogues `src/locales/<locale>/seo.json`. */
export const fromCatalog = (routeId: string): LocaleMeta => {
  const meta: LocaleMeta = {};
  for (const locale of INDEXABLE_LOCALES) {
    const found = seoFor(routeId, locale);
    if (found) meta[locale] = found;
  }
  return meta;
};

/**
 * `{ locale → valeur }` pour les seules langues où l'article ou le cas d'usage
 * est réellement écrit : une langue absente du registre n'est ni prérendue, ni
 * déclarée en `hreflang`, ni listée au sitemap.
 */
export const byLocale = <C, V>(
  entry: { locales: Partial<Record<Locale, C>> },
  build: (content: C, locale: Locale) => V
): Partial<Record<Locale, V>> =>
  Object.fromEntries(
    INDEXABLE_LOCALES.filter((locale) => entry.locales[locale]).map((locale) => [
      locale,
      build(entry.locales[locale] as C, locale),
    ])
  );

/** Date de build : UNIQUEMENT pour le `lastBuildDate` du flux RSS. */
export const TODAY = new Date().toISOString().slice(0, 10);

/**
 * Dates de contenu (`lastmod` du sitemap, `dateModified` des JSON-LD).
 *
 * 🔴 Ne JAMAIS y remettre la date du build : un sitemap qui déclare « tout a
 * changé aujourd'hui » à chaque déploiement apprend à Google à ignorer le champ,
 * et un `dateModified` qui avance sans que la copie bouge est un faux signal.
 * Articles et cas d'usage portent déjà leur date dans leur registre ; ne restent
 * ici que les pages dont le corps vit dans `prerender/content/` : à mettre à
 * jour quand on retouche leur copie.
 */
export const CONTENT_LASTMOD = {
  site: '2026-08-17', // JSON-LD global (SoftwareApplication, Organization)
  '/': '2026-08-17',
  '/guide': '2026-10-12',
  '/a-propos': '2026-08-03',
  '/entreprise-presentation': '2026-10-02',
} as const;
