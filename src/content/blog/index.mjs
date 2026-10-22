// Registre des articles de blog, source de vérité unique, consommée par :
//  - React : BlogIndexPage + BlogArticlePage (via src/modules, imports Vite)
//  - prerender.mjs : génération des pages statiques /blog/* + sitemap
// ESM pur (pas de JSX, pas d'alias @/) pour rester importable par Node au build.
//
// ─── « Servie » et « indexable » sont deux questions différentes ───
//
// Ce fichier expose DEUX familles de lecture, et les confondre est exactement
// la faute que docs/SEO.md interdit :
//
//   - `articlesFor(locale)` / `localize()` sont STRICTS : une locale non
//     traduite rend `undefined`. C'est ce que lit le prérendu, le sitemap et le
//     flux RSS, donc il est impossible de publier une page anglaise dont le
//     corps serait resté français.
//   - `getArticle()` / `relatedArticles()` SERVENT la page à un visiteur et
//     retombent sur le français si la traduction manque, en disant laquelle
//     ils rendent (`contentLocale`). L'appelant s'en sert pour poser le bon
//     `lang` : afficher du français est acceptable, le déclarer anglais non.
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

// Miroir de `DEFAULT_LOCALE` (src/i18n/locale.ts). Recopié et non importé parce
// que ce module doit rester chargeable par Node brut depuis prerender.mjs, donc
// sans TypeScript. La parité est tenue par src/content/content-locales.test.ts.
const DEFAULT_LOCALE = 'fr';

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

/** `true` si l'article est réellement écrit dans cette langue. */
export const hasLocale = (article, locale) => Boolean(article?.locales?.[locale]);

/** Les langues dans lesquelles un article existe, ordre du registre. */
export const articleLocales = (article) => Object.keys(article?.locales ?? {});

/**
 * Article aplati dans une langue donnée : colonne vertébrale + champs traduits.
 * STRICT : rend `undefined` si l'article n'est pas écrit dans cette langue.
 */
export function localize(article, locale) {
  const translated = article?.locales?.[locale];
  if (!translated) return undefined;
  const { locales: _locales, ...spine } = article;
  return { ...spine, ...translated, contentLocale: locale };
}

/** Tous les articles écrits dans cette langue, dans l'ordre du registre. */
export const articlesFor = (locale) =>
  ARTICLES.map((a) => localize(a, locale)).filter(Boolean);

/**
 * Tous les articles À SERVIR dans cette langue : la liste ne rétrécit pas quand
 * une traduction manque, l'article est simplement rendu en français. C'est ce
 * que lit l'index du blog dans l'application ; le prérendu, lui, lit
 * `articlesFor()`, qui est strict.
 */
export const servedArticles = (locale = DEFAULT_LOCALE) =>
  ARTICLES.map((a) => localize(a, locale) ?? localize(a, DEFAULT_LOCALE));

/**
 * Article À SERVIR pour un slug : la langue demandée si elle existe, le
 * français sinon. `contentLocale` dit laquelle a été rendue, pour que
 * l'appelant pose le bon `lang` sur le corps de l'article.
 */
export function getArticle(slug, locale = DEFAULT_LOCALE) {
  const article = ARTICLES.find((a) => a.slug === slug);
  if (!article) return undefined;
  return localize(article, locale) ?? localize(article, DEFAULT_LOCALE);
}

/**
 * Suite de lecture d'un article : ses `related` déclarés, dans l'ordre.
 *
 * Le maillage interne est la seule redistribution d'autorité qu'on contrôle.
 * Il était auparavant calculé par récence (`ARTICLES.slice(0, 3)`), ce qui
 * envoyait les MÊMES 3 liens depuis les 11 articles : 4 articles ne recevaient
 * aucun lien entrant, dont `cosmo-vs-todoist`, la page à intention commerciale.
 *
 * Repli sur la récence si un slug est inconnu (article renommé ou retiré) :
 * la suite de lecture ne doit jamais se vider en silence.
 *
 * La langue ne change PAS le maillage : le graphe de liens est celui de la
 * publication, pas celui d'une traduction. Un article dont la version anglaise
 * n'existe pas encore reste donc cité, servi en français, plutôt que de faire
 * rétrécir la suite de lecture d'une langue à l'autre.
 */
export function relatedArticles(article, locale = DEFAULT_LOCALE, count = 3) {
  const picked = (article.related ?? [])
    .map((slug) => ARTICLES.find((a) => a.slug === slug))
    .filter((a) => a && a.slug !== article.slug);
  const fillers = ARTICLES.filter(
    (a) => a.slug !== article.slug && !picked.some((p) => p.slug === a.slug)
  );
  return [...picked, ...fillers]
    .slice(0, count)
    .map((a) => localize(a, locale) ?? localize(a, DEFAULT_LOCALE));
}
