# SEO

**Quand lire** : avant de toucher `prerender/**`, `public/robots.txt`, `public/sitemap.xml`, `vercel.json` (en-têtes `X-Robots-Tag`), `src/locales/*/seo.json`, `src/content/blog/**`, `src/i18n/seo-urls.mjs`, `scripts/capture-entreprise-shots.mjs`. **Fait foi** : `dist/` après `npm run build`, jamais la lecture de `prerender/`.

Historique mesuré (audit du prérendu, Search Console, bascule de l'anglais, récits) : [`archive/SEO-etat-mesure-et-recits-avant-2026-11-13.md`](./archive/SEO-etat-mesure-et-recits-avant-2026-11-13.md) et [`archive/SEO-journal-des-notes-2026-01-10-au-2026-11-06.md`](./archive/SEO-journal-des-notes-2026-01-10-au-2026-11-06.md). Indicateurs : [`INDICATEURS.md`](./INDICATEURS.md). Chiffres : [`FAITS.md`](./FAITS.md).

## Priorité

- 🔴 Le facteur limitant est l'autorité de domaine (liens entrants), pas la technique ni la longueur des articles : un domaine sans lien entrant ne se classe sur rien. Cible : 20 domaines référents ; kit et suivi : [`ACQUISITION-BACKLINKS.md`](./ACQUISITION-BACKLINKS.md).
- ❌ Ne publier ni approfondir un article tant que cette cible n'est pas approchée. Premier signal : une page sous la position 30 sur une requête non-marque.
- ❌ Ne pas « optimiser les titles pour le CTR » : le CTR non-marque est nul faute d'impressions, et la position moyenne toutes requêtes est un artefact du mot « cosmo » (générique). Toujours refiltrer en non-marque.
- ⚠️ Hors de portée du dépôt (Search Console, Ahrefs Webmaster Tools, PageSpeed Insights) : pages réellement indexées, type de propriété GSC (domaine, pas préfixe d'URL), domaines référents, Core Web Vitals terrain.

## Prérendu

Le HTML servi aux moteurs sort de `prerender/` (TypeScript), lancé par `npm run build` après `vite build` : `node --disable-warning=ExperimentalWarning prerender/main.ts`. Dans `tsc -b`, le lint et le plafond de taille de fichier (`architecture.guard.test.ts`).

| Fichier | Rôle |
|---|---|
| `main.ts` | l'ordre des étapes, rien d'autre |
| `routes.ts`, `routes-registries.ts` | les routes : pages écrites ici, index du blog, articles, cas d'usage |
| `content/` | corps HTML indexables écrits en dur |
| `page.ts` | une page : `<head>` (méta, OG, `canonical`, `hreflang`), JSON-LD, corps |
| `ld.ts`, `chrome.ts` | JSON-LD et image OG ; fil d'Ariane, pied de page, libellés par locale |
| `copies.ts` | copies peintes avant React (`#lp-hero`) |
| `verify.ts` | un seul `<h1>` par page, plancher de mots du guide : le build échoue sinon |
| `generate.ts` | écriture de `dist/<route>/index.html` par route et par locale publiée |
| `sitemap.ts`, `feeds.ts` | `sitemap.xml` (`hreflang` réciproques), `rss.xml`, sections générées de `llms.txt` |
| `config.ts`, `flags.ts`, `types.ts` | constantes, dates de contenu (`CONTENT_LASTMOD`), miroir des prix, types |
| `instantanes/` | HTML attendu de chaque sortie ([`TESTING.md`](./TESTING.md) § Instantanés du prérendu) |

- 🔴 Node retire les types lui-même, sans `tsx` : seule la syntaxe effaçable est permise (pas d'`enum`, de `namespace` ni de propriété de paramètre), les imports relatifs portent `.ts`, l'alias `@/` n'existe que pour `import type`.
- ✅ `npm run check:prerender` compare chaque sortie à `prerender/instantanes/` (dans `ci-noyau.yml`) : un changement de HTML involontaire se voit.
- ✅ Toute page indexable a un titre unique, une description unique, un `<h1>`, un `canonical` absolu, un `alt` sur chaque image ; JSON-LD : `SoftwareApplication`, `Organization`, `WebSite`, `FAQPage` (accueil, suit la locale), `BlogPosting` + `BreadcrumbList` (articles).
- ✅ Image OG par page : `public/og/<clé>.jpg`, rendues par `scripts/capture-og-images.mjs` (Playwright, après `npm run build`) et commitées, le build Vercel n'ayant pas de navigateur. Garde : `src/og-images.guard.test.ts`. ⚠️ Article neuf : relancer le script.
- ✅ Le 404 est une vraie page `noindex` (statut HTTP 200, limite SPA assumée) ; le `noindex` est aussi dans le HTML serveur (`app.html`, sans `index` ni canonical vers `/`) pour les crawlers qui n'exécutent pas le JS.
- ✅ `useLandingSeoMeta(track)` pose le canonical de la landing côté client ; sinon `/entreprise-presentation` serait réécrit vers `/`. Témoin : `src/lib/useSeoMeta.test.ts`.
- ✅ `rss.xml`, `robots.txt` (routes applicatives bloquées, sitemap déclaré), `X-Robots-Tag: noindex` sur invitations, reset de mot de passe et pages légales.

## Ajouter une page publique indexable

1. Route dans `src/App.tsx` ET slug dans `src/i18n/route-slugs.json`.
2. Méta dans `src/locales/<locale>/seo.json` (titre 50 à 60 caractères, description 140 à 155).
3. Vérifier qu'elle sort dans `dist/` après `npm run build` : le prérendu est la source de vérité de ce que Google voit.
4. ❌ Ne pas la lister à la main dans `public/sitemap.xml` : `prerender/sitemap.ts` la tire des registres ; le socle statique est vide et ne porte que les pages sans registre.
5. Un `<h1>` et un seul.

- ⚠️ `/entreprise-presentation` rend le même composant que `/` (`LandingPage`, parcours entreprise) avec son propre `<h1>`, ses propres méta et son propre bloc `content` dans `prerender/`, priorité sitemap 0.9. Retoucher son corps prérendu quand la copie de `src/pages/landing/entreprise/` change, sinon le prérendu ment sur ce que la page affiche.

## Captures de la landing entreprise

`public/screenshots/entreprise/*.webp` sont de vraies captures de l'espace entreprise en mode démo (`landing/entreprise/AppShot`, prérendu de `/entreprise-presentation`). ⚠️ Une capture périmée ment sur le produit : reprendre dès que l'UI entreprise change.

1. Serveur de dev en mode démo forcé (`dev-landing-shots` dans `.claude/launch.json`, variables Supabase vides), puis `SHOTS_BASE=http://localhost:5521 node scripts/capture-entreprise-shots.mjs`.
2. Le script pose `theme = 'noir'` avant la démo, neutralise ce qui ne s'affiche qu'une fois (glossaire, carte « Gardez votre organisation », bandeau démo) et replie la barre latérale.
3. Viewport 1280 de large (au-delà, l'UI devient illisible réduite), cadrage 16/10 : colonne principale et panneau de navigation de droite.
4. WebP 1600 px ré-encodés par le canvas de Chromium ; l'ensemble tient sous 1 Mo.
5. Mettre à jour les `alt` (`enterprise.shot.*Alt` du catalogue `landing`, et les `<img>` de `prerender/content/entreprise.ts`) si le contenu des écrans change.
6. ❌ L'onglet Statistiques est masqué de la navigation : ne pas le recapturer. L'étape « Suivi » montre `rapports.webp`.

## `lastmod` et `dateModified`

- ❌ Ne jamais réintroduire `TODAY` dans le sitemap ni dans un `dateModified` : « tout a changé aujourd'hui » à chaque déploiement apprend à Google à ignorer le champ. `TODAY` ne sert qu'au `lastBuildDate` du RSS.
- ✅ Source de la date : articles = `dateModified` du registre `ARTICLES` ; cas d'usage = `dateModified` du registre `USE_CASES` ; index du blog = la plus récente des dates d'articles ; `/`, `/guide`, `/a-propos`, `/entreprise-presentation` = `CONTENT_LASTMOD` de `prerender/config.ts`.
- ✅ Retoucher la copie d'une page sans registre = bouger sa ligne dans `CONTENT_LASTMOD`.

## Maillage interne du blog

- ✅ Chaque article porte `related: [slug, slug, slug]`, résolu par `relatedArticles()` (`src/content/blog/index.mjs`) et consommé par `BlogArticlePage.tsx` ET `prerender/routes-registries.ts`. Repli sur la récence si un slug devient inconnu.
- ✅ Un nouvel article déclare ses `related` ET se fait citer en corps de texte par au moins deux articles existants, sinon il naît orphelin.
- ✅ Le blog pointe vers les pages commerciales (`/pour-*`, `/entreprise-presentation`).
- ❌ Ne pas calculer la suite de lecture par date (`ARTICLES.slice(0, 3)` laissait des articles sans lien entrant).

## Langues et indexation

`INDEXABLE_LOCALES` (`src/i18n/seo-urls.mjs`) liste les locales indexables ; `SUPPORTED_LOCALES` (`src/i18n/locale.ts`) celles qui sont servies. `es` est déclarée dans `ALL_LOCALES` et `route-slugs.json` mais non servie : c'est le mécanisme prévu.

- ✅ `vercel.json` pose `noindex` sur les locales non indexables (règles racine `/(xx)` ET sous-arbre `/(xx)/(.*)`), sur `/en/(terms|legal-notice|privacy-policy)` (le français fait foi contractuellement), les invitations et les pages de mot de passe. `npm run i18n:check` exige la règle racine ET la règle sous-arbre.
- ✅ Chaque page prérendue porte `hreflang` réciproques (`fr-FR`, `en-US`, `x-default`) dans le `<head>` et le sitemap, vers un fichier qui existe ; `canonical`, `lang` et `og:locale` suivent la locale.

Ouvrir une langue à l'indexation, dans cet ordre :

1. Traduire le corps des pages, pas seulement les méta.
2. Ajouter la locale à `SUPPORTED_LOCALES`.
3. Ajouter la locale à `INDEXABLE_LOCALES`.
4. Retirer la règle `X-Robots-Tag: noindex` correspondante dans `vercel.json`.
5. Nommer les routes applicatives sous le nouveau préfixe dans `robots.txt`.
6. `npm run build` et vérifier dans `dist/`.

- 🔴 Les points 3 et 4 se commitent ENSEMBLE : l'état à moitié ouvert (contenu prérendu, `noindex` retiré, locale absente d'`INDEXABLE_LOCALES`) laisse indexer sans `hreflang` ni sitemap ; `npm run i18n:check` le refuse.
- ❌ Ne jamais ajouter une locale à `INDEXABLE_LOCALES` avant que son contenu soit réellement traduit (duplicate content).

## `robots.txt` et sitemap : ne jamais faire

- ❌ Déclarer au sitemap une URL qu'on désindexe par ailleurs.
- ❌ Ajouter un `Allow:` par page : `Allow: /` les rend redondants et la liste se périme.
- ❌ Écrire une règle `Disallow:` en préfixe nu quand un slug public commence par les mêmes lettres : `/entreprise` bloquait `/entreprise-presentation`. Utiliser `$` et une règle explicite pour le sous-arbre (`/entreprise$`, `/entreprise/`).
- ❌ `Disallow:` est un préfixe : `/dashboard` ne couvre pas `/en/dashboard`. Nommer les routes applicatives de chaque locale.
- ❌ Bloquer au crawl une page qu'on veut désindexer : Google doit pouvoir lire le `noindex` (`/invite/` et les pages légales sont crawlables mais `noindex` par en-tête).
- ⚠️ La règle « approfondir les articles de moins de 900 mots avant d'en publier » est remplacée par la règle de la section Priorité (ni publier ni approfondir avant les liens entrants).
