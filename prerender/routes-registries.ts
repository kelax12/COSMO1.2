// Les routes tirées des registres de contenu : index du blog, articles de blog,
// pages cas d'usage (src/content/blog, src/content/use-cases.mjs).
//
// Une langue n'est publiée que si l'article ou le cas d'usage y est réellement
// écrit : les `hreflang` en sont dérivés, ils ne peuvent donc pas annoncer une
// page qui n'existe pas (erreur Search Console), ni une page anglaise au corps
// français. Le slug, lui, est celui de la publication et ne se traduit pas.
import type { Locale } from '@/i18n/locale';
import { ARTICLES, articlesFor, relatedArticles } from '../src/content/blog/index.mjs';
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
        author: ORGANISATION,
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
