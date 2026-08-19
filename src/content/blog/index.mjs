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
import { article as tableauDeBord } from './tableau-de-bord-productivite.mjs';
import { article as gestionDuTemps } from './gestion-du-temps-efficace.mjs';
import { article as suiviHabitudes } from './suivi-des-habitudes.mjs';

// Ordre = du plus récent au plus ancien (affichage index + sitemap).
export const ARTICLES = [
  tableauDeBord,
  gestionDuTemps,
  suiviHabitudes,
  eisenhower,
  okrVsSmart,
  glossaire,
  templateOkr,
  timeBlocking,
  tempsHabitude,
  methodeOkr,
  cosmoVsTodoist,
];

export const getArticle = (slug) => ARTICLES.find((a) => a.slug === slug);

/**
 * Suite de lecture d'un article : ses `related` déclarés, dans l'ordre.
 *
 * Le maillage interne est la seule redistribution d'autorité qu'on contrôle.
 * Il était auparavant calculé par récence (`ARTICLES.slice(0, 3)`), ce qui
 * envoyait les MÊMES 3 liens depuis les 11 articles : 4 articles ne recevaient
 * aucun lien entrant, dont `cosmo-vs-todoist`, la page à intention commerciale.
 *
 * Repli sur la récence si un slug est inconnu (article renommé ou retiré) —
 * la suite de lecture ne doit jamais se vider en silence.
 */
export const relatedArticles = (article, count = 3) => {
  const picked = (article.related ?? [])
    .map((slug) => ARTICLES.find((a) => a.slug === slug))
    .filter((a) => a && a.slug !== article.slug);
  const fillers = ARTICLES.filter(
    (a) => a.slug !== article.slug && !picked.some((p) => p.slug === a.slug)
  );
  return [...picked, ...fillers].slice(0, count);
};
