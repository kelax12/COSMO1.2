// Types du registre blog (index.mjs est en JS pur pour rester importable
// par prerender.mjs sous Node — les types vivent ici).
export interface BlogArticle {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  datePublished: string;
  dateModified: string;
  readingMinutes: number;
  /** Paires [question, réponse] — FAQPage JSON-LD généré par prerender.mjs */
  faq?: [string, string][];
  html: string;
}

export declare const ARTICLES: BlogArticle[];
export declare const getArticle: (slug: string) => BlogArticle | undefined;
