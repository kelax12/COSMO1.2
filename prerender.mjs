// ─────────────────────────────────────────────────────────────────────────
// Prerender statique des routes publiques (SEO).
//
// L'app est une SPA Vite (rendu client). Les crawlers sociaux (Facebook,
// LinkedIn, X) n'exécutent PAS le JS : sans ce script, un partage de /guide
// ou /signup afficherait toujours les méta de la home. Googlebot rend le JS
// mais avec délai.
//
// Ce script lit le dist/index.html FRAÎCHEMENT buildé (donc avec les bons
// hash d'assets), le clone pour chaque route publique en réécrivant le <head>
// (title, description, canonical, OG, Twitter) + un <noscript> indexable +
// le JSON-LD spécifique à la route, puis écrit dist/<route>/index.html.
//
// Vercel sert ces fichiers statiques en priorité sur le rewrite SPA
// (le filesystem est vérifié avant les rewrites). Aucun navigateur requis
// au build → compatible avec l'image de build Vercel.
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTICLES } from './src/content/blog/index.mjs';
import { USE_CASES } from './src/content/use-cases.mjs';
import {
  BCP47_TAG,
  DEFAULT_LOCALE,
  INDEXABLE_LOCALES,
  OG_LOCALE,
  canonicalUrl,
  hreflangLinks,
  localizePath,
  sitemapAlternates,
} from './src/i18n/seo-urls.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, 'dist');
const BASE = 'https://thecosmo.app';

// ── Catalogues SEO par locale ─────────────────────────────────────────────
// Mêmes fichiers que ceux consommés par l'app (src/lib/useSeoMeta.ts) : le
// titre d'une page ne peut donc pas différer entre le prérendu et le rendu
// client.
const SEO = Object.fromEntries(
  INDEXABLE_LOCALES.map((locale) => [
    locale,
    JSON.parse(readFileSync(join(__dirname, 'src/locales', locale, 'seo.json'), 'utf8')),
  ])
);

/** Méta d'une route dans une locale, ou `null` si non traduite. */
const seoFor = (routeId, locale) => SEO[locale]?.[routeId] ?? null;
// Date de build (YYYY-MM-DD) — injectée dans les JSON-LD (dateModified) et le
// sitemap (lastmod) pour ne plus figer une date stale codée en dur.
const TODAY = new Date().toISOString().slice(0, 10);

let html = readFileSync(join(DIST, 'index.html'), 'utf8');
html = html.replace(/"dateModified":\s*"[\d-]+"/g, `"dateModified": "${TODAY}"`);

// ── FAQ (miroir de FAQ_ITEMS dans src/pages/LandingPage.tsx — garder synchro) ──
const FAQ_ITEMS = [
  ['Cosmo est-il vraiment gratuit ?', "Oui. Toutes les fonctionnalités principales — tâches, habitudes, agenda, OKR et statistiques — sont entièrement gratuites. L'accès Premium (collaboration en équipe, partage de tâches) s'obtient en regardant une courte publicité, sans jamais sortir votre carte bancaire."],
  ["Qu'est-ce que la méthode OKR et pourquoi l'utiliser ?", "La méthode OKR (Objectives & Key Results) est le système de définition d'objectifs utilisé par Google, Intel et Netflix. Un OKR = un objectif qualitatif ambitieux + 2 à 5 résultats clés mesurables. Cosmo automatise le calcul de progression et visualise votre avancement en temps réel, sans tableur."],
  ['Quelle est la différence avec Notion ou Todoist ?', "Notion est un espace de notes très flexible mais sans structure de productivité native. Todoist est un excellent gestionnaire de tâches mais n'intègre pas les habitudes, les OKR ni le time-blocking. Cosmo est la seule application qui connecte les quatre piliers — tâches, habitudes, agenda et objectifs — dans un seul écosystème cohérent."],
  ['Comment fonctionne le mode démo ?', "Cliquez sur « Essayer la démo » : vous accédez immédiatement à l'application complète, pré-remplie avec 100 tâches, 100 habitudes, 150 événements agenda et 8 OKRs sur 12 mois de données réalistes. Aucun compte, aucun email demandé. Quand vous êtes convaincu(e), créez votre vrai compte en 30 secondes."],
  ['Cosmo fonctionne-t-il sur mobile ?', "Oui. Cosmo est conçu mobile-first : interface responsive, bottom navigation bar, gestes swipe sur les tâches, bottom-sheets fluides et support du safe area iOS. L'application fonctionne dans n'importe quel navigateur mobile — Safari iOS, Chrome Android — sans téléchargement requis."],
  ["Qu'est-ce que le time-blocking ?", "Le time-blocking consiste à réserver des créneaux horaires dans votre agenda pour travailler sur des tâches précises, plutôt que de réagir au fil de l'eau. Dans Cosmo, glissez simplement une tâche depuis le panneau latéral vers un créneau de votre calendrier : l'événement est créé automatiquement et lié à la tâche."],
  ['Puis-je collaborer avec mon équipe ?', "Oui. Avec l'accès Premium (gratuit via publicité), envoyez des demandes d'amis par email, partagez des tâches avec un rôle Lecteur ou Éditeur, et suivez la progression de vos collaborateurs depuis votre dashboard. La messagerie contextuelle permet de discuter directement dans le contexte d'une tâche."],
  ['Comment suivre mes habitudes efficacement ?', "Créez une habitude, définissez sa fréquence (quotidienne, hebdomadaire, jours spécifiques), puis cochez chaque jour. Cosmo affiche une heatmap 26 semaines style GitHub, calcule votre streak (série de jours consécutifs) et votre taux de complétion sur la période choisie. La règle d'or : commencez par 2 à 3 habitudes maximum."],
  ['Mes données sont-elles sécurisées ?', "Vos données sont stockées sur Supabase avec Row Level Security : personne d'autre ne peut accéder à vos tâches ou habitudes. Les pages de l'application (dashboard, tâches, etc.) sont bloquées pour les robots de recherche dans robots.txt. En mode démo, les données restent dans votre navigateur (localStorage) et ne transitent pas par nos serveurs."],
  ['Peut-on utiliser Cosmo sans connexion internet ?', "En mode démo, toutes les données sont stockées localement dans votre navigateur — aucune connexion requise après le chargement initial. En mode compte, un cache localStorage 24 heures permet de consulter vos tâches et habitudes récentes même avec une connexion instable."],
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map(([q, a]) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

/** Libellé de la racine dans le fil d'Ariane, par locale. */
const HOME_LABEL = { fr: 'Accueil', en: 'Home', es: 'Inicio' };

const breadcrumb = (name, path, locale) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: HOME_LABEL[locale], item: canonicalUrl('/', locale) },
    { '@type': 'ListItem', position: 2, name, item: canonicalUrl(path, locale) },
  ],
});

const guideArticle = (locale) => ({
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: seoFor('guide', locale).title,
  description: seoFor('guide', locale).description,
  image: `${BASE}/og-card.png`,
  url: canonicalUrl('/guide', locale),
  inLanguage: BCP47_TAG[locale],
  datePublished: '2025-01-01',
  dateModified: '2026-05-31',
  author: { '@type': 'Organization', name: 'Cosmo', url: BASE },
  publisher: { '@type': 'Organization', name: 'Cosmo', url: BASE },
  mainEntityOfPage: canonicalUrl('/guide', locale),
  articleSection: ['Prise en main', 'Tâches', 'Habitudes', 'Agenda', 'OKR', 'Statistiques'],
});

const ld = (obj, id) => `<script type="application/ld+json"${id ? ` id="${id}"` : ''}>${JSON.stringify(obj)}</script>`;

// ── Définition des routes ──────────────────────────────────────────────────
//
// Chaque route porte :
//   - `path`    : le chemin FRANÇAIS canonique. Les autres langues en sont
//                 dérivées par `localizePath` (préfixe + slug traduit), donc il
//                 n'y a jamais deux tables de chemins à tenir synchronisées.
//   - `meta`    : { locale → { title, description } }.
//   - `content` : { locale → HTML indexable injecté dans #seo-fallback }.
//   - `extraLd` : (locale) => [{ obj, id }].
//
// Une locale n'est prérendue pour une route QUE si `meta` et `content` la
// fournissent tous les deux. C'est volontairement contraignant : il devient
// impossible de publier une page anglaise dont le corps serait resté français,
// ce qui est exactement le duplicate content qu'on cherche à éviter. Les
// `hreflang` sont dérivés de la même liste, donc ils ne peuvent pas annoncer
// une page qui n'a pas été écrite.

/** Métadonnées tirées des catalogues `src/locales/<locale>/seo.json`. */
const fromCatalog = (routeId) =>
  Object.fromEntries(
    INDEXABLE_LOCALES.map((locale) => [locale, seoFor(routeId, locale)]).filter(
      ([, meta]) => meta
    )
  );

const ROUTES = [
  {
    path: '/guide',
    meta: fromCatalog('guide'),
    extraLd: (locale) => [
      { obj: breadcrumb("Guide d'utilisation", '/guide', locale), id: 'guide-breadcrumb' },
      { obj: guideArticle(locale), id: 'guide-article' },
    ],
    content: {
      fr: `<h1>Guide d'utilisation de Cosmo</h1>
        <p>Découvrez comment tirer le meilleur de Cosmo, l'application de productivité tout-en-un.</p>
        <h2>Prise en main</h2><p>Créez un compte gratuit ou essayez le mode démo sans inscription.</p>
        <h2>Tâches</h2><p>Créez des tâches avec priorités, catégories, deadlines et listes.</p>
        <h2>Habitudes</h2><p>Suivez vos habitudes avec une heatmap 26 semaines et des streaks.</p>
        <h2>Agenda</h2><p>Planifiez par time-blocking en glissant vos tâches dans le calendrier.</p>
        <h2>OKR</h2><p>Définissez des objectifs ambitieux et mesurez vos résultats clés.</p>
        <h2>Statistiques</h2><p>Analysez votre temps sur tous vos modules.</p>
        <p><a href="/">Retour à l'accueil</a> · <a href="/signup">Créer un compte gratuit</a></p>`,
    },
  },
  {
    path: '/signup',
    meta: fromCatalog('signup'),
    content: {
      fr: `<h1>Créer un compte Cosmo gratuit</h1>
        <p>Inscrivez-vous gratuitement pour gérer vos tâches, habitudes, agenda et OKR dans une seule application. Connexion possible via Google.</p>
        <p><a href="/">Accueil</a> · <a href="/login">J'ai déjà un compte</a></p>`,
    },
  },
  {
    path: '/login',
    meta: fromCatalog('login'),
    content: {
      fr: `<h1>Connexion à Cosmo</h1>
        <p>Connectez-vous pour retrouver vos tâches, habitudes, agenda et objectifs OKR.</p>
        <p><a href="/">Accueil</a> · <a href="/signup">Créer un compte gratuit</a></p>`,
    },
  },
  {
    path: '/a-propos',
    meta: fromCatalog('about'),
    extraLd: (locale) => [
      { obj: breadcrumb('À propos', '/a-propos', locale), id: 'apropos-breadcrumb' },
    ],
    content: {
      fr: `<h1>À propos de Cosmo</h1>
        <p>Cosmo est une application de productivité française, gratuite et tout-en-un : tâches, habitudes, agenda avec time-blocking et OKR connectés dans un seul écosystème. Produit indépendant, développé en France.</p>
        <h2>Cosmo, The Cosmo App ou thecosmo ?</h2>
        <p>Les trois désignent la même application : Cosmo, accessible à l'adresse thecosmo.app. On nous cherche aussi sous « Cosmo app », « The Cosmo » ou « thecosmo app » — c'est toujours nous. Cosmo est une application web sans téléchargement ; son seul site officiel est thecosmo.app.</p>
        <p><a href="/">Accueil</a> · <a href="/signup">Créer un compte gratuit</a> · <a href="/blog">Blog</a></p>`,
    },
  },
  {
    path: '/blog',
    meta: fromCatalog('blog'),
    // Les ARTICLES restent français : le schéma Blog reste donc en fr-FR quelle
    // que soit la locale de l'index, sinon on déclarerait des BlogPosting
    // anglais qui n'existent pas.
    extraLd: (locale) => [
      { obj: breadcrumb('Blog', '/blog', locale), id: 'blog-breadcrumb' },
      {
        obj: {
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'Blog Cosmo',
          url: `${BASE}/blog`,
          inLanguage: BCP47_TAG[DEFAULT_LOCALE],
          publisher: { '@type': 'Organization', name: 'Cosmo', url: BASE },
          blogPost: ARTICLES.map((a) => ({
            '@type': 'BlogPosting',
            headline: a.title,
            image: `${BASE}/og-card.png`,
            url: `${BASE}/blog/${a.slug}`,
            datePublished: a.datePublished,
          })),
        },
        id: 'blog-schema',
      },
    ],
    content: {
      fr: `<h1>Le blog Cosmo</h1>
        <p>Guides pratiques sur la méthode OKR, les habitudes, le time-blocking et la productivité personnelle.</p>
        <ul>
          ${ARTICLES.map((a) => `<li><a href="/blog/${a.slug}">${a.title}</a> — ${a.description}</li>`).join('\n          ')}
        </ul>
        <p><a href="/">Accueil</a> · <a href="/signup">Créer un compte gratuit</a></p>`,
    },
  },
  // Articles de blog — contenu complet visible (src/content/blog/*.mjs).
  // Français uniquement (phase 3) : ils ne reçoivent donc que `x-default`, et
  // aucune alternate `en`/`es` — déclarer une alternate vers une page qui
  // n'existe pas est une erreur Search Console.
  ...ARTICLES.map((a) => ({
    path: `/blog/${a.slug}`,
    meta: { fr: { title: `${a.metaTitle} | Blog Cosmo`, description: a.description } },
    extraLd: () => [
      {
        obj: {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${BASE}/` },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE}/blog` },
            { '@type': 'ListItem', position: 3, name: a.title, item: `${BASE}/blog/${a.slug}` },
          ],
        },
        id: `blog-${a.slug}-breadcrumb`,
      },
      {
        obj: {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: a.title,
          description: a.description,
          image: `${BASE}/og-card.png`,
          url: `${BASE}/blog/${a.slug}`,
          inLanguage: 'fr-FR',
          datePublished: a.datePublished,
          dateModified: a.dateModified,
          author: { '@type': 'Organization', name: 'Cosmo', url: BASE },
          publisher: { '@type': 'Organization', name: 'Cosmo', url: BASE },
          mainEntityOfPage: `${BASE}/blog/${a.slug}`,
        },
        id: `blog-${a.slug}-posting`,
      },
      // FAQPage si l'article a une section FAQ (rich results)
      ...(a.faq?.length
        ? [{
            obj: {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: a.faq.map(([q, ans]) => ({
                '@type': 'Question',
                name: q,
                acceptedAnswer: { '@type': 'Answer', text: ans },
              })),
            },
            id: `blog-${a.slug}-faq`,
          }]
        : []),
    ],
    content: {
      fr: `<p><a href="/">Accueil</a> › <a href="/blog">Blog</a></p>
        <h1>${a.title}</h1>
        ${a.html}
        <h2>À lire ensuite</h2>
        <ul>
          ${ARTICLES.filter((o) => o.slug !== a.slug).slice(0, 3).map((o) => `<li><a href="/blog/${o.slug}">${o.title}</a></li>`).join('\n          ')}
        </ul>
        <p><a href="/blog">← Tous les articles</a> · <a href="/signup">Essayer Cosmo gratuitement</a></p>`,
    },
  })),
  // Pages use-case commerciales — contenu complet visible
  // (src/content/use-cases.mjs). Français uniquement, comme les articles.
  ...USE_CASES.map((u) => ({
    path: `/${u.slug}`,
    meta: { fr: { title: `${u.metaTitle} | Cosmo`, description: u.description } },
    extraLd: (locale) => [
      { obj: breadcrumb(u.title, `/${u.slug}`, locale), id: `usecase-${u.slug}-breadcrumb` },
    ],
    content: {
      fr: `<h1>${u.title}</h1>
        <p>${u.lead}</p>
        ${u.html}
        <p><a href="/">Accueil</a> · <a href="/signup">Créer un compte gratuit</a> · <a href="/guide">Guide d'utilisation</a></p>`,
    },
  })),
  {
    path: '/cgu',
    meta: fromCatalog('terms'),
    content: {
      fr: `<h1>Conditions Générales d'Utilisation</h1>
        <p>Conditions générales d'utilisation de l'application Cosmo. <a href="/">Retour à l'accueil</a></p>`,
    },
  },
  {
    path: '/mentions-legales',
    meta: fromCatalog('legalNotice'),
    content: {
      fr: `<h1>Mentions légales</h1>
        <p>Mentions légales de l'application Cosmo. <a href="/">Retour à l'accueil</a></p>`,
    },
  },
  {
    path: '/politique-confidentialite',
    meta: fromCatalog('privacy'),
    content: {
      fr: `<h1>Politique de confidentialité</h1>
        <p>Politique de confidentialité de l'application Cosmo. <a href="/">Retour à l'accueil</a></p>`,
    },
  },
];

// ── Helpers de réécriture ────────────────────────────────────────────────
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// Contenu statique de la home (miroir de l'ancien <noscript> d'index.html).
const HOME_STATIC = `<h1>Cosmo – Gestionnaire de tâches, habitudes et OKR</h1>
        <p>Cosmo est une application de productivité gratuite qui centralise la gestion de tâches, le suivi d'habitudes, l'agenda avec time-blocking et la méthode OKR (Objectives &amp; Key Results).</p>
        <h2>Fonctionnalités principales</h2>
        <ul>
          <li><strong>Gestionnaire de tâches</strong> — priorités, catégories colorées, deadlines, listes et filtres avancés</li>
          <li><strong>Suivi d'habitudes</strong> — heatmap 26 semaines style GitHub, streaks et taux de complétion</li>
          <li><strong>Agenda avec time-blocking</strong> — glisser-déposer des tâches dans le calendrier, vues jour/semaine/mois</li>
          <li><strong>OKR (Objectives &amp; Key Results)</strong> — méthode utilisée par Google, Intel et Netflix</li>
          <li><strong>Statistiques multi-modules</strong> — analysez votre temps sur tâches, habitudes, agenda et OKR</li>
          <li><strong>Mode démo instantané</strong> — aucune inscription requise, 100 tâches et 100 habitudes pré-remplies</li>
        </ul>
        <p><a href="/signup">Créer un compte gratuit</a> · <a href="/guide">Guide d'utilisation</a></p>`;

// Maillage interne statique commun, ajouté au bas de #seo-fallback sur TOUTES
// les routes (y compris la home) — Ahrefs (et les crawlers sans JS) ne suivent
// que ces liens-là pour établir les entrantes. Sans ce bloc, /a-propos, les 3
// pages use-case, les 3 pages légales et /login n'ont aucun lien entrant
// statique (page "orpheline" ou lien dofollow unique dans Ahrefs Site Audit).
//
// Les `href` sont localisés : sous `/en/`, pointer vers `/a-propos` enverrait
// le crawler sur la version française et casserait le cloisonnement des langues
// (Google suit ces liens pour établir la structure du site).
const staticFooterNav = (locale) => {
  const link = (path, label) => `<a href="${localizePath(path, locale)}">${label}</a>`;
  return `<p>${[
    link('/guide', "Guide d'utilisation"),
    link('/blog', 'Blog'),
    link('/pour-freelances', 'Pour les freelances'),
    link('/pour-etudiants', 'Pour les étudiants'),
    link('/pour-managers', 'Pour les managers'),
    link('/a-propos', 'À propos'),
    link('/signup', 'Inscription gratuite'),
    link('/login', 'Connexion'),
    link('/mentions-legales', 'Mentions légales'),
    link('/politique-confidentialite', 'Confidentialité'),
    link('/cgu', 'CGU'),
  ].join(' · ')}</p>`;
};

// Injecte le contenu indexable dans <div id="root">, AVANT #boot-screen.
//
// Il est présent dans le balisage — donc lu par les crawlers qui n'exécutent
// pas le JS (GPTBot, ClaudeBot, PerplexityBot, Bing…), qui parsent le HTML
// sans appliquer le CSS — mais `#seo-fallback{display:none}` (défini dans le
// <style> d'index.html) fait qu'un vrai navigateur ne le peint JAMAIS : il
// voit #boot-screen, l'écran de chargement, jusqu'au premier render de React.
//
// ⚠ Ne PAS masquer ce bloc en JS : la CSP de vercel.json est
// `script-src 'self'` (ni 'unsafe-inline' ni nonce) → un <script> inline est
// bloqué en prod, alors qu'il passe en local où il n'y a pas de CSP. C'est le
// piège qui laissait ce mur de texte SEO à l'écran à chaque refresh ou plantage
// au démarrage. Le masquage doit rester purement CSS.
//
// Le <noscript> d'origine devient redondant (le <noscript><style> du <head>
// réaffiche #seo-fallback quand le JS est coupé) et est retiré : ciblage par
// son id pour ne pas emporter celui du <head>.
function injectStaticContent(out, content, locale) {
  const marker = '<div id="root">';
  if (!out.includes(marker)) {
    console.warn('  ⚠ marqueur <div id="root"> introuvable — contenu statique non injecté');
    return out;
  }
  out = out.replace(marker, `${marker}\n      <div id="seo-fallback">\n        ${content}\n        ${staticFooterNav(locale)}\n      </div>`);
  out = out.replace(/<noscript id="seo-noscript">[\s\S]*?<\/noscript>\s*/, '');
  return out;
}

/**
 * Locales réellement publiables pour une route : celles qui ont À LA FOIS des
 * méta et du contenu. Voir le commentaire de `ROUTES` — c'est ce qui rend
 * impossible la publication d'une page anglaise au corps français.
 */
function availableLocales(route) {
  return INDEXABLE_LOCALES.filter((locale) => route.meta?.[locale] && route.content?.[locale]);
}

function buildPage(route, locale, alternates) {
  let out = html;
  const { title, description } = route.meta[locale];
  const url = canonicalUrl(route.path, locale);

  // Langue du document — lue par les lecteurs d'écran et les moteurs.
  out = out.replace(/<html([^>]*)\slang="[^"]*"/, `<html$1 lang="${locale}"`);

  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  out = out.replace(/<meta name="description" content="[\s\S]*?" \/>/, `<meta name="description" content="${esc(description)}" />`);
  out = out.replace(/<link rel="canonical" href="[\s\S]*?" \/>/, `<link rel="canonical" href="${url}" />`);
  out = out.replace(/<meta property="og:url" content="[\s\S]*?" \/>/, `<meta property="og:url" content="${url}" />`);
  out = out.replace(/<meta property="og:title" content="[\s\S]*?" \/>/, `<meta property="og:title" content="${esc(title)}" />`);
  out = out.replace(/<meta property="og:description" content="[\s\S]*?" \/>/, `<meta property="og:description" content="${esc(description)}" />`);
  out = out.replace(/<meta property="og:locale" content="[\s\S]*?" \/>/, `<meta property="og:locale" content="${OG_LOCALE[locale]}" />`);
  out = out.replace(/<meta name="twitter:title" content="[\s\S]*?" \/>/, `<meta name="twitter:title" content="${esc(title)}" />`);
  out = out.replace(/<meta name="twitter:description" content="[\s\S]*?" \/>/, `<meta name="twitter:description" content="${esc(description)}" />`);

  // `inLanguage` des JSON-LD génériques d'index.html (Organization, WebSite…).
  out = out.replace(/"inLanguage":\s*"[^"]*"/g, `"inLanguage": "${BCP47_TAG[locale]}"`);

  // hreflang — alternates réciproques + x-default.
  const links = hreflangLinks(route.path, alternates);
  if (links) out = out.replace('</head>', `    ${links}\n  </head>`);

  // JSON-LD spécifique à la route, injecté avant </head>
  const extra = route.extraLd?.(locale) ?? [];
  if (extra.length) {
    out = out.replace('</head>', `    ${extra.map(({ obj, id }) => ld(obj, id)).join('\n    ')}\n  </head>`);
  }

  // Contenu indexable visible de la route, injecté dans #root
  out = injectStaticContent(out, route.content[locale], locale);

  return out;
}

// ── Génération ──────────────────────────────────────────────────────────
let count = 0;
for (const route of ROUTES) {
  const alternates = availableLocales(route);
  if (alternates.length === 0) {
    console.warn(`  ⚠ ${route.path} — aucune locale complète (méta + contenu), route ignorée`);
    continue;
  }
  for (const locale of alternates) {
    const path = localizePath(route.path, locale);
    const dir = join(DIST, path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), buildPage(route, locale, alternates), 'utf8');
    count++;
    console.log(`  prerendered ${path}/index.html`);
  }
}

// ── Home : FAQPage JSON-LD statique + contenu visible dans #root ──────────
// La FAQ reste française tant que la home n'est pas traduite (phase 5) : la
// home n'est donc publiée que dans la locale par défaut.
const homeRoute = {
  path: '/',
  meta: fromCatalog('root'),
  content: { fr: HOME_STATIC },
};
for (const locale of availableLocales(homeRoute)) {
  let home = buildPage(homeRoute, locale, availableLocales(homeRoute));
  if (!home.includes('"FAQPage"')) {
    home = home.replace('</head>', `    ${ld(faqSchema, 'faq-schema')}\n  </head>`);
    console.log('  injected FAQPage JSON-LD into index.html');
  }
  writeFileSync(join(DIST, localizePath('/', locale), 'index.html'), home, 'utf8');
}

// ── Sitemap : lastmod = date de build + URLs blog/à-propos générées ───────
const sitemapPath = join(DIST, 'sitemap.xml');
//
// Une entrée par (chemin × locale publiée), chacune portant les `xhtml:link`
// de TOUTES les versions du groupe, elle-même comprise. Google exige cette
// réciprocité aussi dans le sitemap : un groupe déclaré à sens unique est
// ignoré en entier, silencieusement.
const sitemapEntry = (path, locale, alternates, lastmod, changefreq, priority) => {
  const alt = sitemapAlternates(path, alternates);
  return (
    `  <url>\n    <loc>${canonicalUrl(path, locale)}</loc>\n` +
    (alt ? `${alt}\n` : '') +
    `    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`
  );
};

/** Développe un chemin sur toutes ses locales publiées. */
const sitemapGroup = (path, alternates, lastmod, changefreq, priority) =>
  alternates.map((locale) => sitemapEntry(path, locale, alternates, lastmod, changefreq, priority)).join('');

try {
  let sitemap = readFileSync(sitemapPath, 'utf8');
  sitemap = sitemap.replace(/<lastmod>[\d-]+<\/lastmod>/g, `<lastmod>${TODAY}</lastmod>`);

  // Déclaration du namespace xhtml, requise dès qu'on émet des `xhtml:link`.
  if (!sitemap.includes('xmlns:xhtml')) {
    sitemap = sitemap.replace(
      /<urlset([^>]*)>/,
      '<urlset$1 xmlns:xhtml="http://www.w3.org/1999/xhtml">'
    );
  }

  const localesOf = (routePath) => {
    const route = ROUTES.find((r) => r.path === routePath);
    return route ? availableLocales(route) : [DEFAULT_LOCALE];
  };

  const generated =
    sitemapGroup('/a-propos', localesOf('/a-propos'), TODAY, 'yearly', '0.5') +
    sitemapGroup('/blog', localesOf('/blog'), TODAY, 'weekly', '0.8') +
    ARTICLES.map((a) =>
      sitemapGroup(`/blog/${a.slug}`, localesOf(`/blog/${a.slug}`), a.dateModified, 'monthly', '0.7')
    ).join('') +
    USE_CASES.map((u) =>
      sitemapGroup(`/${u.slug}`, localesOf(`/${u.slug}`), TODAY, 'monthly', '0.7')
    ).join('');

  sitemap = sitemap.replace('</urlset>', `${generated}</urlset>`);
  writeFileSync(sitemapPath, sitemap, 'utf8');
  const urlCount = (generated.match(/<loc>/g) ?? []).length;
  console.log(`  sitemap → lastmod ${TODAY} + ${urlCount} URLs générées (blog, à-propos, use-cases)`);
} catch (err) {
  console.warn(`  ⚠ dist/sitemap.xml non enrichi — ${err.message}`);
}

// ── RSS : flux du blog généré depuis ARTICLES (autodiscovery dans <head>) ──
const rfc822 = (d) => new Date(`${d}T12:00:00Z`).toUTCString();
const rssItems = [...ARTICLES]
  .sort((a, b) => (a.datePublished < b.datePublished ? 1 : -1))
  .map((a) =>
    `    <item>\n      <title><![CDATA[${a.title}]]></title>\n      <link>${BASE}/blog/${a.slug}</link>\n      <guid isPermaLink="true">${BASE}/blog/${a.slug}</guid>\n      <pubDate>${rfc822(a.datePublished)}</pubDate>\n      <description><![CDATA[${a.description}]]></description>\n    </item>`
  )
  .join('\n');
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blog Cosmo — Productivité, OKR, habitudes et time-blocking</title>
    <link>${BASE}/blog</link>
    <atom:link href="${BASE}/rss.xml" rel="self" type="application/rss+xml" />
    <description>Guides pratiques sur la méthode OKR, le suivi d'habitudes, le time-blocking et la productivité personnelle. Par l'équipe de Cosmo.</description>
    <language>fr-FR</language>
    <lastBuildDate>${rfc822(TODAY)}</lastBuildDate>
${rssItems}
  </channel>
</rss>
`;
writeFileSync(join(DIST, 'rss.xml'), rss, 'utf8');
console.log(`  rss.xml → ${ARTICLES.length} articles`);

// ── llms.txt : sections blog + cas d'usage générées depuis les registres ──
try {
  const llmsPath = join(DIST, 'llms.txt');
  let llms = readFileSync(llmsPath, 'utf8');
  const llmsGenerated =
    `\n## Articles du blog\n\n` +
    ARTICLES.map((a) => `- [${a.title}](${BASE}/blog/${a.slug}) : ${a.description}`).join('\n') +
    `\n\n## Cas d'usage\n\n` +
    USE_CASES.map((u) => `- [${u.title}](${BASE}/${u.slug}) : ${u.description}`).join('\n') +
    `\n\n## Autres pages\n\n- [Blog](${BASE}/blog)\n- [À propos](${BASE}/a-propos)\n- [Flux RSS](${BASE}/rss.xml)\n`;
  writeFileSync(llmsPath, llms.trimEnd() + '\n' + llmsGenerated, 'utf8');
  console.log(`  llms.txt → +${ARTICLES.length} articles, +${USE_CASES.length} cas d'usage`);
} catch {
  console.warn('  ⚠ dist/llms.txt introuvable — llms.txt non enrichi');
}

console.log(`✓ prerender done — ${count} routes + home (FAQ schema + contenu statique)`);
