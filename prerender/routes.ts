// Définition des routes publiques prérendues.
//
// Chaque route porte :
//   - `path`    : le chemin FRANÇAIS canonique (les autres langues en dérivent
//                 par `localizePath`, jamais deux tables de chemins) ;
//   - `meta`    : { locale → { title, description } } ;
//   - `content` : { locale → HTML indexable injecté dans #seo-fallback } ;
//   - `extraLd` : (locale) => [{ obj, id }].
//
// Une locale n'est prérendue pour une route QUE si `meta` et `content` la
// fournissent tous les deux (cf. `availableLocales`, page.ts).
import { fromCatalog } from './config.ts';
import { ABOUT_CONTENT } from './content/about.ts';
import { ENTREPRISE_CONTENT } from './content/entreprise.ts';
import { GUIDE_CONTENT } from './content/guide.ts';
import { HOME_EN, HOME_FR } from './content/home.ts';
import {
  LEGAL_NOTICE_CONTENT,
  LOGIN_CONTENT,
  PRIVACY_CONTENT,
  SIGNUP_CONTENT,
  TERMS_CONTENT,
} from './content/short-pages.ts';
import { breadcrumb, guideArticle } from './ld.ts';
import { ARTICLE_ROUTES, BLOG_INDEX_ROUTE, USE_CASE_ROUTES } from './routes-registries.ts';
import type { Route } from './types.ts';

/** La home est écrite à part : elle porte aussi le FAQPage (cf. generate.ts). */
export const HOME_ROUTE: Route = {
  path: '/',
  heroTrack: 'perso',
  meta: fromCatalog('root'),
  content: { fr: HOME_FR, en: HOME_EN },
};

export const ROUTES: Route[] = [
  {
    path: '/guide',
    // Copie de la page rendue par React, peinte avant lui (cf. copies.ts).
    copy: 'guide',
    meta: fromCatalog('guide'),
    extraLd: (locale) => [
      { obj: breadcrumb("Guide d'utilisation", '/guide', locale), id: 'guide-breadcrumb' },
      { obj: guideArticle(locale), id: 'guide-article' },
    ],
    content: GUIDE_CONTENT,
  },
  { path: '/signup', meta: fromCatalog('signup'), content: SIGNUP_CONTENT },
  { path: '/login', meta: fromCatalog('login'), content: LOGIN_CONTENT },
  {
    path: '/a-propos',
    copy: 'about',
    meta: fromCatalog('about'),
    extraLd: (locale) => [{ obj: breadcrumb('À propos', '/a-propos', locale), id: 'apropos-breadcrumb' }],
    content: ABOUT_CONTENT,
  },
  {
    // Track entreprise de la landing : son propre chemin, donc son propre titre,
    // sa description et son corps indexable, parce que « Cosmo pour une
    // organisation » et « Cosmo pour moi » ne répondent pas à la même requête.
    // Le contenu reprend les arguments du track (src/pages/landing/entreprise/) :
    // à retoucher si la copie change.
    path: '/entreprise-presentation',
    meta: fromCatalog('enterprisePresentation'),
    // Peint une copie du hero entreprise avant React (cf. injectHeroCopy).
    heroTrack: 'entreprise',
    extraLd: (locale) => [
      { obj: breadcrumb('Cosmo Entreprise', '/entreprise-presentation', locale), id: 'entreprise-breadcrumb' },
    ],
    content: ENTREPRISE_CONTENT,
  },
  BLOG_INDEX_ROUTE,
  ...ARTICLE_ROUTES,
  ...USE_CASE_ROUTES,
  { path: '/cgu', copy: 'terms', meta: fromCatalog('terms'), content: TERMS_CONTENT },
  { path: '/mentions-legales', copy: 'legalNotice', meta: fromCatalog('legalNotice'), content: LEGAL_NOTICE_CONTENT },
  { path: '/politique-confidentialite', copy: 'privacy', meta: fromCatalog('privacy'), content: PRIVACY_CONTENT },
];
