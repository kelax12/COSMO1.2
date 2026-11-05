> ⚠️ **ARCHIVE : instantané daté du 2026-11-05, non maintenu.**
> Audit produit par le skill `seo-audit` de la bibliothèque d'Axel (barème du skill, pas la note
> maison). Ses constats repris et remesurés vivent dans [`docs/SEO.md`](../SEO.md).
> Sources vivantes : [`CLAUDE.md`](../../CLAUDE.md) · [`faille.md`](../../faille.md) · [`docs/`](../README.md).

# Audit SEO complet de thecosmo.app : 2026-11-05

> **Note : 75 / 100 au 2026-11-05**, bareme du skill `seo-audit` (bibliotheque d'Axel,
> `~/.claude/skills-library/seo/skills/seo-audit/SKILL.md`, v2.4.2). Type d'activite detecte :
> **SaaS** (demo, inscription, `/guide`, page tarifs entreprise, pas de panier ni d'adresse).
>
> Mesure faite contre la **production** (`https://thecosmo.app`, domaine confirme par
> `public/robots.txt` : `Sitemap: https://thecosmo.app/sitemap.xml`), le depot a `fcb00fea`, le
> dernier job Lighthouse de la CI de `main` (run `41719397857`, 2026-11-03) et la serie Search
> Console versionnee `docs/seo-signals-series.json` (point du 2026-11-02). Aucun build, aucun test
> lance. Les limites sont listees en fin de document.

## 1. Synthese

| Categorie (poids du skill) | Note | Contribution |
|---|---|---|
| SEO technique (22 %) | 82 | 18,0 |
| Qualite du contenu (23 %) | 64 | 14,7 |
| SEO on-page (20 %) | 85 | 17,0 |
| Schema / donnees structurees (10 %) | 68 | 6,8 |
| Performance, Core Web Vitals (10 %) | 85 | 8,5 |
| Preparation a la recherche IA (10 %) | 55 | 5,5 |
| Images (5 %) | 92 | 4,6 |
| **Total** | | **75,1, soit 75 / 100** |

**Ce que le site emet est propre, ce qu'il obtient reste nul.** 52 URLs crawlees, 40 au sitemap,
toutes en 200, canonicals et `hreflang` coherents a 100 %, Lighthouse SEO 100 sur les 8 URLs
mesurees en CI. Mais Search Console donne **0 clic non marque** sur 28 jours, et Bing Webmaster
**0 domaine referent**. Deux constats neufs depuis la note de 79 : le bas de la page d'accueil et
de la page entreprise n'existe plus dans le DOM rendu tant qu'un humain ne fait pas de geste, et les
requetes « non marque » de la Search Console sont en realite des requetes sur un autre « Cosmo ».

### Top 5 des problemes

1. **Haut** : `/` et `/entreprise-presentation` rendent 123 et 112 mots tant que personne ne
   touche la page (au lieu de 1 355 apres geste). Googlebot ne fait pas de geste (§ 2.1).
2. **Haut** : autorite nulle, 0 domaine referent (Bing Webmaster, 2026-11-02), `sameAs: []`
   (§ 7.2).
3. **Moyen** : collision de marque. Les requetes « non marque » qui affichent le site sont
   « triples », « triples members », « triple s kpop » : le nom est partage avec l'application de
   fans d'un groupe de K-pop (§ 7.3).
4. **Moyen** : E-E-A-T faible. Aucun auteur nomme, **0 lien sortant** dans les articles, y compris
   celui qui s'appuie sur « ce que dit la science » (§ 3.2).
5. **Moyen** : JSON-LD qui contredit le site : « Acces Premium gratuit via publicite » alors que
   le site affiche « Aucune publicite » ; cle `screenshot` en double ; deux e-mails de contact
   differents (§ 5).

### Top 5 des gains rapides

1. Corriger l'`Offer` et la cle `screenshot` en double de `index.html` (10 minutes).
2. Remplir `sameAs` et aligner `contactPoint.email` sur `contact@thecosmo.app`.
3. Mettre `llms.txt` a jour : page entreprise, version anglaise, langue (§ 7.1).
4. Ajouter la source de l'etude Lally (2009) dans `combien-de-temps-prendre-habitude`, et des
   sources dans les articles OKR.
5. Ajouter `x-default` aux entrees du sitemap, comme le `<head>` le fait deja.

---

## 2. SEO technique : 82 / 100

### Ce qui marche (mesure)

| Controle | Resultat | Preuve |
|---|---|---|
| HTTPS et redirections | `http://` et `www.` vers `https://thecosmo.app/` en **308**, un seul saut | `curl -w %{http_code}` : `308 https://thecosmo.app/` |
| En-tetes de securite | HSTS `max-age=63072000; includeSubDomains; preload`, CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` | `curl -sI https://thecosmo.app/` |
| `robots.txt` | routes applicatives bloquees en `fr` et en `en`, `/entreprise$` sans collision avec `/entreprise-presentation`, sitemap declare | `public/robots.txt` |
| Sitemap | XML valide, **40 `<loc>`**, 40 en 200, aucun en `noindex`, aucun redirige | crawl du 2026-11-05 |
| Canonicals | 52 pages crawlees, canonical absolu et auto-referent partout ; `/en` et `/guide/` pointent vers leur forme canonique | crawl |
| `hreflang` | `fr-FR`, `en-US`, `x-default` sur chaque page indexable, reciproques | `<head>` des 40 URLs |
| `noindex` | pages legales et `/es` par `X-Robots-Tag`, coquille `app.html` par `<meta name="robots" content="noindex">` | `vercel.json`, `curl` sur `/page-inexistante` |
| Prerendu | chaque page publique sert son contenu dans le HTML, sans JS | crawl sans moteur JS |
| TTFB | 58 a 594 ms au crawl, cache Vercel `HIT` | en-tetes `X-Vercel-Cache: HIT` |

### 2.1 🟠 Haut : le DOM rendu de `/` et de `/entreprise-presentation` perd le bas de page sans geste

`src/pages/landing/BelowFold.tsx:71-73` rend un emplacement vide de `200vh` tant que `monte` est
faux ; le contenu ne monte qu'au premier geste (`scroll`, `wheel`, `touchstart`, `pointermove`,
`pointerdown`, `keydown`, lignes 33-34) ou quand l'emplacement atteint la moitie haute du viewport
(ligne 51, `rootMargin: '0px 0px -50% 0px'`). Le prerendu (`#seo-fallback`) porte bien tout le
texte, mais React le **retire** en hydratant.

Mesure au navigateur sur la production, sans aucun geste, 5 s apres chargement :

| Page | Mots visibles | `<h2>` | Apres un `pointerdown` simule |
|---|---|---|---|
| `/` (1280 x 768) | **123** | **0** | 1 355 mots, 6 `<h2>` |
| `/` (412 x 4000, viewport haut type robot) | **123** | **0** | non mesure |
| `/entreprise-presentation` | **112** | **0** | non mesure |
| `/blog/methode-okr-exemples` (temoin, sans `BelowFold`) | 1 673 | 11 | |

Avec un viewport de 4 000 px, rien ne monte : le hero occupe `min-h-[100dvh]`, donc l'emplacement
commence toujours sous la moitie haute, quelle que soit la hauteur. Googlebot ne scrolle pas et ne
clique pas ; il agrandit le viewport. Le DOM qu'il indexe pour l'accueil a donc de fortes chances
d'etre le hero seul, sans fonctionnalites, sans FAQ visible (alors que le `FAQPage` JSON-LD de
l'accueil decrit dix questions), sans liens vers les articles.

`docs/PERFORMANCE.md` dit lui-meme de `183a88f3` : « aucun effet sur Lighthouse, qui ne fait aucun
geste ». C'est exactement la propriete qui pose probleme ici, et Lighthouse SEO 100 ne la voit pas
(il ne mesure pas la quantite de contenu). Introduit le 2026-10-16 (perso) et le 2026-10-22
(entreprise, `263154b6`), donc posterieur ou contemporain de la note de 79.

**A verifier avant de corriger** : Search Console, « Inspection de l'URL » sur `/`, puis « Tester
l'URL en ligne » et « Afficher la page testee », onglet HTML. Si le HTML rendu s'arrete au hero, le
constat passe en **Critique** pour la page la plus importante du site.

**Correctif propose**, sans rendre le TBT gagne : garder le `#seo-fallback` dans le DOM (visuellement
masque mais present, ou remplace par une version statique des sections) jusqu'au montage de
`BelowFold`, ou monter le bas de page sur `requestIdleCallback` avec un delai plafonne plutot que sur
un geste. Le second choix rend aussi le contenu aux robots qui rendent le JS.

### 2.2 🟡 Bas : contenu servi en double dans le HTML des pages de contenu

Depuis `66f76355` (2026-10-24, apres la note de 79), `prerender.mjs` peint la copie React d'une
page dans le calque `#lp-hero` **et** garde `#seo-fallback`. Le HTML brut d'un article porte donc
deux `<h1>` et deux fois le texte (`/blog/matrice-eisenhower` : 1 747 mots dans le `<body>`, 859
dans `<main>`). Le CSS masque le second (`#lp-hero ~ #root #seo-fallback{display:none}`), ce qui
ne change rien pour un robot qui lit le texte sans CSS. Pas de penalite connue pour un doublon
intra-page, mais un extracteur de passages (moteurs IA sans JS) voit chaque paragraphe deux fois.
Sur `/`, les deux `<h1>` different : « Toute votre productivite, reunie dans une seule app. » et
« Cosmo – Gestionnaire de taches, habitudes et OKR ».

### 2.3 🟡 Bas : soft 404

`https://thecosmo.app/page-inexistante` et `/blog/article-inexistant` repondent **200** (coquille
`app.html`, 20 880 octets) avec `<meta name="robots" content="noindex">`. Limite SPA connue et
documentee ; le `noindex` empeche l'indexation, mais Search Console les classera en « soft 404 ».
`/llms-full.txt`, URL que certains agents IA testent, tombe dans le meme cas.

### 2.4 🟡 Bas : `x-default` absent du sitemap

Le `<head>` declare `fr-FR`, `en-US` et `x-default` ; le sitemap n'en declare que deux par URL
(80 `xhtml:link` pour 40 URLs, `prerender.mjs:1125-1136`). Pas faux, mais incoherent avec le HTML.

### 2.5 🟡 Bas : cle IndexNow publiee, jamais utilisee

`public/ea44e90cb409eb919d1e11047c02bf7f.txt` est servi en 200 ; aucune occurrence de la cle ni
d'« IndexNow » ailleurs dans le depot. Bing et Yandex ne recoivent donc aucune notification. Soit
brancher un ping au deploiement (les 40 URLs tiennent dans une requete), soit retirer le fichier.

### 2.6 Info

- `priority` et `changefreq` dans le sitemap : ignores par Google.
- `/login`, `/signup`, `/en/login`, `/en/signup` sont indexables (68 a 80 mots), hors sitemap par
  choix documente. Acceptable ; un `noindex, follow` serait plus net.

---

## 3. Qualite du contenu : 64 / 100

### Ce qui marche

| Page | Mots (contenu propre, `<main>` du HTML servi) |
|---|---|
| 11 articles FR | 774 a 2 149 (`template-okr-gratuit` 2 149, `methode-okr-exemples` 1 674) |
| 11 articles EN | 753 a 2 088 |
| 4 pages `/pour-*` FR | 694 a 916 |
| `/guide` rendu | 2 640 (DOM apres hydratation) |

Structure solide : un `<h1>` rendu, 11 `<h2>` sur l'article OKR dont plusieurs en question, FAQ par
article, blocs « A lire ensuite ». Metadonnees non gabaritees : aucune fin de description partagee
entre pages (une seule paire, `/en` et `/en/`, qui sont la meme page), 3 descriptions sur 45 qui
reprennent plus de 80 % des mots du titre.

### 3.1 🟠 Haut : l'accueil rendu est mince

Voir § 2.1 : 123 mots rendus sans geste, pour un plancher de 500 que le skill fixe a une page
d'accueil.

### 3.2 🟠 Moyen : E-E-A-T

| Facteur (poids du skill) | Note | Constat |
|---|---|---|
| Experience (20 %) | 55 | captures reelles de l'app dans les articles, demo pre-remplie ; aucun cas client, aucun retour d'usage |
| Expertise (25 %) | 50 | aucun auteur nomme : `BlogPosting.author` est l'`Organization` « Cosmo » sur les 22 articles ; « A propos » parle d'« une equipe independante », sans nom |
| Autorite (25 %) | 25 | 0 domaine referent, 0 mention externe mesuree |
| Confiance (30 %) | 70 | HTTPS, mentions legales, politique de confidentialite, contact ; mais deux e-mails differents (§ 5) |
| **E-E-A-T** | **52** | |

**0 lien sortant** dans le `<main>` de `combien-de-temps-prendre-habitude`, `methode-okr-exemples`,
`cosmo-vs-todoist` et `template-okr-gratuit`. Le premier cite nommement l'etude de Lally sans la
lier ; le titre promet « ce que dit la science ». Pour un article de type « reponse scientifique »,
c'est le signal de confiance le moins cher a ajouter.

### 3.3 🟡 Moyen : fraicheur

Dernier article publie ou modifie : `template-okr-gratuit`, `dateModified` 2026-08-19. Rien depuis
11 semaines. C'est une decision documentee (`docs/SEO.md` § 4 : ne rien publier tant que l'autorite
manque), donc ce n'est pas un oubli, mais le signal existe.

### 3.4 🟡 Bas : `/guide` sert 707 mots, en rend 2 640

HTML servi : 224 mots dans `#lp-hero` (premiere section) + 485 dans `#seo-fallback`. DOM rendu :
2 640 mots. Un robot sans JS lit donc un quart du guide. `docs/SEO.md` notait « `/guide/` sert
1 932 mots dans le HTML » le 2026-10-22 ; je mesure 707 aujourd'hui, sans avoir pu attribuer
l'ecart a un commit precis (`66f76355`, 2026-10-24, a refait le prerendu du guide). A remesurer sur
un build.

---

## 4. SEO on-page : 85 / 100

| Controle | Resultat |
|---|---|
| `<title>` uniques | 45 / 45 pages indexables, 30 a 66 caracteres ; deux au-dessus de 60 : `/entreprise-presentation` (66), `/pour-etudiants` (61) |
| `meta description` uniques | 45 / 45 ; 7 au-dessus de 155 caracteres (`cosmo-vs-todoist` 160, `combien-de-temps-prendre-habitude` 158, `/en/for-companies` 157…) |
| `<h1>` rendu | 1 par page |
| Maillage | 14 a 27 liens internes par page ; l'index du blog lie les 11 articles ; chaque article en lie 17 a 21 |
| `lang`, `og:locale`, `og:image` | conformes a la locale, une image OG par page |

### 4.1 🟡 Moyen : slugs francais sous `/en/blog/`

`/en/blog/matrice-eisenhower`, `/en/blog/gestion-du-temps-efficace`, `/en/blog/suivi-des-habitudes`
… Les pages statiques ont des slugs anglais (`/en/for-companies`, `/en/about`), pas les articles.
Pour des requetes anglaises (« eisenhower matrix », « habit tracking »), l'URL ne porte pas le mot
cle. Changer un slug impose une 301 ; a faire tant que les pages anglaises n'ont aucun lien.

### 4.2 🟡 Bas : liens internes de l'accueil rendu

Sans geste, l'accueil rendu ne lie que 13 URLs (guide, blog, 4 `/pour-*`, a-propos, entreprise,
legal, login, signup), aucune vers un article. Consequence directe du § 2.1.

---

## 5. Schema / donnees structurees : 68 / 100

### Detection

| Page | Blocs JSON-LD |
|---|---|
| Toutes | `SoftwareApplication`, `Organization`, `WebSite` |
| `/` et `/en/` | + `FAQPage` |
| Articles | + `BreadcrumbList`, `BlogPosting`, `FAQPage` (9 / 11) |
| `/guide` | + `BreadcrumbList`, `TechArticle` |
| `/blog` | + `BreadcrumbList`, `Blog` |

Tous les blocs parsent, `@context` en `https://schema.org`, URLs absolues, dates ISO 8601.

### Constats

| Severite | Constat | Preuve |
|---|---|---|
| 🟠 Moyen | `Offer.description` : « Version gratuite complete. Acces Premium gratuit via publicite. » Le site affiche ailleurs « Aucune publicite, aucun profil » (`src/locales/fr/common.json:181`) et le premium est coupe (`PREMIUM_ENFORCED = false`). Donnee structuree fausse | `index.html:209` |
| 🟠 Moyen | `SoftwareApplication` a deux cles `screenshot` (tableau puis `ImageObject`) : JSON valide, mais la seconde ecrase la premiere, les trois captures ne sont jamais lues | `index.html:195` et `index.html:223` |
| 🟠 Moyen | `contactPoint.email` = une adresse Gmail personnelle, alors que « A propos » donne `contact@thecosmo.app` | `index.html:257` |
| 🟠 Moyen | `Organization.sameAs: []` : aucune entite reliee (LinkedIn, GitHub, Product Hunt…), alors que la marque est ambigue (§ 7.3) | `index.html:261` |
| 🟡 Bas | `BlogPosting.author` est une `Organization` : pas de `Person`, donc pas de signal d'expertise | JSON-LD des 22 articles |
| 🟡 Bas | `/entreprise-presentation` (l'offre payante) n'a ni `Offer` ni `Product` ; les prix sont masques, donc pas d'urgence | JSON-LD de la page |
| 🟡 Bas | `SoftwareApplication` sans `aggregateRating` ni `review` : pas d'eligibilite aux resultats enrichis « logiciel ». Ne rien inventer : a ajouter seulement avec de vrais avis | |
| ⚪ Info | `FAQPage` : resultats enrichis FAQ retires par Google pour tous les sites le 2026-05-07 (selon le skill). Aucun benefice SERP ; a garder seulement pour les moteurs IA, benefice non confirme. Sur `/`, la FAQ n'est meme pas dans le DOM rendu sans geste (§ 2.1) | |

---

## 6. Performance (Core Web Vitals) : 85 / 100

**Donnees de laboratoire seulement.** L'API PageSpeed Insights a refuse les requetes (HTTP 429,
quota journalier de l'API sans cle) ; aucune donnee terrain CrUX, et `docs/SEO.md` note que le site
n'a pas le trafic pour en avoir.

Lighthouse **mobile** en CI, run `41719397857` (commit `fcb00fea`, 2026-11-03), trois passes par URL :

| URL | LCP | TBT | CLS | Perf |
|---|---|---|---|---|
| `/` | 1,60 a 1,68 s | 69 a 156 ms | 0 | 98 a 99 |
| `/guide/` | 1,52 a 1,67 s | 266 a 301 ms | 0 | 93 a 95 |
| `/blog/` | 1,67 s | 24 a 87 ms | 0 | 99 a 100 |
| `/blog/methode-okr-exemples/` | 1,52 a 1,74 s | 41 a 74 ms | 0 | 99 a 100 |
| `/pour-freelances/` | 1,52 a 1,67 s | 5 a 7 ms | 0 | 100 |
| `/entreprise-presentation/` | 2,42 a 2,44 s | 52 a 126 ms | 0 | 96 a 97 |
| `/a-propos/` | 1,37 a 1,67 s | 1 a 6 ms | 0 | 100 |
| `/en/` | 1,67 s | 93 a 179 ms | 0 | 97 a 99 |

**Changement depuis la note de 79** : `docs/PERFORMANCE.md` mesurait le 2026-10-22 un LCP mobile de
4,5 a 6,0 s sur six URLs sur huit. Il est maintenant **sous 2,5 s partout** (« bon »), la page
entreprise etant la plus proche du seuil.

Restent : INP non mesure (lab seulement), page entreprise a 2,4 s, `/guide/` a ~300 ms de TBT,
497 Ko de JS transferes au chargement de `/` (mesure navigateur). Le gain de TBT de `/` et de la page
entreprise est en partie paye par le § 2.1.

---

## 7. Preparation a la recherche IA : 55 / 100

| Dimension (poids GEO du skill) | Note | Constat |
|---|---|---|
| Citabilite (25 %) | 65 | articles en `<h2>` questions, FAQ, definitions courtes ; peu de chiffres sources |
| Lisibilite structurelle (20 %) | 75 | HTML prerendu lisible sans JS ; contenu en double (§ 2.2), guide tronque (§ 3.4) |
| Multimodal (15 %) | 60 | captures avec `alt` descriptifs, une video dans `public/videos` ; pas de video integree aux articles |
| Autorite et marque (20 %) | 15 | 0 domaine referent, `sameAs` vide, aucune presence Wikipedia, Reddit ou YouTube trouvee dans le depot |
| Accessibilite technique (20 %) | 75 | `robots.txt` n'a qu'un `User-agent: *` : GPTBot, OAI-SearchBot, ClaudeBot, Claude-SearchBot, PerplexityBot et Google-Extended sont tous autorises |
| **GEO** | **~55** | |

### 7.1 🟠 Moyen : `llms.txt` en retard sur le site

`https://thecosmo.app/llms.txt` (200, 6 375 octets) : bonne desambiguisation de marque en tete,
liste des 11 articles et 4 cas d'usage. Mais :
- **aucune mention de Cosmo Entreprise** ni de `/entreprise-presentation`, la seule offre payante ;
- « Langue : francais (fr-FR) » alors que les 20 pages anglaises sont indexables depuis le
  2026-09-08 ; aucune URL `/en/` ;
- la FAQ est annoncee « (10 questions) » sur l'accueil, qui ne les rend plus sans geste.

### 7.2 🟠 Haut : autorite nulle

`docs/seo-signals-series.json`, point du 2026-11-02 (periode 2026-10-03 a 2026-10-30) :
`autorite.source: "bing-webmaster"`, `liens_entrants: 0`, `domaines_referents: 0` ;
`backlinks.declares_faits: 0`. Inchange depuis le premier point (2026-10-26). C'est toujours le
facteur limitant que `docs/SEO.md` § 4 identifiait le 2026-08-19.

### 7.3 🟠 Moyen : collision de marque mesuree

Meme point, requetes « non marque » (sans « cosmo ») : 12 impressions, 0 clic, position 10,6. Sur
les 10 requetes listees, **7 portent sur « triples »** (« triples members », « triple s kpop »,
« is triples a kpop group »…) et 2 sont des fautes de frappe de la marque (« cosmapp »,
« kosmoapp ») : le site apparait sur un autre « Cosmo », l'application de fans de ce groupe. La
seule requete reellement thematique est « tableaux de bord de productivite », position **92**.
La position moyenne de 10,6 est donc un artefact, comme l'etait celle de 15,5 en aout.
Consequence : `sameAs`, page « A propos » nommee et `llms.txt` sont le seul moyen de dire aux
moteurs (classiques et IA) quelle entite est « Cosmo » ici.

---

## 8. Images : 92 / 100

- `alt` : 0 image sans `alt` sur 52 pages ; textes descriptifs (« Le gestionnaire de taches de
  Cosmo : listes d'acces rapide, filtres par… »).
- Formats : WebP pour les captures, variantes 800 px en `srcset` sur le blog (`f261f39a`),
  `loading="lazy"`, `decoding="async"`, `width`/`height` poses.
- Seul ecart : `/logo-128.webp` sans `width`/`height`, dimensionne par CSS (`w-7 h-7`), donc sans
  effet sur le CLS (0 partout en CI).
- `public/screenshots/*.png` (jusqu'a 285 Ko) cohabitent avec leurs `.webp` ; non references par
  les pages crawlees, sans effet SEO.

---

## 9. Comparaison avec la note de 79 / 100 (`docs/SEO.md`, 2026-10-22)

Les deux notes **ne se comparent pas directement** : `docs/SEO.md` note par debits et credits
nommes, ce rapport applique les sept poids du skill. Ce qui a change, mesure :

| Element | 2026-10-22 (`docs/SEO.md`) | 2026-11-05 (cet audit) | Sens |
|---|---|---|---|
| LCP mobile en CI | 4,5 a 6,0 s sur 6 URLs | 1,37 a 2,44 s sur les 8 | ✅ mieux |
| Lighthouse SEO | 100 sur 8 URLs | 100 sur 8 URLs | = |
| URLs au sitemap | 40 | 40, toutes en 200 | = |
| DOM rendu de `/` sans geste | non mesure | 123 mots, 0 `<h2>` | 🔴 neuf |
| HTML servi de `/guide` | « 1 932 mots » | 707 mots | 🟠 ecart a expliquer |
| Contenu en double dans le HTML servi | absent | present sur les pages de contenu (`66f76355`) | 🟡 neuf |
| Non marque Search Console | 0 clic (aout) | 0 clic, 12 impressions, dont 7 hors sujet (K-pop) | = sur le fond, mieux compris |
| Domaines referents | « attendu : 0 a 2 » | **0** mesure (Bing) | = |

Lecture : la technique a progresse (performance), le contenu indexable de l'accueil a probablement
regresse sans qu'aucune garde ne le voie, et le resultat reste nul pour la meme raison qu'en aout.

---

## 10. Plan d'action priorise

### Phase 1 : semaine 1 (critique et haut)

| # | Action | Effort | Fichiers |
|---|---|---|---|
| 1 | Inspecter `/` et `/entreprise-presentation` dans Search Console (test en ligne, HTML rendu) pour confirmer le § 2.1 | 10 min, Axel | |
| 2 | Si confirme : garder le texte du `#seo-fallback` dans le DOM jusqu'au montage, ou monter `BelowFold` sur `requestIdleCallback` plafonne ; remesurer le TBT en CI | 0,5 a 1 j | `src/pages/landing/BelowFold.tsx` |
| 3 | Ajouter une garde : le DOM rendu de `/` sans geste doit contenir N `<h2>` (Playwright, viewport haut) | 0,5 j | `e2e/` |
| 4 | Poursuivre le chantier de liens entrants (`ACQUISITION-BACKLINKS.md`) : c'est le seul levier qui deplace le resultat | continu | |

### Phase 2 : semaines 2 et 3 (haut et moyen)

| # | Action | Effort | Fichiers |
|---|---|---|---|
| 5 | JSON-LD : retirer « via publicite », supprimer la cle `screenshot` en double, `contactPoint.email` = `contact@thecosmo.app`, remplir `sameAs` | 30 min | `index.html:195-261` |
| 6 | `llms.txt` : section Cosmo Entreprise, URLs anglaises, langue `fr` et `en` | 30 min | `public/llms.txt` |
| 7 | Sources externes dans les articles, a commencer par Lally et al. (2009) et la genese des OKR (Grove, Doerr) | 2 h | contenus du blog |
| 8 | Un auteur `Person` (nom, role, page « A propos » nommee) relie aux `BlogPosting` | 2 h | prerendu des articles, page a-propos |
| 9 | Expliquer l'ecart 1 932 contre 707 mots du guide servi ; rendre le guide entier au prerendu si c'est une regression | 1 h | `prerender.mjs`, `src/prerender/content-copy.tsx` |

### Phase 3 : mois 2 (moyen et bas)

| # | Action | Effort |
|---|---|---|
| 10 | Slugs anglais pour les 11 articles `/en/blog/…`, avec 301 | 0,5 j |
| 11 | Ne servir qu'une copie du texte dans le HTML des pages de contenu (§ 2.2) | 0,5 j |
| 12 | `x-default` dans le sitemap ; brancher IndexNow au deploiement ou retirer la cle | 1 h |
| 13 | Raccourcir les 7 descriptions de plus de 155 caracteres et les 2 titres de plus de 60 | 30 min |

### Phase 4 : continu

- Suivre `docs/seo-signals-series.json` en filtrant les requetes « triples » hors du non-marque,
  sinon la position non marque restera un artefact.
- Remesurer le DOM rendu de `/` apres chaque changement de `BelowFold`.

---

## 11. Limites de cet audit

Etapes du skill degradees ou non faites, chacune avec ce qui l'a remplacee :

| Etape du skill | Statut | Remplacement |
|---|---|---|
| `render_page.py --mode auto` (rendu, texte extrait, detection SPA) | ❌ script absent (`${CLAUDE_PLUGIN_ROOT}` non defini, aucun `.py` dans la bibliotheque) | HTML brut par un crawler Node maison (`fetch`, 52 pages, 0,4 s entre requetes) ; DOM rendu par le navigateur integre sur 4 pages seulement (`/`, `/entreprise-presentation`, `/guide`, un article) |
| Crawl 500 pages, 5 requetes concurrentes | ⚠️ degrade | crawl sequentiel des 40 URLs du sitemap + liens internes decouverts : 52 URLs, le site entier publie |
| `sitemap_discovery.py` | ❌ absent | lecture directe de `/sitemap.xml` et `robots.txt` |
| `metadata_template.py` (metadonnees gabaritees) | ❌ absent | heuristique maison : fins de description partagees, recouvrement titre/description |
| `pagespeed_check.py`, API PageSpeed Insights, CrUX | ❌ HTTP 429 sans cle | Lighthouse mobile du dernier run CI (`41719397857`) ; **aucune donnee terrain, INP non mesure** |
| `npx lighthouse` local | ❌ non lance (machine chargee, consigne) | idem |
| `seo-visual` (captures, mobile, au-dessus de la ligne de flottaison) | ❌ non fait (hors perimetre demande) | une capture du hero au navigateur |
| `seo-agentic`, `seo-sxo` (« toujours inclus » selon le skill) | ❌ non faits (hors perimetre demande) | la partie IA est couverte par `seo-geo` seul |
| `seo-cluster` (declenche par la presence d'un blog) | ❌ non fait | |
| `seo-google`, `seo-backlinks`, `seo-matomo`, `seo-dataforseo` | ❌ pas de cles API | serie Search Console et Bing deja versionnee dans `docs/seo-signals-series.json` (point du 2026-11-02) |
| `seo_updates.py` (correlation avec les mises a jour Google) | ❌ absent | aucune variation de trafic a attribuer, etape sans objet |
| `drift_history.py` | ❌ absent | comparaison manuelle avec `docs/SEO.md` (§ 9) |
| Validation schema « bornee » (`--json-ld-output`) | ❌ absent | `JSON.parse` de chaque bloc, lecture de `index.html` ; pas de validateur Rich Results |
| Sorties `{domain}-audit/` (`FULL-AUDIT-REPORT.md`, `ACTION-PLAN.md`, `audit-data.json`, `findings/*.md`), PDF `google_report.py` | ❌ non produites | ce fichier unique, a la demande ; PDF impossible sans le script |
| Verification de ce que Googlebot indexe reellement (§ 2.1) | ⚠️ non prouvable d'ici | test au navigateur integre, viewport haut ; a confirmer par l'inspection d'URL de Search Console |
| Nombre de pages indexees par Google | ❌ hors de portee | inchange depuis `docs/SEO.md` : jamais releve |

Les notes par categorie sont un jugement de l'auditeur : le skill donne les poids, pas de grille
pour noter chaque categorie de 0 a 100.
