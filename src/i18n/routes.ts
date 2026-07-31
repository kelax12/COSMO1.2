// Chemins localisés — préfixe de locale + slugs publics traduits.
//
// Deux règles structurent tout ce module :
//
//   1. `DEFAULT_LOCALE` n'est JAMAIS préfixée. `/tasks` est français,
//      `/en/tasks` anglais. `/fr/tasks` existe mais doit être canonicalisé vers
//      `/tasks` par le routeur (sinon duplicate content côté SEO).
//   2. Seuls les slugs PUBLICS indexables sont traduits. Les routes applicatives
//      (`/tasks`, `/settings`…) et les routes techniques (`/login`,
//      `/invite/:token`) gardent le même segment dans toutes les langues :
//      elles ne sont pas indexées, et un slug stable évite de casser des liens.

import {
  ALL_LOCALES,
  DEFAULT_LOCALE,
  isLocale,
  localeFromPathname,
  type Locale,
} from './locale';

import routeSlugs from './route-slugs.json';

export { localeFromPathname };

/**
 * Slugs publics traduits, par identifiant de route.
 *
 * La table vit dans un `.json` et non ici : `prerender.mjs` (Node brut, sans
 * bundler) doit lire EXACTEMENT les mêmes slugs pour produire `canonical` et
 * `hreflang`. Deux tables tenues à la main finiraient par diverger, et une
 * divergence entre l'URL servie par l'app et l'URL déclarée canonique est
 * précisément le genre de bug SEO qu'on ne voit qu'en Search Console, des
 * semaines plus tard.
 *
 * Ajouter une entrée ici ne suffit pas : la route doit aussi être déclarée dans
 * `src/App.tsx`. `npm run i18n:check` vérifie la cohérence.
 */
export const ROUTE_SLUGS = routeSlugs satisfies Record<string, Record<Locale, string>>;

export type RouteId = keyof typeof ROUTE_SLUGS;

/** Slug d'une route publique dans une locale donnée. */
export function routeSlug(routeId: RouteId, locale: Locale): string {
  return ROUTE_SLUGS[routeId][locale];
}

/**
 * Index inverse `slug → routeId`, toutes locales confondues.
 *
 * Permet à `localizePath` de traduire `/a-propos` en `/en/about` sans que
 * l'appelant sache de quelle route il s'agit — ce dont a besoin le sélecteur de
 * langue, qui doit rester sur la page courante.
 */
const SLUG_TO_ROUTE: ReadonlyMap<string, RouteId> = (() => {
  const map = new Map<string, RouteId>();
  for (const routeId of Object.keys(ROUTE_SLUGS) as RouteId[]) {
    for (const locale of ALL_LOCALES) {
      map.set(ROUTE_SLUGS[routeId][locale], routeId);
    }
  }
  return map;
})();

/** `routeId` correspondant à un slug, quelle que soit sa langue. */
export function routeIdFromSlug(slug: string): RouteId | null {
  return SLUG_TO_ROUTE.get(slug) ?? null;
}

/**
 * Retire le préfixe de locale d'un chemin.
 *
 * `/en/tasks` → `{ locale: 'en', path: '/tasks' }`
 * `/tasks`    → `{ locale: null, path: '/tasks' }`
 */
export function stripLocalePrefix(pathname: string): { locale: Locale | null; path: string } {
  const locale = localeFromPathname(pathname);
  if (!locale) return { locale: null, path: normalizePath(pathname) };
  const rest = pathname.replace(/^\/[^/]+/, '');
  return { locale, path: normalizePath(rest) };
}

function normalizePath(path: string): string {
  if (!path || path === '/') return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Chemin équivalent dans la locale cible : préfixe ajusté ET slug public
 * traduit s'il y en a un.
 *
 * `localizePath('/a-propos', 'en')` → `/en/about`
 * `localizePath('/en/tasks', 'fr')` → `/tasks`
 *
 * Idempotente : appliquer deux fois la même locale ne change rien. Les query
 * strings et fragments passés dans le chemin sont préservés tels quels.
 */
export function localizePath(pathname: string, locale: Locale): string {
  // Fonction de chemin PURE : elle sait construire l'URL de n'importe quelle
  // locale connue. Refuser une locale non encore ouverte est le rôle du routeur
  // et de `LocaleLink`, pas celui du calcul de chemin.
  if (!isLocale(locale)) return pathname;

  const [pathOnly, suffix] = splitSuffix(pathname);
  const { path } = stripLocalePrefix(pathOnly);

  const segments = path.split('/').filter(Boolean);
  if (segments.length > 0) {
    const routeId = routeIdFromSlug(segments[0]);
    if (routeId) segments[0] = routeSlug(routeId, locale);
  }

  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  const body = segments.length > 0 ? `/${segments.join('/')}` : '';
  return `${prefix}${body || '/'}${suffix}`;
}

/** Sépare `?query#hash` du chemin, pour les réinjecter intacts. */
function splitSuffix(pathname: string): [string, string] {
  const index = pathname.search(/[?#]/);
  if (index === -1) return [pathname, ''];
  return [pathname.slice(0, index), pathname.slice(index)];
}

/**
 * URL absolue canonique d'un chemin dans une locale — `canonical` et `hreflang`
 * du prérendu comme du runtime doivent produire exactement la même chaîne.
 */
export const SITE_ORIGIN = 'https://thecosmo.app';

export function canonicalUrl(pathname: string, locale: Locale): string {
  const path = localizePath(pathname, locale);
  return `${SITE_ORIGIN}${path === '/' ? '/' : path}`;
}
