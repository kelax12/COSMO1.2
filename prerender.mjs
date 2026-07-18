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

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, 'dist');
const BASE = 'https://thecosmo.app';
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

const breadcrumb = (name, path) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${BASE}/` },
    { '@type': 'ListItem', position: 2, name, item: `${BASE}${path}` },
  ],
});

const guideArticle = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: "Guide d'utilisation Cosmo – Tâches, habitudes, OKR et agenda",
  description: "Guide complet pour utiliser Cosmo : gestion de tâches, suivi d'habitudes avec heatmap, agenda time-blocking et méthode OKR.",
  url: `${BASE}/guide`,
  inLanguage: 'fr-FR',
  datePublished: '2025-01-01',
  dateModified: '2026-05-31',
  author: { '@type': 'Organization', name: 'Cosmo', url: BASE },
  publisher: { '@type': 'Organization', name: 'Cosmo', url: BASE },
  mainEntityOfPage: `${BASE}/guide`,
  articleSection: ['Prise en main', 'Tâches', 'Habitudes', 'Agenda', 'OKR', 'Statistiques'],
};

const ld = (obj, id) => `<script type="application/ld+json"${id ? ` id="${id}"` : ''}>${JSON.stringify(obj)}</script>`;

// ── Définition des routes ──────────────────────────────────────────────────
const ROUTES = [
  {
    path: '/guide',
    title: "Guide d'utilisation Cosmo – Tâches, habitudes, OKR et agenda",
    description: "Apprenez à utiliser Cosmo : créer des tâches, suivre vos habitudes avec heatmap, planifier votre agenda avec time-blocking et gérer vos OKR. Guide complet en français.",
    extraLd: [
      { obj: breadcrumb("Guide d'utilisation", '/guide'), id: 'guide-breadcrumb' },
      { obj: guideArticle, id: 'guide-article' },
    ],
    noscript: `<h1>Guide d'utilisation de Cosmo</h1>
        <p>Découvrez comment tirer le meilleur de Cosmo, l'application de productivité tout-en-un.</p>
        <h2>Prise en main</h2><p>Créez un compte gratuit ou essayez le mode démo sans inscription.</p>
        <h2>Tâches</h2><p>Créez des tâches avec priorités, catégories, deadlines et listes.</p>
        <h2>Habitudes</h2><p>Suivez vos habitudes avec une heatmap 26 semaines et des streaks.</p>
        <h2>Agenda</h2><p>Planifiez par time-blocking en glissant vos tâches dans le calendrier.</p>
        <h2>OKR</h2><p>Définissez des objectifs ambitieux et mesurez vos résultats clés.</p>
        <h2>Statistiques</h2><p>Analysez votre temps sur tous vos modules.</p>
        <p><a href="/">Retour à l'accueil</a> · <a href="/signup">Créer un compte gratuit</a></p>`,
  },
  {
    path: '/signup',
    title: 'Inscription gratuite – Cosmo, app productivité tâches et OKR',
    description: "Créez votre compte Cosmo gratuitement. Gérez vos tâches, habitudes, agenda et objectifs OKR. Connexion possible via Google.",
    noscript: `<h1>Créer un compte Cosmo gratuit</h1>
        <p>Inscrivez-vous gratuitement pour gérer vos tâches, habitudes, agenda et OKR dans une seule application. Connexion possible via Google.</p>
        <p><a href="/">Accueil</a> · <a href="/login">J'ai déjà un compte</a></p>`,
  },
  {
    path: '/login',
    title: 'Connexion – Cosmo, application de productivité',
    description: 'Connectez-vous à Cosmo pour accéder à vos tâches, habitudes, agenda et OKR.',
    noscript: `<h1>Connexion à Cosmo</h1>
        <p>Connectez-vous pour retrouver vos tâches, habitudes, agenda et objectifs OKR.</p>
        <p><a href="/">Accueil</a> · <a href="/signup">Créer un compte gratuit</a></p>`,
  },
  {
    path: '/cgu',
    title: "Conditions Générales d'Utilisation – Cosmo App",
    description: "Conditions générales d'utilisation de Cosmo, application de gestion de tâches, habitudes et OKR. Accès gratuit, règles d'utilisation et responsabilités.",
    noscript: `<h1>Conditions Générales d'Utilisation</h1>
        <p>Conditions générales d'utilisation de l'application Cosmo. <a href="/">Retour à l'accueil</a></p>`,
  },
  {
    path: '/mentions-legales',
    title: 'Mentions légales – Cosmo App',
    description: "Mentions légales de l'application de productivité Cosmo : éditeur, hébergeur, propriété intellectuelle et responsabilités.",
    noscript: `<h1>Mentions légales</h1>
        <p>Mentions légales de l'application Cosmo. <a href="/">Retour à l'accueil</a></p>`,
  },
  {
    path: '/politique-confidentialite',
    title: 'Politique de confidentialité – Cosmo App',
    description: 'Politique de confidentialité de Cosmo : données collectées, stockage sécurisé Supabase, Row Level Security, droits RGPD et contact.',
    noscript: `<h1>Politique de confidentialité</h1>
        <p>Politique de confidentialité de l'application Cosmo. <a href="/">Retour à l'accueil</a></p>`,
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

// Injecte le contenu indexable en HTML VISIBLE dans <div id="root"> : lu par
// tous les crawlers (Googlebot, Bing, GPTBot/ClaudeBot/PerplexityBot qui
// n'exécutent pas le JS), puis remplacé par React au premier render —
// createRoot().render() écrase les enfants existants du container.
// Le <noscript> devient redondant et est retiré (évite le contenu dupliqué).
function injectStaticContent(out, content) {
  const marker = '<div id="root"></div>';
  if (!out.includes(marker)) {
    console.warn('  ⚠ marqueur <div id="root"></div> introuvable — contenu statique non injecté');
    return out;
  }
  out = out.replace(
    marker,
    `<div id="root">\n      <div style="font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#1e293b">\n        ${content}\n      </div>\n    </div>`
  );
  out = out.replace(/<noscript>[\s\S]*?<\/noscript>\s*/, '');
  return out;
}

function buildPage(route) {
  let out = html;
  const url = `${BASE}${route.path}`;

  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${route.title}</title>`);
  out = out.replace(/<meta name="description" content="[\s\S]*?" \/>/, `<meta name="description" content="${esc(route.description)}" />`);
  out = out.replace(/<link rel="canonical" href="[\s\S]*?" \/>/, `<link rel="canonical" href="${url}" />`);
  out = out.replace(/<link rel="alternate" hreflang="fr" href="[\s\S]*?" \/>/, `<link rel="alternate" hreflang="fr" href="${url}" />`);
  out = out.replace(/<meta property="og:url" content="[\s\S]*?" \/>/, `<meta property="og:url" content="${url}" />`);
  out = out.replace(/<meta property="og:title" content="[\s\S]*?" \/>/, `<meta property="og:title" content="${esc(route.title)}" />`);
  out = out.replace(/<meta property="og:description" content="[\s\S]*?" \/>/, `<meta property="og:description" content="${esc(route.description)}" />`);
  out = out.replace(/<meta name="twitter:title" content="[\s\S]*?" \/>/, `<meta name="twitter:title" content="${esc(route.title)}" />`);
  out = out.replace(/<meta name="twitter:description" content="[\s\S]*?" \/>/, `<meta name="twitter:description" content="${esc(route.description)}" />`);

  // JSON-LD spécifique à la route, injecté avant </head>
  if (route.extraLd?.length) {
    out = out.replace('</head>', `    ${route.extraLd.map(({ obj, id }) => ld(obj, id)).join('\n    ')}\n  </head>`);
  }

  // Contenu indexable visible de la route, injecté dans #root
  out = injectStaticContent(out, route.noscript);

  return out;
}

// ── Génération ──────────────────────────────────────────────────────────
let count = 0;
for (const route of ROUTES) {
  const dir = join(DIST, route.path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), buildPage(route), 'utf8');
  count++;
  console.log(`  prerendered ${route.path}/index.html`);
}

// ── Home : FAQPage JSON-LD statique + contenu visible dans #root ──────────
let home = html;
if (!home.includes('"FAQPage"')) {
  home = home.replace('</head>', `    ${ld(faqSchema, 'faq-schema')}\n  </head>`);
  console.log('  injected FAQPage JSON-LD into index.html');
}
home = injectStaticContent(home, HOME_STATIC);
writeFileSync(join(DIST, 'index.html'), home, 'utf8');

// ── Sitemap : lastmod = date de build ─────────────────────────────────────
const sitemapPath = join(DIST, 'sitemap.xml');
try {
  const sitemap = readFileSync(sitemapPath, 'utf8');
  writeFileSync(sitemapPath, sitemap.replace(/<lastmod>[\d-]+<\/lastmod>/g, `<lastmod>${TODAY}</lastmod>`), 'utf8');
  console.log(`  sitemap lastmod → ${TODAY}`);
} catch {
  console.warn('  ⚠ dist/sitemap.xml introuvable — lastmod non mis à jour');
}

console.log(`✓ prerender done — ${count} routes + home (FAQ schema + contenu statique)`);
