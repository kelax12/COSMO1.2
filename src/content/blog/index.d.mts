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
  html: string;
}

export declare const ARTICLES: BlogArticle[];
export declare const getArticle: (slug: string) => BlogArticle | undefined;
