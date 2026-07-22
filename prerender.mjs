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
    path: '/a-propos',
    title: 'À propos de Cosmo — qui sommes-nous ?',
    description: "Pourquoi Cosmo existe : une application de productivité française, gratuite, qui réunit tâches, habitudes, agenda et OKR dans un seul écosystème.",
    extraLd: [{ obj: breadcrumb('À propos', '/a-propos'), id: 'apropos-breadcrumb' }],
    noscript: `<h1>À propos de Cosmo</h1>
        <p>Cosmo est une application de productivité française, gratuite et tout-en-un : tâches, habitudes, agenda avec time-blocking et OKR connectés dans un seul écosystème. Produit indépendant, développé en France.</p>
        <h2>Cosmo, The Cosmo App ou thecosmo ?</h2>
        <p>Les trois désignent la même application : Cosmo, accessible à l'adresse thecosmo.app. On nous cherche aussi sous « Cosmo app », « The Cosmo » ou « thecosmo app » — c'est toujours nous. Cosmo est une application web sans téléchargement ; son seul site officiel est thecosmo.app.</p>
        <p><a href="/">Accueil</a> · <a href="/signup">Créer un compte gratuit</a> · <a href="/blog">Blog</a></p>`,
  },
  {
    path: '/blog',
    title: 'Blog Cosmo — Productivité, OKR, habitudes et time-blocking',
    description: "Guides pratiques sur la méthode OKR, le suivi d'habitudes, le time-blocking et la productivité personnelle. Par l'équipe de Cosmo.",
    extraLd: [
      { obj: breadcrumb('Blog', '/blog'), id: 'blog-breadcrumb' },
      {
        obj: {
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'Blog Cosmo',
          url: `${BASE}/blog`,
          inLanguage: 'fr-FR',
          publisher: { '@type': 'Organization', name: 'Cosmo', url: BASE },
          blogPost: ARTICLES.map((a) => ({
            '@type': 'BlogPosting',
            headline: a.title,
            url: `${BASE}/blog/${a.slug}`,
            datePublished: a.datePublished,
          })),
        },
        id: 'blog-schema',
      },
    ],
    noscript: `<h1>Le blog Cosmo</h1>
        <p>Guides pratiques sur la méthode OKR, les habitudes, le time-blocking et la productivité personnelle.</p>
        <ul>
          ${ARTICLES.map((a) => `<li><a href="/blog/${a.slug}">${a.title}</a> — ${a.description}</li>`).join('\n          ')}
        </ul>
        <p><a href="/">Accueil</a> · <a href="/signup">Créer un compte gratuit</a></p>`,
  },
  // Articles de blog — contenu complet visible (src/content/blog/*.mjs)
  ...ARTICLES.map((a) => ({
    path: `/blog/${a.slug}`,
    title: `${a.metaTitle} | Blog Cosmo`,
    description: a.description,
    extraLd: [
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
    noscript: `<p><a href="/">Accueil</a> › <a href="/blog">Blog</a></p>
        <h1>${a.title}</h1>
        ${a.html}
        <h2>À lire ensuite</h2>
        <ul>
          ${ARTICLES.filter((o) => o.slug !== a.slug).slice(0, 3).map((o) => `<li><a href="/blog/${o.slug}">${o.title}</a></li>`).join('\n          ')}
        </ul>
        <p><a href="/blog">← Tous les articles</a> · <a href="/signup">Essayer Cosmo gratuitement</a></p>`,
  })),
  // Pages use-case commerciales — contenu complet visible (src/content/use-cases.mjs)
  ...USE_CASES.map((u) => ({
    path: `/${u.slug}`,
    title: `${u.metaTitle} | Cosmo`,
    description: u.description,
    extraLd: [{ obj: breadcrumb(u.title, `/${u.slug}`), id: `usecase-${u.slug}-breadcrumb` }],
    noscript: `<h1>${u.title}</h1>
        <p>${u.lead}</p>
        ${u.html}
        <p><a href="/">Accueil</a> · <a href="/signup">Créer un compte gratuit</a> · <a href="/guide">Guide d'utilisation</a></p>`,
  })),
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
function injectStaticContent(out, content) {
  const marker = '<div id="root">';
  if (!out.includes(marker)) {
    console.warn('  ⚠ marqueur <div id="root"> introuvable — contenu statique non injecté');
    return out;
  }
  out = out.replace(marker, `${marker}\n      <div id="seo-fallback">\n        ${content}\n      </div>`);
  out = out.replace(/<noscript id="seo-noscript">[\s\S]*?<\/noscript>\s*/, '');
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

// ── Sitemap : lastmod = date de build + URLs blog/à-propos générées ───────
const sitemapPath = join(DIST, 'sitemap.xml');
const sitemapEntry = (loc, lastmod, changefreq, priority) =>
  `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
try {
  let sitemap = readFileSync(sitemapPath, 'utf8');
  sitemap = sitemap.replace(/<lastmod>[\d-]+<\/lastmod>/g, `<lastmod>${TODAY}</lastmod>`);
  const generated =
    sitemapEntry(`${BASE}/a-propos`, TODAY, 'yearly', '0.5') +
    sitemapEntry(`${BASE}/blog`, TODAY, 'weekly', '0.8') +
    ARTICLES.map((a) => sitemapEntry(`${BASE}/blog/${a.slug}`, a.dateModified, 'monthly', '0.7')).join('') +
    USE_CASES.map((u) => sitemapEntry(`${BASE}/${u.slug}`, TODAY, 'monthly', '0.7')).join('');
  sitemap = sitemap.replace('</urlset>', `${generated}</urlset>`);
  writeFileSync(sitemapPath, sitemap, 'utf8');
  console.log(`  sitemap → lastmod ${TODAY} + ${2 + ARTICLES.length + USE_CASES.length} URLs générées (blog, à-propos, use-cases)`);
} catch {
  console.warn('  ⚠ dist/sitemap.xml introuvable — sitemap non enrichi');
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
