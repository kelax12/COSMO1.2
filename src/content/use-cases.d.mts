// Types du registre use-cases (use-cases.mjs est en JS pur pour rester
// importable par prerender.mjs sous Node).
import type { Locale } from '@/i18n/locale';

/** Ce qui se traduit d'une page cas d'usage. */
export interface UseCaseContent {
  audience: string;
  title: string;
  metaTitle: string;
  description: string;
  lead: string;
  html: string;
}

/**
 * Une page cas d'usage, identifiée par son `routeId` et JAMAIS par son slug :
 * les slugs vivent dans src/i18n/route-slugs.json, seule table, pour que l'URL
 * servie et l'URL déclarée canonique ne puissent pas diverger.
 */
export interface UseCase {
  routeId: string;
  /** Date de dernière modification du contenu (`lastmod` du sitemap). */
  dateModified: string;
  locales: Partial<Record<Locale, UseCaseContent>>;
}

export declare const USE_CASES: UseCase[];
export declare const getUseCase: (routeId: string) => UseCase | undefined;
