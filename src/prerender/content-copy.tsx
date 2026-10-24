// Rendu SERVEUR des pages de contenu, lu par `prerender.mjs` au build.
//
// 🔴 POURQUOI (2026-10-23, AM-2 de docs/PERFORMANCE.md). Les pages de contenu
// (blog, articles, `/pour-*`, à-propos, pages légales, guide) peignaient un
// spinner jusqu'au premier rendu de React : toute l'application devait arriver
// avant la première phrase, et Lighthouse mobile mesurait leur LCP entre 4,5 et
// 5,6 s. Le texte SEO brut, peint à la place, était plus rapide mais ne
// ressemblait pas à la page (arbitrage du 2026-10-21).
//
// Ici, la page est rendue par ses PROPRES composants, avec la même locale et les
// mêmes catalogues que dans le navigateur. `prerender.mjs` pose ce balisage dans
// `#lp-hero`, le calque de la home, avec la CSS buildée qui lui revient : la
// page est peinte dès la première image, puis React la relève à l'identique
// (`PublicPageWithSuspense`, dans `App.tsx`), sans saut.
//
// ❌ Ne rien importer ici qui touche au navigateur au chargement du module : ce
// fichier est évalué par Node (`ssrLoadModule` de Vite), sans `window`.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ensureNamespaces, type Namespace } from '@/i18n/catalog';
import { localeStore } from '@/i18n/store';
import type { Locale } from '@/i18n/locale';
import { PrerenderCopyContext } from '@/lib/prerender-copy-context';
import { routeSlug } from '@/i18n/routes';
import AProposPage from '@/pages/AProposPage';
import BlogArticlePage from '@/pages/BlogArticlePage';
import BlogIndexPage from '@/pages/BlogIndexPage';
import CGUPage from '@/pages/CGUPage';
import GuidePage from '@/pages/GuidePage';
import MentionsLegalesPage from '@/pages/MentionsLegalesPage';
import PolitiqueConfidentialitePage from '@/pages/PolitiqueConfidentialitePage';
import UseCasePage from '@/pages/UseCasePage';

/**
 * Les namespaces de chaque page, MÊMES listes que ses `lazyWithRetry` d'App.tsx.
 * Un catalogue absent ici rendrait la clé brute dans la copie.
 */
const PAGES: Record<string, { namespaces: readonly Namespace[]; element: React.ReactElement; path: (locale: Locale) => string }> = {
  guide: { namespaces: ['guide', 'seo'], element: <GuidePage />, path: () => 'guide' },
  blog: { namespaces: ['landing', 'seo'], element: <BlogIndexPage />, path: () => 'blog' },
  article: { namespaces: ['landing', 'seo'], element: <BlogArticlePage />, path: () => 'blog/:slug' },
  about: { namespaces: ['landing', 'seo'], element: <AProposPage />, path: (l) => routeSlug('about', l) },
  freelancers: { namespaces: ['landing', 'seo'], element: <UseCasePage />, path: (l) => routeSlug('freelancers', l) },
  students: { namespaces: ['landing', 'seo'], element: <UseCasePage />, path: (l) => routeSlug('students', l) },
  managers: { namespaces: ['landing', 'seo'], element: <UseCasePage />, path: (l) => routeSlug('managers', l) },
  teams: { namespaces: ['landing', 'seo'], element: <UseCasePage />, path: (l) => routeSlug('teams', l) },
  legalNotice: { namespaces: ['legal', 'seo'], element: <MentionsLegalesPage />, path: (l) => routeSlug('legalNotice', l) },
  privacy: { namespaces: ['legal', 'legalPrivacy', 'seo'], element: <PolitiqueConfidentialitePage />, path: (l) => routeSlug('privacy', l) },
  terms: { namespaces: ['legal', 'legalTerms', 'seo'], element: <CGUPage />, path: (l) => routeSlug('terms', l) },
};

export const CONTENT_COPY_PAGES = Object.keys(PAGES);

/**
 * Le balisage de la page `page`, servie à `url` (chemin SANS préfixe de
 * locale, `/blog/methode-okr-exemples`), dans `locale`.
 */
export async function renderContentCopy(page: string, url: string, locale: Locale): Promise<string> {
  const def = PAGES[page];
  if (!def) throw new Error(`content-copy: page inconnue « ${page} »`);
  localeStore.setLocale(locale, { persist: false });
  await ensureNamespaces(def.namespaces, locale);
  const basename = locale === 'fr' ? '/' : `/${locale}`;
  const entry = basename === '/' ? url : `${basename}${url}`;
  return renderToStaticMarkup(
    <PrerenderCopyContext.Provider value>
      <MemoryRouter basename={basename} initialEntries={[entry]}>
        <Routes>
          <Route path={def.path(locale)} element={def.element} />
        </Routes>
      </MemoryRouter>
    </PrerenderCopyContext.Provider>
  );
}
