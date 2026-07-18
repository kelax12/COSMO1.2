// Registre des articles de blog — source de vérité unique, consommée par :
//  - React : BlogIndexPage + BlogArticlePage (via src/modules — imports Vite)
//  - prerender.mjs : génération des pages statiques /blog/* + sitemap
// ESM pur (pas de JSX, pas d'alias @/) pour rester importable par Node au build.
import { article as methodeOkr } from './methode-okr-exemples.mjs';
import { article as cosmoVsTodoist } from './cosmo-vs-todoist.mjs';
import { article as timeBlocking } from './time-blocking-guide.mjs';
import { article as tempsHabitude } from './combien-de-temps-habitude.mjs';
import { article as templateOkr } from './template-okr-gratuit.mjs';
import { article as eisenhower } from './matrice-eisenhower.mjs';
import { article as okrVsSmart } from './okr-vs-smart-vs-kpi.mjs';
import { article as glossaire } from './glossaire-productivite.mjs';

// Ordre = du plus récent au plus ancien (affichage index + sitemap).
export const ARTICLES = [eisenhower, okrVsSmart, glossaire, templateOkr, timeBlocking, tempsHabitude, methodeOkr, cosmoVsTodoist];

export const getArticle = (slug) => ARTICLES.find((a) => a.slug === slug);
