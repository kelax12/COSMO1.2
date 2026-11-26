# Audit SEO pour la recherche Google et son IA générative (Aperçu IA, Mode IA)

**Dates** : audit initial 2026-11-16, mis à jour le 2026-11-26 après le chantier SEO mené du 2026-11-23 au 2026-11-26 (plan tenu hors dépôt). **Grille** : skill `seo-google-ia` (doctrine Google Search Central, maj 2026-07-13), inchangée entre les deux passes pour que les notes se comparent. **Périmètre** : la recherche Google ; ChatGPT, Perplexity ou Claude relèvent d'une autre grille.

**Méthode (2026-11-26)** : HTML servi lu dans `prerender/instantanes/` (127 pages, comparées à chaque CI par `npm run check:prerender`) et recoupé en ligne sur `https://thecosmo.app/` (production `336a1d3`) ; contenu compté depuis les registres (`src/content/`) ; Search Console lue dans `docs/seo-signals-series.json` (relevé hebdomadaire, dernier point du 2026-11-23) ; vitesse mobile mesurée une fois sur PageSpeed Insights (accueil, 2026-11-26).

## Note : 80/100 (2026-11-26), contre 72/100 (2026-11-16)

| Critère (skill) | Poids | 2026-11-16 | 2026-11-26 | Ce qui a bougé |
|---|---|---|---|---|
| 1. Indexabilité et extraits | 20 | 18 | **20** | `noindex` dans le HTML des pages légales et de `/login`, hreflang en langue seule avec `x-default`, et surtout plus de redirection de `/` selon la langue du navigateur |
| 2. Contenu original, expérience propre | 25 | 12 | **16** | Auteur nommé (`Person`), 5 outils gratuits utilisables, 8 modèles avec exemple rempli, 9 comparatifs honnêtes ; le fond des articles reste du savoir commun, sans données ni cas réels |
| 3. Structure et médias | 15 | 12 | **12** | Réponse directe sous l'introduction de 22 pages ; toujours une image au plus par article, aucune vidéo publique |
| 4. Technique | 20 | 15 | **16** | Redirection par langue retirée, slugs croates traduits, IndexNow ; LCP mobile de l'accueil à 4,8 s et texte prérendu de l'accueil toujours remplacé par React |
| 5. Pas de pages en masse | 10 | 10 | **9** | 8 modèles au même gabarit, de 350 à 450 mots : pas un abus, mais sous la règle des 600 mots que le plan fixe pour la galerie à grande échelle |
| 6. Mesure et inclusion | 10 | 5 | **7** | Série Search Console hebdomadaire lue, clics CTA mesurés (`data-cta`), vitesse mesurée ; pages réellement indexées toujours inconnues |
| **Total** | **100** | **72** | **80** | |

Le facteur limitant ne change pas : **l'autorité de domaine**. Le site est désormais propre et fourni, mais Google et son IA récupèrent des pages déjà bien classées, et presque aucun site ne pointe vers thecosmo.app (`docs/SEO.md` § Priorité). Les 8 points gagnés rendent le site prêt à se classer ; ils ne le font pas se classer seuls.

## Ce qui a été fait (2026-11-23 au 2026-11-26)

| Domaine | Changement | Où |
|---|---|---|
| Exploration | IndexNow : soumission des pages au `lastmod` récent après chaque mise en ligne (Bing, Yandex, et par Bing : ChatGPT, Copilot, DuckDuckGo) | job `indexnow` de `smoke-prod.yml`, `scripts/seo-signals.mjs indexnow` |
| Langues | Plus de redirection de `/` selon la langue du navigateur ; un bandeau propose la langue à la place | `src/i18n/bootstrap.ts`, `LocaleSuggestionBanner` |
| Langues | Slugs d'articles croates traduits, ancien slug en 301 | `src/i18n/article-slugs.json`, `vercel.json` |
| Saison | 4 pages Nouvel An fr + en (objectifs de l'année, habit tracker à imprimer avec PDF de 12 mois, bilan en 10 questions, tenir ses résolutions) | `src/content/blog/` |
| Intention commerciale | 9 comparatifs « alternative à X » (Todoist, TickTick, Notion, Trello, Google Tasks, ClickUp, Habitica, Microsoft To Do, Any.do) | `src/content/blog/cosmo-vs-*.mjs` |
| Modèles | Galerie `/modeles` (`/en/templates`), 8 modèles (OKR freelance, étudiant, marketing, startup ; routine du matin ; révisions ; semaine en time-blocking ; revue hebdomadaire) | `TemplatesIndexPage`, articles `kind: "modele"` |
| Outils gratuits | Matrice d'Eisenhower, générateur d'OKR, habit tracker personnalisé, planning de semaine, minuteur Pomodoro ; sans compte, `WebApplication` en JSON-LD | `src/pages/tools/`, `EisenhowerToolPage`, `OkrGeneratorPage` |
| E-E-A-T | Articles signés Axel Longatte (`BlogPosting.author` = `Person`), ancre `#fondateur` sur À propos | `prerender/routes-registries.ts`, `BlogArticlePage` |
| Extraits | Question en `<h2 id="en-bref">` et réponse de 40 à 60 mots sous l'introduction (14 articles et 8 modèles) | registres du blog |
| Conversion | `data-cta` sur les boutons publics (aucun n'était mesuré) ; accès à la démo sous le titre de chaque article | `src/lib/traffic.ts` (`kind = 'cta'`) |
| Distribution | Extension « Ajouter à Cosmo » (Manifest V3), prête à publier | `extension/` |
| Poids | Corps anglais des articles chargé à part, pour les seuls visiteurs `en` | `src/content/blog/en.mjs` |

## État actuel (mesuré le 2026-11-26)

| Mesure | 2026-11-16 | 2026-11-26 |
|---|---|---|
| Pages prérendues (instantanés) | 50 | 127 |
| URL du sitemap | 40 | 112 (fr 46, en 46, hr 20) |
| Pages éditoriales du blog | 11 | 31 (14 articles, 9 comparatifs, 8 modèles), ~24 000 mots en fr, toutes traduites en anglais, 11 en croate |
| Outils gratuits | 0 | 5 |
| Images Open Graph par page | partielles | 111 |
| Clics Google hors marque (28 j, relevé du 2026-11-23) | 0 | 0 (8 impressions, dont 7 sur des requêtes K-pop sans rapport ; « okr en pratique » en position 37) |
| Clics Google toutes requêtes (28 j) | non relevé | 12 (314 impressions, position moyenne 9,6, quasi tout sur la marque) |
| Visiteurs des pages publiques (`traffic_hits`, 30 j au 2026-11-23) | non relevé | ~21, dont ~6 venus d'un moteur |
| PageSpeed mobile, accueil (labo) | non relevé | performance 77, LCP 4,8 s, TBT 150 ms, CLS 0 ; aucune donnée terrain (trafic trop faible) |

Les pages publiées du 25 au 26 novembre ne sont pas encore dans le relevé Search Console : leurs effets commencent au relevé du 2026-11-30 au plus tôt.

## Constats

### Réglés depuis le 2026-11-16

- ✅ Pages légales et `/login`, `/signup` : `noindex, follow` dans le HTML (`prerender/instantanes/pages/cgu.html`, `login.html`), cohérent avec l'en-tête `X-Robots-Tag`.
- ✅ Redirection de `/` vers `/en/` selon la langue du navigateur retirée : Googlebot, qui rend en en-US, voyait l'accueil français en anglais (Lighthouse : canonical vers une autre alternative hreflang). Seule une préférence choisie au sélecteur redirige encore.
- ✅ Auteur humain : `Person` dans le JSON-LD et signature visible sur chaque article.
- ✅ Slugs : articles croates traduits ; les URL anglaises gardent le slug français, choix assumé (une seule publication, traduite).
- ✅ Contenu propre au produit, que les concurrents n'ont pas : 5 outils utilisables sans compte, modèles avec exemple rempli, comparatifs qui disent pour qui l'autre outil est meilleur.

### Restants

- ❌ **Autorité** : aucun domaine référent mesurable. C'est le seul blocage du classement ; tout le reste est prêt.
- ❌ **Fond des articles générique** (Eisenhower, OKR, time-blocking, glossaire) : savoir commun reformulé, sans donnée, cas vécu ni retour d'utilisateur. La signature existe, la bio et la photo du fondateur non.
- ⚠️ **Accueil** : le texte prérendu (`#seo-fallback`) est masqué puis remplacé par React ; Google indexe la landing rendue. À vérifier dans l'inspection d'URL de la Search Console.
- ⚠️ **LCP mobile de l'accueil à 4,8 s** (cible 2,5 s) : c'est le plus gros écart technique restant.
- ⚠️ **Médias** : une image au plus par article, aucune sur les pages cas d'usage, la vidéo d'onboarding entreprise toujours absente des pages publiques.
- ⚠️ **Modèles courts** (350 à 450 mots) : suffisants pour une première vague, à étoffer avant d'en publier davantage.
- ⚠️ **Mesure** : pages réellement indexées et domaines référents inconnus depuis le dépôt.

## Estimation du trafic une fois les changements pris en compte

### Délais de prise en compte

- Bing et ses dérivés (ChatGPT, Copilot, DuckDuckGo) : quelques jours, grâce à IndexNow.
- Google : exploration des nouvelles pages en 1 à 4 semaines (sitemap à jour, maillage interne) ; classement stabilisé en 2 à 3 mois. Un lien entrant met 4 à 12 semaines à compter.
- Pages Nouvel An : leur intérêt tient au pic de recherches de fin décembre et janvier ; indexées avant le 10 décembre, elles peuvent capter une partie de ce pic.

### Clics Google hors marque par jour (moyenne sur 28 jours)

Point de départ : ~0 (0 clic, 8 impressions en 28 jours).

| Horizon | A. Sans nouveaux liens entrants | B. Plan backlinks exécuté (~20 domaines en 8 semaines) | Ce qui joue |
|---|---|---|---|
| Fin décembre 2026 (J+30) | 0,2 à 1 | 0,5 à 2 | Indexation des 72 nouvelles URL, premières impressions de longue traîne, pages croates peu concurrentielles |
| Fin janvier 2027 (J+60) | 0,5 à 2 | 1 à 5 | Pic du Nouvel An ; en B, les premiers liens commencent à compter |
| Fin février 2027 (J+90) | 0,5 à 2 | 2 à 6 | Fin du pic ; en B, comparatifs et modèles entrent dans le top 20 sur des requêtes de niche |
| Mai 2027 (J+180) | 1 à 3 | 5 à 12 | En B, le palier 1 du plan (10 clics par jour) devient atteignable ; en A, le site plafonne faute d'autorité |

### À côté de Google

| Source | Effet attendu | Ordre de grandeur |
|---|---|---|
| Outils gratuits (5) | Requêtes à fort volume (« minuteur pomodoro », « matrice eisenhower en ligne », « générateur okr ») mais très disputées : en A, quasi rien ; en B, ce sont les pages les plus susceptibles d'attirer des liens spontanés | 0 à 3 clics par jour à J+180 en B, compris dans le tableau ci-dessus |
| Bing et assistants IA (IndexNow) | Moins de concurrence que Google, mais part de marché faible en France | quelques visites par semaine |
| Annuaires, Product Hunt, listes « meilleures applications » (gestes d'Axel) | Trafic direct, indépendant du classement | 100 à 600 visites sur les deux premiers mois si le plan est exécuté |

### Inscriptions

Avec une conversion visite vers inscription de 2 à 5 % (SaaS gratuit avec démo), le scénario B à J+180 donne de l'ordre de **5 à 20 inscriptions par mois** venues de la recherche ; le scénario A, **1 à 4**. Les boutons désormais mesurés (`data-cta`) diront quelle page convertit, une fois quelques centaines de visites accumulées.

Ce sont des ordres de grandeur, pas une promesse : l'écart entre A et B tient presque entièrement aux liens entrants, que seul le plan d'acquisition (gestes d'Axel) peut produire.

## Priorités (par impact)

1. **Autorité de domaine** : annuaires (Appvizer, Capterra, AlternativeTo…), listes « meilleures applications », réseau du fondateur ; cible 20 domaines référents (`docs/ACQUISITION-BACKLINKS.md`).
2. **Relire et indexer les pages Nouvel An avant le 10 décembre** : relecture, puis demande d'indexation dans la Search Console.
3. **LCP mobile de l'accueil** (4,8 s vers 2,5 s).
4. **Rendre 3 ou 4 articles non génériques** : bio et photo du fondateur sur la page auteur, un cas vécu ou des retours d'utilisateurs, des captures de la méthode appliquée dans Cosmo.
5. **Médias** : vidéo d'onboarding entreprise sur `/entreprise-presentation` (`<video>`, `VideoObject`), une illustration propre au sujet par article, une capture par page cas d'usage.
6. **Publier l'extension** sur le Chrome Web Store (domaine très puissant, lien vers le site).

## Hors dépôt, à vérifier par Axel

- Search Console : rapport Pages (combien des 112 URL du sitemap sont indexées, et pourquoi les autres ne le sont pas) ; inspection d'URL en direct de `/` et `/en/` (HTML rendu, langue de l'accueil après la correction de la redirection).
- Search Console : inclusion dans l'IA générative et rapport de performances associé, filtré en non-marque.
- Domaines référents réels (Search Console § Liens, Ahrefs Webmaster Tools) ; clé `BING_WEBMASTER_API_KEY` pour que `seo-signals` les suive chaque lundi.
- Core Web Vitals terrain, dès que le trafic suffit à en produire.
