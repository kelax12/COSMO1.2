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
import { ARTICLES, relatedArticles } from './src/content/blog/index.mjs';
import { USE_CASES } from './src/content/use-cases.mjs';
import { CONTACT_EMAIL } from './src/lib/contact.mjs';
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
// Date de build — utilisée UNIQUEMENT là où « date du build » est la bonne
// réponse : le `lastBuildDate` du flux RSS.
const TODAY = new Date().toISOString().slice(0, 10);

// ── Dates de contenu (`lastmod` du sitemap, `dateModified` des JSON-LD) ───
//
// 🔴 Ne JAMAIS y remettre la date du build. Un sitemap qui déclare « toutes
// les pages ont changé aujourd'hui » à chaque déploiement apprend à Google à
// ignorer le champ entièrement — et un `dateModified` en JSON-LD qui avance
// sans que la copie bouge est un signal de fraîcheur artificielle.
//
// Les articles portent déjà leur `dateModified` (registre `ARTICLES`) et les
// use-cases le leur (registre `USE_CASES`). Ne restent ici que les pages dont
// le contenu prérendu vit dans CE fichier : à mettre à jour quand on retouche
// leur copie, au même titre que le titre ou la meta description.
const CONTENT_LASTMOD = {
  site: '2026-08-17', // JSON-LD global (SoftwareApplication, Organization)
  '/': '2026-08-17',
  '/guide': '2026-08-02',
  '/a-propos': '2026-08-03',
  '/entreprise-presentation': '2026-08-17',
};

let html = readFileSync(join(DIST, 'index.html'), 'utf8');
html = html.replace(/"dateModified":\s*"[\d-]+"/g, `"dateModified": "${CONTENT_LASTMOD.site}"`);

// ── FAQ ───────────────────────────────────────────────────────────────────
// LUE dans le catalogue que rend l'application (`faq.q1…qN`), pas recopiée ici.
//
// Les deux copies avaient divergé sans que rien ne le signale : 10 items ici
// contre 12 dans l'app, avec des réponses différentes — dont une qui promettait
// un « accès Premium en regardant une publicité » que le produit n'applique
// pas (`PREMIUM_ENFORCED = false`). Google comparait donc un balisage FAQPage à
// un contenu visible qui ne disait pas la même chose, ce qui est exactement ce
// que la doc schema.org interdit. Une seule source, plus de synchro à tenir.
//
// La home n'est publiée que dans la locale par défaut tant qu'elle n'est pas
// traduite, donc le schéma est construit depuis ce catalogue-là.
const LANDING_FAQ = JSON.parse(
  readFileSync(join(__dirname, 'src/locales', DEFAULT_LOCALE, 'landing.json'), 'utf8')
).faq;

const FAQ_ITEMS = Object.keys(LANDING_FAQ)
  .filter((key) => /^q\d+$/.test(key))
  .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  .map((qKey) => [LANDING_FAQ[qKey], LANDING_FAQ[`a${qKey.slice(1)}`]])
  .filter(([question, answer]) => question && answer);

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
        <p>Ce guide couvre les six zones de Cosmo, dans l'ordre où on les découvre en pratique. Comptez une quinzaine de minutes pour tout parcourir, mais rien n'oblige à tout mettre en place le premier jour : les tâches seules suffisent à démarrer utilement.</p>
        <h2>Prise en main</h2>
        <p>Deux entrées possibles. Le <strong>mode démo</strong> ouvre l'application complète sans inscription, pré-remplie de 12 mois de données : c'est la bonne façon d'explorer sans rien construire. Le <strong>compte gratuit</strong> se crée en trente secondes, par email ou via Google, et vos données vous suivent alors d'un appareil à l'autre. Au premier login, Cosmo demande quels modules afficher : gardez-en peu au début, tout se réactive plus tard dans Réglages → Modules.</p>
        <h2>Tâches</h2>
        <p>Le socle. Une tâche porte un nom, une description, une priorité de 1 à 5, une catégorie colorée, une échéance et une liste. Les filtres se combinent pour isoler ce qui compte maintenant ; les listes servent aux regroupements durables (un client, un projet, un cours). Une tâche récurrente se régénère automatiquement quand vous la cochez, et les sous-tâches découpent ce qui est trop gros pour être commencé. Le partage se fait par email, en rôle Lecteur ou Éditeur, gratuitement.</p>
        <h2>Habitudes</h2>
        <p>Créez l'habitude, choisissez sa fréquence (quotidienne, hebdomadaire ou jours précis), puis cochez au fil des jours. La heatmap 26 semaines montre la régularité réelle, le streak compte les jours consécutifs et le taux de complétion situe la période en cours. Conseil qui change tout : deux ou trois habitudes maximum au démarrage, quitte à en ajouter dans un mois. Une liste de quinze habitudes se solde à peu près toujours par un abandon global.</p>
        <h2>Agenda</h2>
        <p>L'agenda accepte des événements classiques, mais son intérêt est ailleurs : glissez une tâche depuis le panneau latéral vers un créneau, l'événement se crée et reste lié à la tâche. C'est le <a href="/blog/time-blocking-guide">time-blocking</a>, et c'est ce qui transforme une liste d'intentions en semaine réaliste. Vues jour, semaine et mois ; les événements récurrents se gèrent depuis la même fiche.</p>
        <h2>OKR</h2>
        <p>Un objectif qualitatif, 2 à 5 résultats clés chiffrés. Vous mettez à jour la valeur courante d'un résultat clé, Cosmo recalcule la progression de l'objectif et enregistre chaque complétion dans votre historique, c'est cette trace qui alimente le graphique du dashboard. Si vous débutez avec la méthode, l'article <a href="/blog/methode-okr-exemples">méthode OKR et 15 exemples</a> donne des formulations prêtes à adapter.</p>
        <h2>Statistiques</h2>
        <p>Temps investi par catégorie, évolution sur la période choisie, comparaison entre modules. C'est la page à ouvrir en fin de semaine ou de mois : elle répond à « où est parti mon temps ? » avec des chiffres plutôt qu'avec une impression, et c'est souvent là que se décide le prochain ajustement.</p>
        <p><a href="/">Retour à l'accueil</a> · <a href="/signup">Créer un compte gratuit</a> · <a href="/blog">Le blog</a></p>`,
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

        <h2>Pourquoi Cosmo existe</h2>
        <p>La plupart des gens organisés utilisent trois ou quatre outils : un gestionnaire de tâches, un traqueur d'habitudes, un agenda, et un tableur pour les objectifs annuels qu'on rouvre deux fois par an. Chacun fait bien son travail, aucun ne voit l'ensemble. Résultat : les objectifs de fond n'ont aucun poids face à l'urgence du jour, parce qu'ils ne sont écrits nulle part où on regarde tous les matins.</p>
        <p>Cosmo est né de ce constat. Réunir les quatre dans un seul produit ne relève pas de la commodité : c'est ce qui permet à un objectif trimestriel de descendre en tâches concrètes, à une tâche de recevoir un vrai créneau dans l'agenda, et aux statistiques de montrer l'écart entre ce que vous visez et ce que vous faites. Aucun de ces liens n'est possible quand les données vivent dans quatre applications séparées.</p>

        <h2>Nos partis pris</h2>
        <ul>
          <li><strong>Gratuit pour l'essentiel.</strong> Tâches, habitudes, agenda, OKR, statistiques et partage de tâches sont gratuits, sans carte bancaire ni essai à durée limitée. La collaboration en particulier restera gratuite : une app d'organisation qui fait payer le fait d'inviter quelqu'un se prive de la seule chose qui la rend utile à plusieurs.</li>
          <li><strong>Utilisable en deux minutes.</strong> Le mode démo ouvre l'application complète, pré-remplie de 12 mois de données réalistes, sans compte ni email. On juge un outil d'organisation chargé, pas devant un écran vide.</li>
          <li><strong>Mobile d'abord.</strong> Cosmo se conçoit d'abord pour un téléphone tenu à une main, puis s'élargit à l'écran d'ordinateur, pas l'inverse. Aucune installation : tout fonctionne dans le navigateur.</li>
          <li><strong>Vos données vous appartiennent.</strong> Stockage Supabase avec Row Level Security : chaque ligne est cloisonnée à son propriétaire au niveau de la base, pas seulement dans l'interface. En mode démo, rien ne quitte votre navigateur. Suppression de compte définitive et complète, sur demande depuis les réglages.</li>
        </ul>

        <h2>Cosmo, The Cosmo App ou thecosmo ?</h2>
        <p>Les trois désignent la même application : Cosmo, accessible à l'adresse thecosmo.app. On nous cherche aussi sous « Cosmo app », « The Cosmo » ou « thecosmo app », c'est toujours nous. Plusieurs autres produits sans rapport portent le nom « Cosmo » (une radio allemande, des applications mobiles diverses) : Cosmo est une application web de productivité, sans téléchargement, et son seul site officiel est thecosmo.app.</p>

        <h2>Nous écrire</h2>
        <p>Le projet est développé par une équipe indépendante, en France. Une question, un bug, une idée de fonctionnalité, une demande presse : écrivez à axellongattepro@gmail.com : les retours d'utilisateurs orientent réellement la feuille de route.</p>
        <p><a href="/">Accueil</a> · <a href="/signup">Créer un compte gratuit</a> · <a href="/blog">Blog</a> · <a href="/guide">Guide d'utilisation</a></p>`,
    },
  },
  {
    // Track entreprise de la landing. Il a son propre chemin — donc son propre
    // titre, sa propre description et son propre corps indexable — parce que
    // « Cosmo pour une organisation » et « Cosmo pour moi » ne répondent pas à
    // la même requête. Le contenu ci-dessous reprend les arguments du track
    // (src/pages/landing/entreprise/) : à retoucher si la copie change.
    path: '/entreprise-presentation',
    meta: fromCatalog('enterprisePresentation'),
    extraLd: (locale) => [
      {
        obj: breadcrumb('Cosmo Entreprise', '/entreprise-presentation', locale),
        id: 'entreprise-breadcrumb',
      },
    ],
    content: {
      fr: `<h1>Cosmo Entreprise, votre organigramme est votre moteur d'exécution</h1>
        <p>Dans Cosmo Entreprise, le périmètre de chacun découle de votre organigramme : ce qu'il voit, ce qu'on lui assigne, ce qu'on mesure. Chaque collaborateur garde par ailleurs le Cosmo personnel qu'il utilise déjà, ce qui évite d'avoir un outil de plus à faire adopter. La mise en place tient en quatre étapes.</p>

        <h2>Étape 1 : invitez votre équipe et regroupez-la</h2>
        <p>Chacun rejoint l'organisation avec le compte Cosmo qu'il a déjà, par code d'organisation ou par lien à usage unique, et vous le rattachez à son responsable. Vous créez ensuite autant d'équipes que nécessaire et y placez les personnes que vous voulez, une même personne pouvant appartenir à plusieurs équipes. De ce seul lien de rattachement découlent les accès : un responsable voit son sous-arbre complet (ses équipes, leurs projets, leurs objectifs, leurs statistiques) sans qu'aucun droit n'ait à être coché à la main. Un changement de rattachement suffit à réorganiser, parce que les droits ne sont recopiés nulle part : ils sont recalculés depuis le lien.</p>
        <p>L'organigramme n'est pas un trombinoscope, c'est l'écran depuis lequel on suit chaque personne : ouvrir sa fiche donne ses tâches en cours, sa charge et son agenda. Un responsable peut créer, déplacer et modifier les événements de l'agenda des personnes qui lui reportent ; ce qu'elles ont marqué comme personnel reste privé, seul le créneau apparaît. Deux branches sœurs de l'organigramme, elles, sont cloisonnées, et la règle est appliquée en base de données, pas seulement masquée dans l'interface.</p>
        <p><img src="/screenshots/entreprise/pyramide.webp" width="1500" height="938" alt="Onglet Pyramide de Cosmo Entreprise : l'organigramme de l'organisation, chaque membre rattaché à son manager" /></p>

        <h2>Étape 2 : créez vos projets et attribuez-les à l'échelle voulue</h2>
        <p>Un projet appartient à une équipe et rassemble ses tâches. Vous les assignez à une personne ou à plusieurs, dans tout votre périmètre, et chacune les retrouve dans son propre Cosmo à côté de ses tâches personnelles. Kanban pour savoir où en est chaque tâche, frise chronologique pour voir arriver les échéances, avec sous-tâches, labels, commentaires à mentions et historique des modifications.</p>
        <p><img src="/screenshots/entreprise/projets.webp" width="1500" height="938" alt="Onglet Projets de Cosmo Entreprise : les projets par équipe avec leurs tâches, échéances et personnes assignées" /></p>

        <h2>Étape 3 : posez vos objectifs, à toutes les échelles</h2>
        <p>Un objectif d'organisation se décline en OKR d'équipe, chaque OKR en résultats clés chiffrés : le même mécanisme à chaque niveau, dans les catégories que vous définissez. Chaque résultat clé atteint est journalisé à la date où il l'a été, dans un journal qui ne se réécrit pas après coup, c'est ce qui rend la courbe du tableau de bord opposable en comité.</p>
        <p><img src="/screenshots/entreprise/okr.webp" width="1500" height="938" alt="Onglet OKR de Cosmo Entreprise : les objectifs d'équipe et leurs résultats clés chiffrés, avec leur progression" /></p>

        <h2>Étape 4 : suivez la progression de chacun</h2>
        <p>L'onglet Statistiques répond à la question du lundi matin : qui avance, qui décroche, qui est surchargé. Vélocité et tendance sur la période comparée aux précédentes, tâches ouvertes et retards de chaque membre, temps investi agrégé par équipe et par projet. Une direction lit toute l'organisation, un responsable lit son périmètre, et c'est le rattachement posé à l'étape 1 qui le décide. L'aperçu, lui, ouvre chaque journée : vos tâches assignées, vos échéances et ce qui vient de bouger chez vos équipes.</p>
        <p><img src="/screenshots/entreprise/statistiques.webp" width="1500" height="938" alt="Onglet Statistiques de Cosmo Entreprise : progression des OKR et charge de travail de chaque membre de l'équipe" /></p>

        <h2>Sécurité, confidentialité et réversibilité</h2>
        <p>Chaque table est protégée par des politiques d'accès évaluées côté serveur : une requête forgée depuis le navigateur ne rapporte rien de plus qu'une requête légitime. Un manager voit le travail de son périmètre, jamais les tâches, habitudes ou agenda personnels de ses collaborateurs. Effacement du compte réellement exécuté côté serveur, consentement explicite à l'entrée dans une organisation, aucune donnée revendue. Transfert de propriété et suppression de l'organisation sont dans l'interface, pas dans un ticket de support.</p>

        <h2>Tarifs</h2>
        <p>Un forfait pour toute l'organisation, quel que soit le nombre de projets, et non un tarif par personne : gratuit jusqu'à 5 membres, 20 € par mois de 5 à 10 membres, 50 € de 10 à 20, 100 € de 20 à 50, et 200 € au-delà de 50. Le forfait s'ajuste tout seul quand l'organisation grandit et redescend si l'effectif baisse. Sans engagement, résiliable à tout moment, sans carte bancaire pour démarrer.</p>

        <p><a href="/">Cosmo pour moi</a> · <a href="/signup">Créer mon organisation</a> · <a href="/guide">Guide d'utilisation</a></p>`,
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
      // Chaque article sort en <h2> plutôt qu'en <li> : l'index n'avait
      // AUCUN titre de niveau 2 dans le HTML prérendu, donc aucune structure
      // exploitable pour un crawler sans JS.
      fr: `<h1>Le blog Cosmo</h1>
        <p>Guides pratiques sur la méthode OKR, le suivi d'habitudes, le time-blocking et la productivité personnelle. ${ARTICLES.length} articles, écrits pour être utiles sans avoir à installer quoi que ce soit.</p>
        ${ARTICLES.map((a) => `<h2><a href="/blog/${a.slug}">${a.title}</a></h2>
        <p>${a.description} <a href="/blog/${a.slug}">Lire l'article</a>, ${a.readingMinutes} min de lecture.</p>`).join('\n        ')}
        <p><a href="/">Accueil</a> · <a href="/signup">Créer un compte gratuit</a> · <a href="/rss.xml">Flux RSS</a></p>`,
    },
  },
  // Articles de blog — contenu complet visible (src/content/blog/*.mjs).
  // Français uniquement (phase 3) : ils ne reçoivent donc que `x-default`, et
  // aucune alternate `en`/`es` — déclarer une alternate vers une page qui
  // n'existe pas est une erreur Search Console.
  ...ARTICLES.map((a) => ({
    path: `/blog/${a.slug}`,
    // Pas de suffixe de marque : « | Blog Cosmo » coûtait 12 caractères et
    // poussait 6 titres au-delà des ~60 affichés par Google (donc tronqués).
    // Google affiche de toute façon le nom du site sous le titre.
    meta: { fr: { title: a.metaTitle, description: a.description } },
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
          ${relatedArticles(a).map((o) => `<li><a href="/blog/${o.slug}">${o.title}</a></li>`).join('\n          ')}
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

// Contenu statique de la home.
//
// ⚠ Ce bloc n'est PAS décoratif : c'est la seule version de la home que voient
// les crawlers qui n'exécutent pas JavaScript (GPTBot, ClaudeBot,
// PerplexityBot, la plupart des outils d'audit SEO, et Googlebot avant son
// passage de rendu). Il faisait 161 mots au 2026-08-12 — soit un résumé de
// trois phrases là où la page React en développe dix fois plus.
//
// Règle : chaque section décrit une capacité RÉELLE du produit. Un bloc SEO qui
// promet ce que l'app ne fait pas se paie en rebond, donc en classement.
const HOME_STATIC = `<h1>Cosmo – Gestionnaire de tâches, habitudes et OKR</h1>
        <p>Cosmo est une application de productivité gratuite qui réunit quatre outils habituellement séparés : la gestion de tâches, le suivi d'habitudes, l'agenda avec time-blocking et la méthode OKR (Objectives &amp; Key Results). L'idée de départ est simple : vos tâches du jour, vos routines et vos objectifs de fond décrivent la même vie, ils n'ont aucune raison de vivre dans trois applications qui s'ignorent.</p>
        <p>Tout fonctionne dans le navigateur, sur ordinateur comme sur mobile, sans installation. Vous pouvez <a href="/">essayer la démo sans créer de compte</a> : elle s'ouvre pré-remplie avec 12 mois de données réalistes (100 tâches, 100 habitudes, environ 150 événements d'agenda et 8 OKR) : de quoi juger le produit chargé plutôt que face à un écran vide.</p>

        <h2>Gérer ses tâches sans se noyer</h2>
        <p>Chaque tâche porte une priorité de 1 à 5, une catégorie colorée, une échéance et, si besoin, une liste. Les filtres croisent ces critères pour répondre à la seule question qui compte le matin : qu'est-ce que je fais maintenant ? Les tâches récurrentes se régénèrent automatiquement une fois cochées, les sous-tâches découpent ce qui est trop gros, et la recherche retrouve n'importe quel élément instantanément. Les tâches se partagent aussi avec d'autres utilisateurs, en lecture ou en édition, cette collaboration est gratuite et le restera.</p>

        <h2>Suivre ses habitudes et voir sa régularité</h2>
        <p>Une habitude se définit par sa fréquence : quotidienne, hebdomadaire, ou sur des jours précis. Vous cochez, Cosmo mesure. La heatmap sur 26 semaines, dans l'esprit du graphe de contributions GitHub, rend la régularité visible d'un coup d'œil, bien mieux qu'un chiffre isolé. Le streak compte vos jours consécutifs, le taux de complétion situe la période en cours par rapport aux précédentes. La règle qui marche : commencer par deux ou trois habitudes, pas quinze.</p>

        <h2>Le time-blocking, pour que le planning devienne réel</h2>
        <p>Une tâche sans créneau reste une intention. L'agenda de Cosmo accepte le glisser-déposer depuis le panneau des tâches : vous déposez « rédiger la proposition » mardi à 14 h, l'événement se crée et reste lié à la tâche. Vues jour, semaine et mois, gestion des événements récurrents. L'intérêt du time-blocking n'est pas cosmétique, il confronte votre liste à la seule ressource vraiment limitée, les heures disponibles dans la semaine.</p>

        <h2>Piloter ses objectifs avec la méthode OKR</h2>
        <p>La <a href="/blog/methode-okr-exemples">méthode OKR</a>, popularisée par Intel puis Google, structure un objectif ambitieux en 2 à 5 résultats clés mesurables. Cosmo calcule la progression de chaque résultat clé et de l'objectif global, et archive chaque complétion pour construire votre historique. Ce que la plupart des outils OKR ne font pas : ici, vos objectifs trimestriels cohabitent avec vos tâches quotidiennes, ce qui rend visible l'écart entre ce que vous visez et ce sur quoi vous passez réellement vos journées.</p>

        <h2>À quoi ça ressemble</h2>
        <p>Trois écrans de l'application, en mode démo :</p>
        <p>
          <img src="/screenshots/dashboard.png" width="1280" height="800" alt="Tableau de bord Cosmo : tâches complétées, événements d'agenda, résultats clés atteints et habitudes du jour réunis sur un seul écran" />
          <img src="/screenshots/taches.png" width="1280" height="800" alt="Gestionnaire de tâches Cosmo : listes d'accès rapide, filtres par priorité et catégorie, tâches en retard signalées" />
          <img src="/screenshots/habitudes.png" width="1280" height="800" alt="Suivi d'habitudes Cosmo : tableau hebdomadaire des habitudes cochées avec série de jours consécutifs pour chacune" />
        </p>

        <h2>Un tableau de bord qui relie les quatre</h2>
        <p>Le dashboard réunit l'avancement du jour, les habitudes à cocher, les prochains événements et la courbe des résultats clés atteints. La page Statistiques va plus loin : temps investi par catégorie, évolution sur la période, comparaison entre modules. C'est le tableau de bord de productivité qui manque quand chaque outil ne connaît qu'un quart de votre activité.</p>

        <h2>Combien ça coûte ?</h2>
        <p>Les fonctionnalités principales (tâches, habitudes, agenda, OKR, statistiques, partage) sont gratuites, sans carte bancaire ni essai limité dans le temps. Vos données sont stockées sur Supabase avec Row Level Security : personne d'autre que vous n'y accède. En mode démo, rien ne quitte votre navigateur.</p>
        <h2>Et pour une organisation ?</h2>
        <p>Cosmo existe aussi en mode entreprise : votre pyramide managériale y structure les projets, les OKR et les statistiques d'équipe, et le périmètre de chacun découle de la hiérarchie réelle plutôt que de partages faits à la main. Chaque collaborateur conserve le Cosmo personnel décrit ci-dessus. C'est gratuit jusqu'à 5 membres, <a href="/entreprise-presentation">découvrir Cosmo Entreprise</a>.</p>
        <p><a href="/signup">Créer un compte gratuit</a> · <a href="/guide">Guide d'utilisation</a> · <a href="/blog">Le blog Cosmo</a></p>`;

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
    link('/entreprise-presentation', 'Cosmo Entreprise'),
    link('/blog', 'Blog'),
    link('/pour-freelances', 'Pour les freelances'),
    link('/pour-etudiants', 'Pour les étudiants'),
    link('/pour-managers', 'Pour les managers'),
    link('/pour-equipes', 'Pour les équipes'),
    link('/a-propos', 'À propos'),
    link('/signup', 'Inscription gratuite'),
    link('/login', 'Connexion'),
    link('/mentions-legales', 'Mentions légales'),
    link('/politique-confidentialite', 'Confidentialité'),
    link('/cgu', 'CGU'),
    // Adresse de contact — même bloc que la nav statique parce qu'elle doit
    // être lisible par un crawler sans JS, exactement comme le footer React
    // l'affiche pour un vrai navigateur.
    `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`,
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
    console.warn('  ⚠ marqueur <div id="root"> introuvable, contenu statique non injecté');
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
    console.warn(`  ⚠ ${route.path}, aucune locale complète (méta + contenu), route ignorée`);
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

// ── Sitemap : lastmod = date de CONTENU + URLs blog/à-propos générées ─────
const sitemapPath = join(DIST, 'sitemap.xml');

/** La date de l'index du blog est celle de son article le plus récemment modifié. */
const BLOG_LASTMOD = ARTICLES.reduce((max, a) => (a.dateModified > max ? a.dateModified : max), '');
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
  // Les deux URLs du socle (`public/sitemap.xml`) reçoivent leur date de
  // contenu, pas celle du build (cf. CONTENT_LASTMOD). Remplacement par
  // index plutôt que par regex : une URL contient `/` et `.`, qu'il faudrait
  // sinon échapper à la main dans le motif.
  const stampLastmod = (xml, path, date) => {
    const at = xml.indexOf(`<loc>${BASE}${path}</loc>`);
    if (at === -1) return xml;
    const open = xml.indexOf('<lastmod>', at);
    const close = xml.indexOf('</lastmod>', open);
    if (open === -1 || close === -1) return xml;
    return xml.slice(0, open) + `<lastmod>${date}` + xml.slice(close);
  };
  sitemap = stampLastmod(sitemap, '/', CONTENT_LASTMOD['/']);
  sitemap = stampLastmod(sitemap, '/guide', CONTENT_LASTMOD['/guide']);

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
    // Priorité 0.9 : c'est la page qui porte l'offre payante, juste sous la home.
    sitemapGroup(
      '/entreprise-presentation',
      localesOf('/entreprise-presentation'),
      CONTENT_LASTMOD['/entreprise-presentation'],
      'monthly',
      '0.9'
    ) +
    sitemapGroup('/a-propos', localesOf('/a-propos'), CONTENT_LASTMOD['/a-propos'], 'yearly', '0.5') +
    // L'index du blog change quand un article change : sa date EST la plus
    // récente des `dateModified` du registre.
    sitemapGroup('/blog', localesOf('/blog'), BLOG_LASTMOD, 'weekly', '0.8') +
    ARTICLES.map((a) =>
      sitemapGroup(`/blog/${a.slug}`, localesOf(`/blog/${a.slug}`), a.dateModified, 'monthly', '0.7')
    ).join('') +
    USE_CASES.map((u) =>
      sitemapGroup(`/${u.slug}`, localesOf(`/${u.slug}`), u.dateModified, 'monthly', '0.7')
    ).join('');

  sitemap = sitemap.replace('</urlset>', `${generated}</urlset>`);
  writeFileSync(sitemapPath, sitemap, 'utf8');
  const urlCount = (generated.match(/<loc>/g) ?? []).length;
  console.log(`  sitemap → ${urlCount} URLs générées (blog, à-propos, use-cases), lastmod = dates de contenu`);
} catch (err) {
  console.warn(`  ⚠ dist/sitemap.xml non enrichi, ${err.message}`);
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
    <title>Blog Cosmo, Productivité, OKR, habitudes et time-blocking</title>
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
  console.warn('  ⚠ dist/llms.txt introuvable, llms.txt non enrichi');
}

console.log(`✓ prerender done, ${count} routes + home (FAQ schema + contenu statique)`);
