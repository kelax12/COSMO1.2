// Registre des articles de blog — source de vérité unique, consommée par :
//  - React : BlogIndexPage + BlogArticlePage (via src/modules — imports Vite)
//  - prerender.mjs : génération des pages statiques /blog/* + sitemap
// ESM pur (pas de JSX, pas d'alias @/) pour rester importable par Node au build.
import { article as methodeOkr } from './methode-okr-exemples.mjs';
import { article as cosmoVsTodoist } from './cosmo-vs-todoist.mjs';

// Ordre = du plus récent au plus ancien (affichage index + sitemap).
export const ARTICLES = [methodeOkr, cosmoVsTodoist];

export const getArticle = (slug) => ARTICLES.find((a) => a.slug === slug);
