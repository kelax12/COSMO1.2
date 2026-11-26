// Les routes tirées des registres de contenu : index du blog, articles de blog,
// pages cas d'usage (src/content/blog, src/content/use-cases.mjs).
//
// Une langue n'est publiée que si l'article ou le cas d'usage y est réellement
// écrit : les `hreflang` en sont dérivés, ils ne peuvent donc pas annoncer une
// page qui n'existe pas (erreur Search Console), ni une page anglaise au corps
// français. Le slug, lui, est celui de la publication et ne se traduit pas.
import type { Locale } from '@/i18n/locale';
import { ARTICLES, BLOG_AUTHOR, articlesFor, relatedArticles } from '../src/content/blog/index.mjs';
import type { BlogArticle } from '../src/content/blog/index.mjs';
import { USE_CASES } from '../src/content/use-cases.mjs';
import type { UseCase } from '../src/content/use-cases.mjs';
import {
  BCP47_TAG,
  DEFAULT_LOCALE,
  INDEXABLE_LOCALES,
  canonicalUrl,
  localizePath,
  routeSlug,
} from '../src/i18n/seo-urls.mjs';
import { uiFor } from './chrome.ts';
import { BASE, byLocale, fromCatalog } from './config.ts';
import { breadcrumb, ogImageFor } from './ld.ts';
import { requis, type LdEntry, type LocaleContent, type Route } from './types.ts';

const ORGANISATION = { '@type': 'Organization', name: 'Cosmo', url: BASE };

// ── Index du blog ────────────────────────────────────────────────────────

/**
 * Chaque article sort en <h2> plutôt qu'en <li> : l'index n'avait AUCUN titre de
 * niveau 2 dans le HTML prérendu, donc aucune structure exploitable pour un
 * crawler sans JS.
 */
function blogIndexContent(): LocaleContent {
  return Object.fromEntries(
    (INDEXABLE_LOCALES as Locale[])
      .map((locale): [Locale, string | null] => {
        const posts = articlesFor(locale);
        if (posts.length === 0) return [locale, null];
        const u = uiFor(locale);
        const at = (path: string) => localizePath(path, locale);
        return [
          locale,
          `<h1>${u.blogTitle}</h1>
        <p>${u.blogIntro(posts.length)}</p>
        ${posts
          .map(
            (a) => `<h2><a href="${at(`/blog/${a.slug}`)}">${a.title}</a></h2>
        <p>${a.description} <a href="${at(`/blog/${a.slug}`)}">${u.readArticle}</a>, ${u.readingTime(a.readingMinutes)}.</p>`
          )
          .join('\n        ')}
        <p><a href="${at('/')}">${u.home}</a> · <a href="${at('/signup')}">${u.signup}</a> · <a href="/rss.xml">${u.rss}</a></p>`,
        ];
      })
      .filter(([, content]) => content)
  );
}

/** Le schéma Blog ne liste QUE les articles écrits dans la langue de la page. */
function blogIndexLd(locale: Locale): LdEntry[] {
  return [
    { obj: breadcrumb('Blog', '/blog', locale), id: 'blog-breadcrumb' },
    {
      obj: {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'Blog Cosmo',
        url: canonicalUrl('/blog', locale),
        inLanguage: BCP47_TAG[locale],
        publisher: ORGANISATION,
        blogPost: articlesFor(locale).map((a) => ({
          '@type': 'BlogPosting',
          headline: a.title,
          image: ogImageFor(`/blog/${a.slug}`, locale),
          url: canonicalUrl(`/blog/${a.slug}`, locale),
          datePublished: a.datePublished,
        })),
      },
      id: 'blog-schema',
    },
  ];
}

export const BLOG_INDEX_ROUTE: Route = {
  path: '/blog',
  copy: 'blog',
  meta: fromCatalog('blog'),
  extraLd: blogIndexLd,
  content: blogIndexContent(),
};

// ── Galerie des modèles (plan SEO C5) ───────────────────────────────

const GALERIE = {
  fr: { titre: 'Modèles gratuits : OKR, routines et plannings', intro: 'Des modèles prêts à remplir, avec un exemple complet et les erreurs à éviter. Gratuits, sans inscription, à recopier ou à utiliser directement dans Cosmo.', cat: { okr: 'Modèles OKR', habitudes: 'Routines et habitudes', planning: 'Plannings', methode: 'Méthodes' } },
  en: { titre: 'Free templates: OKRs, routines and planners', intro: 'Ready-to-fill templates, each with a complete example and the mistakes to avoid. Free, no sign-up, to copy or to use directly in Cosmo.', cat: { okr: 'OKR templates', habitudes: 'Routines and habits', planning: 'Planners', methode: 'Methods' } },
} as const;

function templatesIndexContent(): LocaleContent {
  return Object.fromEntries(
    (Object.keys(GALERIE) as (keyof typeof GALERIE)[])
      .map((locale): [Locale, string | null] => {
        const modeles = articlesFor(locale).filter((a) => a.kind === 'modele');
        if (modeles.length === 0) return [locale, null];
        const g = GALERIE[locale];
        const at = (path: string) => localizePath(path, locale);
        const sections = (Object.keys(g.cat) as (keyof typeof g.cat)[])
          .map((c) => {
            const liste = modeles.filter((a) => a.categorie === c);
            if (!liste.length) return '';
            return `<h2>${g.cat[c]}</h2>
        ${liste.map((a) => `<h3><a href="${at(`/blog/${a.slug}`)}">${a.title}</a></h3>
        <p>${a.description}</p>`).join('\n        ')}`;
          })
          .filter(Boolean)
          .join('\n        ');
        return [locale, `<h1>${g.titre}</h1>
        <p>${g.intro}</p>
        ${sections}
        <p><a href="${at('/')}">${uiFor(locale).home}</a> · <a href="${at('/blog')}">${uiFor(locale).blog}</a> · <a href="${at('/signup')}">${uiFor(locale).signup}</a></p>`];
      })
      .filter(([, content]) => content)
  );
}

export const TEMPLATES_INDEX_ROUTE: Route = {
  path: '/modeles',
  copy: 'templates',
  meta: fromCatalog('templates'),
  extraLd: (locale) => [{ obj: breadcrumb(GALERIE[locale as keyof typeof GALERIE]?.titre ?? 'Modèles', '/modeles', locale), id: 'modeles-breadcrumb' }],
  content: templatesIndexContent(),
};

// ── Outils gratuits (plan SEO C7) ────────────────────────────────────

export const HABITTRACKERTOOL_ROUTE: Route = {
  path: '/habit-tracker-personnalise',
  copy: 'habitTrackerTool',
  meta: fromCatalog('habitTrackerTool'),
  extraLd: (locale) => [
    { obj: breadcrumb(locale === 'en' ? "Custom printable habit tracker" : "Habit tracker personnalisé à imprimer", '/habit-tracker-personnalise', locale), id: 'habitTrackerTool-breadcrumb' },
    {
      obj: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: locale === 'en' ? "Custom printable habit tracker" : "Habit tracker personnalisé à imprimer",
        url: canonicalUrl('/habit-tracker-personnalise', locale),
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Web',
        inLanguage: BCP47_TAG[locale],
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        publisher: ORGANISATION,
      },
      id: 'habitTrackerTool-app',
    },
  ],
  content: {
  "fr": "<h1>Habit tracker personnalisé à imprimer</h1>\n        <p>Un outil gratuit, sans inscription, pour créer votre propre habit tracker : choisissez le mois, écrivez jusqu'à huit habitudes, et imprimez une grille prête à cocher, avec les week-ends repérés et une colonne de total.</p>\n        <h2>Comment s'en servir</h2>\n        <p>Commencez avec deux ou trois habitudes dans leur version minimale, accrochées à un moment précis de la journée. Cochez une case par jour réussi, au moment même. À la fin du mois, notez les totaux et changez un seul réglage pour le mois suivant. Ne ratez jamais deux jours de suite.</p>\n        <p>Pour aller plus loin : <a href=\"/blog/habit-tracker-a-imprimer\">le habit tracker 2027 en PDF</a> · <a href=\"/blog/suivi-des-habitudes\">ce qu'il faut mesurer</a> · <a href=\"/signup\">créer un compte gratuit</a></p>",
  "en": "<h1>Custom printable habit tracker</h1>\n        <p>A free tool, no sign-up, to build your own habit tracker: pick the month, write up to eight habits, and print a grid ready to tick, with weekends marked and a total column.</p>\n        <h2>How to use it</h2>\n        <p>Start with two or three habits in their minimal version, attached to a specific moment of the day. Tick one box for every successful day, right when it happens. At the end of the month, note the totals and change a single thing for next month. Never miss two days in a row.</p>\n        <p>Go further: <a href=\"/en/blog/habit-tracker-a-imprimer\">the 2027 habit tracker PDF</a> · <a href=\"/en/blog/suivi-des-habitudes\">what to measure</a> · <a href=\"/en/signup\">create a free account</a></p>"
},
};

export const WEEKLYPLANNERTOOL_ROUTE: Route = {
  path: '/planning-semaine-en-ligne',
  copy: 'weeklyPlannerTool',
  meta: fromCatalog('weeklyPlannerTool'),
  extraLd: (locale) => [
    { obj: breadcrumb(locale === 'en' ? "Weekly planner online" : "Planning de semaine en ligne", '/planning-semaine-en-ligne', locale), id: 'weeklyPlannerTool-breadcrumb' },
    {
      obj: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: locale === 'en' ? "Weekly planner online" : "Planning de semaine en ligne",
        url: canonicalUrl('/planning-semaine-en-ligne', locale),
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Web',
        inLanguage: BCP47_TAG[locale],
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        publisher: ORGANISATION,
      },
      id: 'weeklyPlannerTool-app',
    },
  ],
  content: {
  "fr": "<h1>Planning de semaine en ligne</h1>\n        <p>Un outil gratuit, sans inscription, pour organiser votre semaine en time-blocking : une grille de sept jours de 7 h à 19 h, où chaque case reçoit un bloc de travail, une réunion ou une pause. Imprimable, et enregistré dans votre navigateur.</p>\n        <h2>Comment s'en servir</h2>\n        <p>Placez d'abord les blocs de travail profond aux heures où vous êtes le plus efficace, regroupez les réunions, gardez une marge chaque jour, puis remplissez les créneaux restants avec les tâches courtes. Chaque soir, ajustez le lendemain.</p>\n        <p>Pour aller plus loin : <a href=\"/blog/time-blocking-guide\">le guide du time-blocking</a> · <a href=\"/blog/planning-semaine-time-blocking\">une semaine type à copier</a> · <a href=\"/signup\">créer un compte gratuit</a></p>",
  "en": "<h1>Weekly planner online</h1>\n        <p>A free tool, no sign-up, to plan your week with time blocking: a seven-day grid from 7 am to 7 pm, where each slot takes a work block, a meeting or a break. Printable, and saved in your browser.</p>\n        <h2>How to use it</h2>\n        <p>Place deep work blocks first, at the hours when you work best, group your meetings, keep a buffer every day, then fill the remaining slots with short tasks. Each evening, adjust the next day.</p>\n        <p>Go further: <a href=\"/en/blog/time-blocking-guide\">the time blocking guide</a> · <a href=\"/en/blog/planning-semaine-time-blocking\">a typical week to copy</a> · <a href=\"/en/signup\">create a free account</a></p>"
},
};

export const POMODOROTOOL_ROUTE: Route = {
  path: '/minuteur-pomodoro',
  copy: 'pomodoroTool',
  meta: fromCatalog('pomodoroTool'),
  extraLd: (locale) => [
    { obj: breadcrumb(locale === 'en' ? "Pomodoro timer" : "Minuteur Pomodoro", '/minuteur-pomodoro', locale), id: 'pomodoroTool-breadcrumb' },
    {
      obj: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: locale === 'en' ? "Pomodoro timer" : "Minuteur Pomodoro",
        url: canonicalUrl('/minuteur-pomodoro', locale),
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Web',
        inLanguage: BCP47_TAG[locale],
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        publisher: ORGANISATION,
      },
      id: 'pomodoroTool-app',
    },
  ],
  content: {
  "fr": "<h1>Minuteur Pomodoro en ligne</h1>\n        <p>Un minuteur Pomodoro gratuit, sans inscription : 25 minutes de travail sur une seule tâche, 5 minutes de pause, et une pause longue de 15 minutes toutes les quatre sessions. Indiquez la tâche en cours, le minuteur compte vos sessions de la journée.</p>\n        <h2>Comment s'en servir</h2>\n        <p>Choisissez une seule tâche, lancez le minuteur et ne faites rien d'autre jusqu'à la sonnerie. Pendant la pause, levez-vous. Notez les interruptions au lieu d'y céder, et traitez-les à la pause suivante.</p>\n        <p>Pour aller plus loin : <a href=\"/blog/gestion-du-temps-efficace\">gestion du temps efficace</a> · <a href=\"/blog/time-blocking-guide\">le time-blocking</a> · <a href=\"/signup\">créer un compte gratuit</a></p>",
  "en": "<h1>Online Pomodoro timer</h1>\n        <p>A free Pomodoro timer, no sign-up: 25 minutes of work on a single task, a 5-minute break, and a 15-minute long break every four sessions. Note the current task and the timer counts your sessions for the day.</p>\n        <h2>How to use it</h2>\n        <p>Pick a single task, start the timer and do nothing else until it rings. During the break, get up. Write interruptions down instead of giving in to them, and handle them at the next break.</p>\n        <p>Go further: <a href=\"/en/blog/gestion-du-temps-efficace\">effective time management</a> · <a href=\"/en/blog/time-blocking-guide\">time blocking</a> · <a href=\"/en/signup\">create a free account</a></p>"
},
};

export const OKR_GENERATOR_ROUTE: Route = {
  path: '/generateur-okr',
  copy: 'okrGeneratorTool',
  meta: fromCatalog('okrGeneratorTool'),
  extraLd: (locale) => [
    { obj: breadcrumb(locale === 'en' ? 'OKR generator' : "Générateur d'OKR", '/generateur-okr', locale), id: 'outil-okr-breadcrumb' },
    {
      obj: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: locale === 'en' ? 'Free OKR generator' : "Générateur d'OKR gratuit",
        url: canonicalUrl('/generateur-okr', locale),
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Web',
        inLanguage: BCP47_TAG[locale],
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        publisher: ORGANISATION,
      },
      id: 'outil-okr-app',
    },
  ],
  content: {
  "fr": "<h1>Générateur d'OKR gratuit</h1>\n        <p>Un outil gratuit, sans inscription, pour écrire vos OKR en quelques minutes : choisissez un domaine (forme, études, freelance, carrière, argent, marketing, produit, management), formulez votre objectif, puis choisissez jusqu'à cinq résultats clés proposés, avec leur valeur de départ et leur cible. Vous pouvez copier ou imprimer le résultat, ou le suivre dans Cosmo.</p>\n        <h2>Comment écrire un bon OKR</h2>\n        <p>L'objectif dit où vous voulez aller, en mots et sans chiffre. Les résultats clés disent comment vous saurez que vous y êtes : chacun est un nombre, avec une unité, une valeur de départ et une cible que vous pensez atteindre avec 50 à 70 % de chances. Deux à quatre résultats clés suffisent, sur un trimestre.</p>\n        <h2>D'où viennent les propositions</h2>\n        <p>Les résultats clés proposés sont rédigés à la main à partir d'exemples d'OKR réels, domaine par domaine. Ce sont des points de départ : ajustez le libellé, le départ et la cible à votre situation.</p>\n        <p>Pour aller plus loin : <a href=\"/blog/methode-okr-exemples\">la méthode OKR, avec 15 exemples</a> · <a href=\"/blog/template-okr-gratuit\">template OKR gratuit (Excel)</a> · <a href=\"/modeles\">modèles gratuits</a> · <a href=\"/signup\">créer un compte gratuit</a></p>",
  "en": "<h1>Free OKR generator</h1>\n        <p>A free tool, no sign-up, to write your OKRs in a few minutes: pick an area (fitness, studies, freelancing, career, money, marketing, product, management), phrase your objective, then choose up to five suggested key results, with their starting value and target. Copy or print the result, or track it in Cosmo.</p>\n        <h2>How to write a good OKR</h2>\n        <p>The objective says where you want to go, in words and without numbers. The key results say how you will know you got there: each one is a number, with a unit, a starting value and a target you think you have a 50 to 70% chance of hitting. Two to four key results are enough, over a quarter.</p>\n        <h2>Where the suggestions come from</h2>\n        <p>The suggested key results are written by hand from real OKR examples, area by area. They are starting points: adjust the wording, starting value and target to your situation.</p>\n        <p>Go further: <a href=\"/en/blog/methode-okr-exemples\">the OKR method, with 15 examples</a> · <a href=\"/en/blog/template-okr-gratuit\">free OKR template (Excel)</a> · <a href=\"/en/templates\">free templates</a> · <a href=\"/en/signup\">create a free account</a></p>"
},
};

export const EISENHOWER_TOOL_ROUTE: Route = {
  path: '/matrice-eisenhower-en-ligne',
  copy: 'eisenhowerTool',
  meta: fromCatalog('eisenhowerTool'),
  extraLd: (locale) => [
    { obj: breadcrumb(locale === 'en' ? 'Eisenhower matrix online' : "Matrice d'Eisenhower en ligne", '/matrice-eisenhower-en-ligne', locale), id: 'outil-eisenhower-breadcrumb' },
    {
      obj: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: locale === 'en' ? 'Eisenhower matrix online' : "Matrice d'Eisenhower en ligne",
        url: canonicalUrl('/matrice-eisenhower-en-ligne', locale),
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Web',
        inLanguage: BCP47_TAG[locale],
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        publisher: ORGANISATION,
      },
      id: 'outil-eisenhower-app',
    },
  ],
  content: {
  "fr": "<h1>Matrice d'Eisenhower en ligne</h1>\n        <p>Un outil gratuit, sans inscription, pour classer vos tâches dans les quatre cases de la matrice d'Eisenhower : urgent et important, important mais pas urgent, urgent mais pas important, ni urgent ni important. Vos tâches restent dans votre navigateur ; vous pouvez imprimer la matrice ou l'enregistrer dans Cosmo.</p>\n        <h2>Comment utiliser la matrice</h2>\n        <p>Écrivez une tâche, choisissez sa case, ajoutez-la. Commencez par vider votre tête : toutes les tâches de la semaine, sans trier. Puis demandez-vous pour chacune : est-ce que cela me rapproche de mes objectifs (important) ? Est-ce que cela doit être fait aujourd'hui ou demain (urgent) ?</p>\n        <h2>Que faire de chaque case</h2>\n        <p>Urgent et important : à faire tout de suite. Important mais pas urgent : à planifier dans l'agenda, c'est la case qui fait avancer vos objectifs. Urgent mais pas important : à déléguer ou à traiter en bloc. Ni urgent ni important : à abandonner.</p>\n        <p>Pour aller plus loin : <a href=\"/blog/matrice-eisenhower\">la matrice d'Eisenhower expliquée, avec des exemples</a> · <a href=\"/modeles\">modèles gratuits</a> · <a href=\"/signup\">créer un compte gratuit</a></p>",
  "en": "<h1>Eisenhower matrix online</h1>\n        <p>A free tool, no sign-up, to sort your tasks into the four boxes of the Eisenhower matrix: urgent and important, important but not urgent, urgent but not important, neither urgent nor important. Your tasks stay in your browser; you can print the matrix or save it in Cosmo.</p>\n        <h2>How to use the matrix</h2>\n        <p>Type a task, pick its box, add it. Start by emptying your head: every task for the week, without sorting. Then ask of each one: does this move me towards my goals (important)? Does it have to be done today or tomorrow (urgent)?</p>\n        <h2>What to do with each box</h2>\n        <p>Urgent and important: do it now. Important but not urgent: schedule it in your calendar, this is the box that moves your goals forward. Urgent but not important: delegate it or handle it in a batch. Neither urgent nor important: drop it.</p>\n        <p>Go further: <a href=\"/en/blog/matrice-eisenhower\">the Eisenhower matrix explained, with examples</a> · <a href=\"/en/templates\">free templates</a> · <a href=\"/en/signup\">create a free account</a></p>"
},
};

// ── Articles de blog ─────────────────────────────────────────────────────

/** FAQPage de l'article, s'il a une section FAQ (rich results). */
function articleFaqLd(a: BlogArticle, locale: Locale): LdEntry[] {
  const faq = requis(a.locales[locale], `article ${a.slug} en « ${locale} »`).faq;
  if (!faq?.length) return [];
  return [
    {
      obj: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map(([q, ans]) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: ans },
        })),
      },
      id: `blog-${a.slug}-faq`,
    },
  ];
}

function articleLd(a: BlogArticle, locale: Locale): LdEntry[] {
  const c = requis(a.locales[locale], `article ${a.slug} en « ${locale} »`);
  const url = canonicalUrl(`/blog/${a.slug}`, locale);
  return [
    {
      obj: {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: uiFor(locale).home, item: canonicalUrl('/', locale) },
          { '@type': 'ListItem', position: 2, name: uiFor(locale).blog, item: canonicalUrl('/blog', locale) },
          { '@type': 'ListItem', position: 3, name: c.title, item: url },
        ],
      },
      id: `blog-${a.slug}-breadcrumb`,
    },
    {
      obj: {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: c.title,
        description: c.description,
        image: ogImageFor(`/blog/${a.slug}`, locale),
        url,
        inLanguage: BCP47_TAG[locale],
        datePublished: a.datePublished,
        dateModified: a.dateModified,
        author: { '@type': 'Person', name: BLOG_AUTHOR.name, url: `${canonicalUrl('/a-propos', locale)}#fondateur` },
        publisher: ORGANISATION,
        mainEntityOfPage: url,
      },
      id: `blog-${a.slug}-posting`,
    },
    ...articleFaqLd(a, locale),
  ];
}

function articleContent(a: BlogArticle): LocaleContent {
  return byLocale(a, (c, locale) => {
    const u = uiFor(locale);
    const at = (path: string) => localizePath(path, locale);
    return `<p><a href="${at('/')}">${u.home}</a> › <a href="${at('/blog')}">${u.blog}</a></p>
        <h1>${c.title}</h1>
        <p>${u.byAuthor} <a href="${at('/a-propos')}#fondateur">${BLOG_AUTHOR.name}</a></p>
        ${c.html}
        <h2>${u.readNext}</h2>
        <ul>
          ${relatedArticles(a, locale).map((o) => `<li><a href="${at(`/blog/${o.slug}`)}">${o.title}</a></li>`).join('\n          ')}
        </ul>
        <p><a href="${at('/blog')}">${u.allArticles}</a> · <a href="${at('/signup')}">${u.tryFree}</a></p>`;
  });
}

export const ARTICLE_ROUTES: Route[] = ARTICLES.map(
  (a: BlogArticle): Route => ({
    path: `/blog/${a.slug}`,
    copy: 'article',
    // Pas de suffixe de marque : « | Blog Cosmo » poussait des titres au-delà
    // des ~60 caractères affichés par Google. Il affiche de toute façon le nom
    // du site sous le titre.
    meta: byLocale(a, (c) => ({ title: c.metaTitle, description: c.description })),
    extraLd: (locale) => articleLd(a, locale),
    content: articleContent(a),
  })
);

// ── Pages cas d'usage ────────────────────────────────────────────────────

/** Le chemin canonique est le slug FRANÇAIS ; les autres langues en dérivent par `localizePath`. */
const cheminDuCasUsage = (u: UseCase): string => `/${routeSlug(u.routeId, DEFAULT_LOCALE)}`;

export const USE_CASE_ROUTES: Route[] = USE_CASES.map(
  (u: UseCase): Route => ({
    path: cheminDuCasUsage(u),
    copy: u.routeId,
    meta: byLocale(u, (c) => ({ title: `${c.metaTitle} | Cosmo`, description: c.description })),
    extraLd: (locale) => [
      {
        obj: breadcrumb(requis(u.locales[locale], `cas d'usage ${u.routeId} en « ${locale} »`).title, cheminDuCasUsage(u), locale),
        id: `usecase-${u.routeId}-breadcrumb`,
      },
    ],
    content: byLocale(u, (c, locale) => {
      const ui = uiFor(locale);
      const at = (path: string) => localizePath(path, locale);
      return `<h1>${c.title}</h1>
        <p>${c.lead}</p>
        ${c.html}
        <p><a href="${at('/')}">${ui.home}</a> · <a href="${at('/signup')}">${ui.signup}</a> · <a href="${at('/guide')}">${ui.guide}</a></p>`;
    }),
  })
);
