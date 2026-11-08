// Types de `seo-urls.mjs` (en JS pur pour rester importable par le prerendu
// sous Node, sans bundler : meme convention que `src/lib/contact.mjs`).
import type { Locale } from '@/i18n/locale';

export declare const SITE_ORIGIN: string;
export declare const DEFAULT_LOCALE: Locale;
/** Locales reellement indexables (l'ensemble des locales servies peut etre plus large). */
export declare const INDEXABLE_LOCALES: Locale[];
export declare const BCP47_TAG: Record<Locale, string>;
export declare const OG_LOCALE: Record<Locale, string>;
export declare const ROUTE_SLUGS: Record<string, Partial<Record<Locale, string>>>;
export declare function routeSlug(routeId: string, locale: Locale): string;
export declare function localizePath(pathname: string, locale: Locale): string;
export declare function canonicalUrl(pathname: string, locale: Locale): string;
/** Les `<link rel="alternate" hreflang>` d'une page ; chaine vide si aucune locale. */
export declare function hreflangLinks(pathname: string, availableLocales?: Locale[]): string;
/** Les `<xhtml:link>` d'une URL de sitemap ; chaine vide sous deux locales. */
export declare function sitemapAlternates(pathname: string, availableLocales?: Locale[]): string;
