// Types du registre blog (index.mjs est en JS pur pour rester importable
// par prerender.mjs sous Node — les types vivent ici).
import type { Locale } from '@/i18n/locale';

/** Ce qui se traduit d'un article. */
export interface BlogArticleContent {
  title: string;
  metaTitle: string;
  description: string;
  readingMinutes: number;
  /** Paires [question, réponse] — FAQPage JSON-LD généré par prerender.mjs */
  faq?: [string, string][];
  html: string;
}

/**
 * Une publication : sa colonne vertébrale commune à toutes les langues, plus
 * ses traductions. `slug`, dates et `related` ne sont PAS traduits, c'est le
 * même article.
 */
export interface BlogArticle {
  slug: string;
  datePublished: string;
  dateModified: string;
  /** Slugs de la suite de lecture, par proximité de sujet (maillage interne). */
  related?: string[];
  locales: Partial<Record<Locale, BlogArticleContent>>;
}

/** Article aplati dans une langue : la forme que consomment les pages. */
export type LocalizedArticle = Omit<BlogArticle, 'locales'> &
  BlogArticleContent & {
    /** Langue RÉELLEMENT rendue, qui peut différer de celle demandée. */
    contentLocale: Locale;
  };

export declare const ARTICLES: BlogArticle[];
export declare const hasLocale: (article: BlogArticle, locale: Locale) => boolean;
export declare const articleLocales: (article: BlogArticle) => Locale[];
/** STRICT : `undefined` si l'article n'est pas écrit dans cette langue. */
export declare const localize: (
  article: BlogArticle,
  locale: Locale
) => LocalizedArticle | undefined;
/** STRICT : les articles réellement écrits dans cette langue. */
export declare const articlesFor: (locale: Locale) => LocalizedArticle[];
/** SERVI : tous les articles, repli français compris. */
export declare const servedArticles: (locale?: Locale) => LocalizedArticle[];
/** SERVI : repli sur le français, `contentLocale` dit ce qui est rendu. */
export declare const getArticle: (
  slug: string,
  locale?: Locale
) => LocalizedArticle | undefined;
export declare const relatedArticles: (
  article: BlogArticle | LocalizedArticle,
  locale?: Locale,
  count?: number
) => LocalizedArticle[];
