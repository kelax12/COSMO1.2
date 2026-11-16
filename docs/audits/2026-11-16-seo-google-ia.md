# Audit SEO pour l'IA générative de Google (Aperçu IA, Mode IA)

**Date** : 2026-11-16. **Grille** : skill `seo-google-ia` (doctrine Google Search Central, maj 2026-07-13), sections « À faire », « Inutile pour Google » et « Utilisation en audit ». **Périmètre** : la recherche Google seulement ; ChatGPT, Perplexity ou Claude relèvent d'une autre grille.

**Méthode** : lecture seule. `npm run build` non lancé : `dist/` local date du 2026-11-06 et ne contient que `vite build` (aucune page prérendue). La source retenue pour le HTML servi est `prerender/instantanes/` (50 pages, comparées à chaque CI par `npm run check:prerender`), recoupée en ligne le 2026-11-16 sur `https://thecosmo.app/`, `/blog/matrice-eisenhower`, `/cgu`, `/robots.txt`, `/llms.txt` (en-têtes et `<title>`, `meta robots`, `<h1>` identiques aux instantanés).

## Note : 72/100 (2026-11-16)

| Critère (skill) | Poids | Note | Motif |
|---|---|---|---|
| 1. Indexabilité et extraits (robots, `nosnippet`, canonical, noindex) | 20 | 18 | Extraits ouverts partout (`max-snippet:-1`), canonical et hreflang propres ; signaux contradictoires sur les pages légales, pages de connexion minces indexables |
| 2. Contenu original, expérience propre | 25 | 12 | Articles soignés mais sur des sujets saturés (Eisenhower, OKR, time-blocking, glossaire) traités de façon encyclopédique ; aucun auteur nommé, aucune donnée ni expérience exclusive |
| 3. Structure et médias | 15 | 12 | Un `<h1>` par page (garde de build), `<h2>` clairs, `alt` + `width`/`height` sur toutes les images ; vidéo absente du HTML, pages cas d'usage sans image |
| 4. Technique (rendu JS, doublons, expérience de page) | 20 | 15 | Prérendu complet et hreflang réciproques ; sur l'accueil, le texte prérendu est masqué puis effacé par React, Google indexe donc la landing rendue, qui dépend d'un montage différé |
| 5. Pas de pages en masse par variante de requête | 10 | 10 | 25 URL par locale, 4 pages cas d'usage distinctes : aucun risque d'abus à grande échelle |
| 6. Mesure et inclusion (Search Console) | 10 | 5 | Hors dépôt, non vérifiable ici : note neutre par défaut (voir § Hors dépôt) |
| **Total** | **100** | **72** | |

Le facteur limitant déclaré par `docs/SEO.md` (§ Priorité : l'autorité de domaine) reste valable pour l'IA de Google : Aperçu IA et Mode IA récupèrent des pages déjà bien classées par les systèmes classiques. Aucune optimisation « pour l'IA » ne compense l'absence de liens entrants.

## Constats

### 1. Indexabilité et extraits

- ✅ Toutes les pages prérendues portent `index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1` (`index.html:31`, hérité par chaque page, ex. `prerender/instantanes/pages/index.html:31`). Aucun `nosnippet`, `data-nosnippet` ni `max-snippet` restrictif dans le dépôt : chaque page indexée est éligible à l'extrait, donc à l'Aperçu IA.
- ✅ `canonical` absolu qui suit la locale (`prerender/instantanes/pages/index.html:33`, `.../en__blog__matrice-eisenhower.html` → `/en/blog/matrice-eisenhower`). hreflang `fr-FR` / `en-US` / `x-default` réciproques (`prerender/instantanes/pages/index.html:222-224`), repris dans le sitemap (40 URL, `prerender/instantanes/fichiers/sitemap.xml`).
- ✅ `robots.txt` (`public/robots.txt:1-55`) : `User-agent: *`, `Allow: /`, routes applicatives bloquées dans les deux locales, `/entreprise$` en ancre de fin pour ne pas bloquer `/entreprise-presentation`, sitemap déclaré. Les pages à désindexer restent explorables pour que le `noindex` soit lu.
- ℹ️ Aucune règle `Google-Extended` : comportement par défaut (autorisé). Pour mémoire, Google documente que `Google-Extended` ne retire pas un site de l'Aperçu IA ni du Mode IA ; il n'y a rien à ajouter pour la recherche.
- ⚠️ Signaux contradictoires sur les pages légales : l'en-tête `X-Robots-Tag: noindex, follow` (`vercel.json:41-43`, vérifié en ligne sur `/cgu`) coexiste avec un `meta robots` « index, follow » dans le HTML (`prerender/instantanes/pages/cgu.html`, idem `mentions-legales`, `politique-confidentialite`, `en__terms`…). Google applique la règle la plus restrictive, donc l'effet voulu est obtenu ; c'est un risque de maintenance, pas une perte.
- ⚠️ `/login`, `/signup`, `/en/login`, `/en/signup` sont prérendues et indexables (`index, follow`) avec 141 à 153 mots, essentiellement du maillage (`prerender/instantanes/pages/login.html`). Absentes du sitemap, donc cohérent avec une indexation non souhaitée, mais rien ne l'empêche. Faible enjeu.

### 2. Contenu : original ou générique

- ✅ Volume sain : 11 articles de 871 à 2 245 mots (fr), 4 pages cas d'usage de 744 à 1 027 mots, accueil 895 mots (comptes sur `#seo-fallback` des instantanés). Traduction anglaise réelle du corps, pas seulement des méta (`en__blog__*` ≈ même volume).
- ✅ Éléments propres au produit, donc non génériques : la démo pré-remplie (12 mois, 100 tâches, 100 habitudes, 8 OKR), le comparatif `cosmo-vs-todoist`, le template OKR téléchargeable, les sections « La mettre en pratique dans Cosmo », les partis pris de `/a-propos` (gratuité du partage, RLS, mobile d'abord).
- ❌ Le cœur des articles est du savoir commun reformulé. Exemple : `src/content/blog/matrice-eisenhower.mjs` déroule les quatre quadrants, le piège Q1/Q3 et une FAQ courte, sans chiffre, cas vécu ni observation qu'un LLM ne produirait pas seul. Même profil pour `glossaire-productivite`, `methode-okr-exemples`, `time-blocking-guide`. C'est exactement le contenu que le skill classe en premier risque (« résumé de ce qui existe déjà »), et ce sont des requêtes où les concurrents ont l'autorité.
- ❌ Aucun auteur humain : `author` est l'organisation Cosmo dans tout `BlogPosting` (`prerender/ld.ts:49`), pas de signature visible, et `/a-propos` parle d'une « équipe indépendante » anonyme (`prerender/content/about.ts:25`). L'expérience et l'expertise ne sont attribuables à personne.
- ✅ Pas de pages en masse : les 4 cas d'usage (`src/content/use-cases.mjs`) ciblent des publics distincts avec une copie propre à chacun ; aucune page par ville, métier ou variante de mot-clé.

### 3. Structure et médias

- ✅ Un seul `<h1>` par page, imposé au build (`prerender/verify.ts`, garde `src/prerender-h1.guard.test.ts`) ; hiérarchie `<h2>` lisible (accueil : `prerender/instantanes/pages/index.html:236-273`). Paragraphes, listes et tableau HTML réel dans les articles.
- ✅ Images : 0 image sans `alt` sur les 50 pages ; `width`/`height`, `srcset`, `loading="lazy"` (ex. capture des tâches dans l'article Eisenhower, `prerender/instantanes/pages/blog__matrice-eisenhower.html`). `alt` descriptifs et honnêtes (« Capture du mode démo, données fictives »).
- ⚠️ Une seule image par article, la même capture produit souvent réutilisée : peu d'illustration du sujet lui-même (schéma de la matrice, exemple d'OKR rempli…).
- ⚠️ Les pages cas d'usage (`pour-*`, `for-*`) n'ont aucune image dans le HTML prérendu.
- ⚠️ Une vidéo existe (`public/videos/onboarding-entreprise-v2.mp4`, poster `.webp`, sous-titres `.fr.vtt`) mais n'est montée que dans l'onboarding de l'app (`src/components/onboarding/enterprise/OrgWelcomeVideo.tsx`) : 0 balise `<video>` dans les pages publiques, aucun `VideoObject`. Média de qualité non exploité pour la recherche.

### 4. Technique

- ✅ Contenu présent sans JS : chaque page publique sort en HTML complet (`prerender/generate.ts`), lu tel quel par les robots qui n'exécutent pas le JS. Les ressources ne sont pas bloquées par `robots.txt` (`/assets/` explorable).
- ✅ Doublons fr/en traités : hreflang réciproques, `lang` et `og:locale` par locale, pages légales anglaises en `noindex` (le français fait foi, `vercel.json`), `es` déclarée mais non servie et en `noindex`.
- ⚠️ Accueil (et `/entreprise-presentation`) : le texte riche du prérendu est masqué à l'affichage (`html[data-prerendered] #lp-hero ~ #root #seo-fallback{display:none}`, `index.html:172`) puis effacé par `createRoot`. Googlebot rend le JS : ce qu'il indexe est la landing React, pas les 895 mots de `#seo-fallback`. Or la suite de la landing ne se monte qu'au premier geste ou quand un emplacement de `200vh` croise la moitié du viewport (`src/pages/landing/BelowFold.tsx:46` et `:68`). Le rendu de Google agrandit le viewport et gère `IntersectionObserver`, donc le montage a toutes les chances d'avoir lieu, mais c'est une hypothèse : à vérifier dans l'outil d'inspection d'URL (HTML rendu). Ce n'est pas du cloaking (même HTML pour tous), mais le texte de repli est invisible pour l'utilisateur et doit rester fidèle à la landing (`docs/SEO.md` § Ajouter une page le rappelle pour l'entreprise).
- ⚠️ Les URL anglaises du blog gardent le slug français (`/en/blog/matrice-eisenhower`, `/en/blog/combien-de-temps-prendre-habitude`, `prerender/instantanes/fichiers/sitemap.xml`). Sans effet de classement notable, mais moins lisible dans un résultat anglais.
- ✅ Expérience de page soignée côté dépôt : peinture du prérendu avant React pour le LCP (`src/lib/prerender-hero.ts`), montage différé du bas de landing pour le TBT mobile (`BelowFold.tsx`), cache immuable `/assets/*` (`vercel.json`). Les Core Web Vitals terrain ne sont pas lisibles ici.
- ℹ️ `SoftwareApplication`, `Organization` et `WebSite` sont en JSON-LD statique dans le gabarit (`index.html:188-280`), donc présents sur toutes les pages prérendues, articles compris. Sans gravité.

## Tactiques AEO / GEO trouvées

| Tactique | Où | Verdict Google (skill) | Recommandation |
|---|---|---|---|
| `llms.txt` (description du site, liste des articles et cas d'usage) | `prerender/feeds.ts:44-50`, `prerender/instantanes/fichiers/llms.txt` | Ignoré par la recherche Google | Garder : coût nul, peut servir ChatGPT, Perplexity, Claude. Ne rien en attendre sur Google |
| Prérendu justifié pour les robots IA sans JS (commentaire « GPTBot, ClaudeBot ») | `prerender/instantanes/pages/*.html:98` | Neutre pour Google, qui rend le JS | Garder : utile aux autres moteurs, et socle SEO classique |
| FAQ courtes en fin d'article + `FAQPage` JSON-LD sur 10 articles et l'accueil | `prerender/routes-registries.ts:95-103`, `prerender/ld.ts:75` | Pas un balisage « pour l'IA » ; les données structurées restent utiles en général, mais Google n'affiche plus l'extrait enrichi FAQ que pour des sites gouvernementaux ou de santé | Garder (balisage conforme au contenu visible, sans risque), ne pas en attendre de résultat enrichi ni de citation IA |
| Désambiguïsation de marque écrite pour les modèles (« Cosmo, The Cosmo App ou thecosmo ? », « À ne pas confondre… ») | `prerender/content/about.ts:21`, `llms.txt` | Pas une tactique IA pour Google : c'est un contenu lisible par un humain, légitime pour une marque au nom générique | Garder |
| Glossaire de 20 définitions courtes | `src/content/blog/glossaire-productivite.mjs` | Proche du « découpage en petits blocs » : inutile pour Google en tant que tel, et contenu générique | Ne pas étendre ; s'il évolue, y mettre des exemples tirés de Cosmo |
| Schema.org spécial IA | absent | Pas requis | Rien à faire |
| Mentions fabriquées sur le Web | absent du dépôt (`docs/ACQUISITION-BACKLINKS.md` vise des liens éditoriaux) | Peu efficace, filtré par l'anti-spam | Rester sur des liens et citations réels |

## Priorités (par impact)

1. **Autorité de domaine** : poursuivre la cible de 20 domaines référents (`docs/ACQUISITION-BACKLINKS.md`). L'IA de Google cite des pages déjà classées ; sans liens entrants, aucune page n'entre dans le lot récupéré.
2. **Rendre 3 ou 4 articles non génériques** (Eisenhower, OKR, time-blocking, suivi des habitudes) : un auteur nommé avec une courte bio et une page auteur, un cas vécu ou des retours d'utilisateurs réels, des captures montrant la méthode appliquée dans Cosmo. Retoucher plutôt que publier, conformément à `docs/SEO.md` § Priorité.
3. **Vérifier ce que Google indexe sur l'accueil** : inspection d'URL en direct sur `/` et `/en/`, contrôle que le HTML rendu contient la suite de la landing (montée par `BelowFold`) et que le texte de `#seo-fallback` reste fidèle à ce que la landing affiche.
4. **Médias utiles au sujet** : publier la vidéo d'onboarding entreprise sur `/entreprise-presentation` (balise `<video>` avec poster et sous-titres, `VideoObject`), ajouter une illustration propre au sujet par article et une capture par page cas d'usage.
5. **Signaux d'indexation cohérents** : poser `noindex` dans le HTML des pages légales (aujourd'hui seul l'en-tête le dit) et trancher le sort de `/login` et `/signup` (noindex ou contenu réel).

## Hors dépôt, à vérifier par Axel

- Search Console : propriété de type domaine ; pages réellement indexées (rapport Pages) parmi les 40 du sitemap ; inspection d'URL en direct de `/` et `/en/` (HTML rendu).
- Search Console : inclusion du site dans les fonctionnalités d'IA générative, et rapport « performances dans l'IA générative » (Recherche et Discover), filtré en non-marque.
- Core Web Vitals terrain (rapport Signaux Web essentiels, PageSpeed Insights).
- Domaines référents réels (Search Console § Liens, Ahrefs Webmaster Tools).
- Fiche d'établissement Google : non pertinente pour une app web sans adresse d'accueil du public, sauf si une présence locale est voulue. Merchant Center : sans objet.
