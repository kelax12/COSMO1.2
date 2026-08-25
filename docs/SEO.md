# SEO — état mesuré, règles et dette

**Audit refait le 2026-08-14** contre le **prérendu réel** (`dist/` après `npm run build`), le
`sitemap.xml` généré, `vercel.json`, `robots.txt` et le socle i18n. Remplace
[`archive/AUDIT-SEO-2026-07-18.md`](./archive/AUDIT-SEO-2026-07-18.md) (note 54/100 à l'époque,
216 commits de retard).

**Complété le 2026-08-19** par les premières données Search Console réelles (§4), qui renversent
l'ordre des priorités : ce que le site **émet** est propre, ce qu'il **obtient** est nul, et la
cause n'est pas dans le dépôt.

> ⚠️ Restent hors de portée du dépôt : le nombre de pages réellement indexées, le profil de
> liens et les Core Web Vitals terrain. Ces données vivent dans Search Console, Ahrefs et
> PageSpeed Insights.

## Note SEO : 73 → **73 / 100** · inchangée, et c'est le constat

**Aucun travail SEO n'a eu lieu entre le 2026-08-24 et le 2026-08-25**, et la note ne bouge donc
pas. C'est une information, pas un trou dans l'audit.

| Ce qui compose la note | 08-24 | 08-25 |
|---|---|---|
| Technique (prérendu, sitemap, canonical, JSON-LD, `robots.txt`) | ✅ 24/24 pages propres | ✅ inchangé |
| Profondeur éditoriale | 🟠 deux fois sous la cible (§3) | 🟠 inchangée |
| Position moyenne Google, requêtes non-marque | **88** | non remesurée |
| Clics non-marque | **0** | · |
| Backlinks (le seul levier) | ❌ chantier manuel non entamé | ❌ **non entamé** |

**La seule chose qui déplacerait cette note ne se trouve pas dans le dépôt.** Ce que le site
**émet** est propre, c'est mesuré, page par page, et c'est ce que la note de 73 récompense. Ce
qu'il **obtient** est nul, et la cause est l'autorité de domaine. Sept migrations et un système de
permissions n'y changent rien, par construction.

> ⚠️ **À ne pas confondre avec un audit « à jour ».** Une note qui ne bouge pas parce que rien n'a
> été mesuré et une note qui ne bouge pas parce que rien n'a été fait sont deux états différents.
> Ici c'est le second : la partie code a été vérifiée, la partie terrain (position, indexation)
> date du **2026-08-19** et demande une relecture de Search Console, trente minutes, côté Axel.
>
> Une nouveauté du 2026-08-25 mérite d'être notée : le job CI `lighthouse` rend le score **SEO
> bloquant** sur les 4 routes prérendues. C'est la première garde automatique côté SEO ; elle
> protège l'acquis technique, elle ne crée pas d'audience.

Le plan d'action reste [`ACQUISITION-BACKLINKS.md`](./ACQUISITION-BACKLINKS.md), intégralement
manuel.

---

## 1. État technique — les findings de juillet sont fermés

Mesuré sur les 24 pages prérendues :

| Contrôle | Résultat |
|---|---|
| Pages prérendues | **24** (accueil, guide, à-propos, 4 use-cases, index blog, 11 articles, 5 pages transactionnelles/légales) |
| `sitemap.xml` généré au build | **19 URLs** — les 5 absentes (login, signup, 3 pages légales) le sont **volontairement** et c'est commenté dans la source |
| `<title>` uniques | ✅ 24/24, longueurs 40–63 caractères |
| `meta description` uniques | ✅ 24/24 — une seule dépasse la limite d'affichage (`pour-equipes`, 161 car.) |
| `<h1>` | ✅ exactement 1 par page |
| `rel="canonical"` | ✅ par page, absolu |
| Images sans `alt` | ✅ 0 |
| JSON-LD | ✅ `SoftwareApplication`, `Organization`, `WebSite`, `FAQPage` (accueil), `BlogPosting` + `BreadcrumbList` (articles) |
| `robots.txt` | ✅ routes applicatives bloquées, sitemap déclaré, `Allow:` redondants retirés |
| `X-Robots-Tag` | ✅ `noindex` sur invitations, reset de mot de passe, pages légales |
| `rss.xml` | ✅ généré au build |
| Maillage interne depuis l'accueil | ✅ les 4 use-cases, le guide, le blog et un article |
| 404 | ✅ vraie page + `noindex` client (statut HTTP 200 — limite SPA assumée et documentée) |

**Le grief central de juillet — « le prérendu ne sort que 161 mots » — est corrigé** : l'accueil
émet ~600 mots de contenu propre, les pages use-case 680–900.

## 2. International — correct et délibéré, faille refermée

**Ce n'est pas un oubli**, contrairement à ce que la seule lecture du `dist/` laisse croire.
`INDEXABLE_LOCALES = ['fr']` dans `src/i18n/seo-urls.mjs` est un choix documenté dans le fichier
lui-même : `/en/` **est servi** depuis la phase 2, mais le **corps** des pages est encore en
français — seules les méta sont traduites. Indexer ça produirait du contenu français sur des URLs
anglaises, soit exactement le duplicate content que le chantier i18n cherche à éviter.

La décision est appliquée de bout en bout, et c'est cohérent :

- pas de prérendu `/en/`, pas d'URL `/en/` au sitemap, pas de `hreflang="en"` ;
- `vercel.json` pose `X-Robots-Tag: noindex` sur `/(en|es)` **et** `/(en|es)/(.*)`.

**✅ La faille est refermée (2026-08-19).** La règle était `/en/(.*)`, qui exige la barre
oblique : **`https://thecosmo.app/en` sortait sans `noindex`** — précisément l'URL de l'accueil
anglais, la plus susceptible d'être liée. Vérifié en prod le 2026-08-19 (`curl -I` → aucun
`X-Robots-Tag`) avant correction. `vercel.json` porte désormais **deux** règles, `/(en|es)` et
`/(en|es)/(.*)`.

Surtout, `npm run i18n:check` (bloquant en CI) exigeait le motif exact `/xx/(.*)` : **il ne
pouvait structurellement pas voir ce trou**, et ne l'a pas vu pendant cinq jours. Le contrôle
distingue maintenant la **racine** du **sous-arbre** et réclame les deux, en acceptant les
sources groupées (`/(en|es)…`). Régression rejouée : en retirant la règle racine, la CI casse
avec le bon message.

> `es` est déclaré dans `ALL_LOCALES` et dans `route-slugs.json` mais **absent de
> `SUPPORTED_LOCALES`** — la langue n'est donc pas servie. C'est le mécanisme prévu (« ouvrir une
> langue = l'ajouter à `SUPPORTED_LOCALES`, et rien d'autre »), pas une incohérence.

## 3. 🟠 La profondeur éditoriale est deux fois sous la cible que l'audit s'était fixée

Le plan éditorial de juillet fixait **1 500–2 500 mots par article**. Mesuré sur le prérendu, en
retranchant la base de navigation + pied de page (~740 mots, estimée sur les pages sans contenu
propre : login 742, signup 755, mentions légales 735) :

| Article | Contenu propre |
|---|---|
| `methode-okr-exemples` | ~1 540 mots ✅ |
| `suivi-des-habitudes` | ~1 180 |
| `time-blocking-guide` | ~1 150 |
| `tableau-de-bord-productivite` | ~1 140 |
| `gestion-du-temps-efficace` | ~1 100 |
| `combien-de-temps-prendre-habitude` | ~930 |
| `cosmo-vs-todoist` | ~920 |
| `matrice-eisenhower` | ~770 |
| `glossaire-productivite` | ~730 |
| `okr-vs-smart-vs-kpi` | ~700 |
| ~~`template-okr-gratuit`~~ | **2 040 mots** ✅ — porté de 560 à 2 040 le 2026-08-19 (§4 : c'est le seul actif téléchargeable, donc le seul qui puisse attirer un lien) |

**Un seul article sur onze atteint le plancher fixé** ; la médiane est à ~930 mots. Sur des
requêtes où les pages en tête font 2 000+ mots, c'est le facteur limitant — pas la technique.

**Correction, telle qu'elle était formulée le 14/08** : approfondir les 5 plus courts avant d'en
publier de nouveaux.

> 🔴 **Le §4 renverse cette priorité.** Mesure faite : le contenu se classe en position 88, pas
> en position 15 — un article allongé y reste. Seul `template-okr-gratuit` a été traité, et pour
> une autre raison que sa longueur : c'est le seul **actif linkable** du site. Les autres
> attendront que le domaine ait des liens entrants.

## 4. 🔴 Ce que Search Console mesure — le contenu ne se classe sur rien

Données relevées le **2026-08-19**, période 2026-05-18 → 2026-08-18 :

| Périmètre | Clics | Impressions | CTR | Position moyenne |
|---|---|---|---|---|
| Toutes requêtes | 17 | 328 | 5,2 % | 15,5 |
| **Requêtes ne contenant pas « cosmo »** | **0** | **13** | **0 %** | **88,1** |

**La position moyenne de 15,5 est un artefact.** 96 % des impressions et 100 % des clics
viennent du mot « cosmo », qui est générique (Cosmopolitan, cosmos) et ne nous appartient pas.
Sur le contenu éditorial, la position réelle est **88 — la page 9**. Le CTR de 5,2 %, cinq fois
au-dessus de la normale à la position 15, est le symptôme de ce mélange, pas une bonne nouvelle :
❌ **ne pas « optimiser les titles pour le CTR »**, le CTR non-marque est nul faute d'impressions.

La courbe des impressions non-marque est plate, avec deux pics isolés à mi-juillet et mi-août —
les deux dates de publication. C'est le cycle complet d'un contenu indexé, testé, classé vers la
position 88, jamais cliqué, puis plus montré.

**Le facteur limitant n'est donc ni la technique ni la longueur des articles, mais l'autorité de
domaine.** Un domaine sans lien entrant ne se classe sur rien. Conséquence directe sur les
priorités, et elle est contre-intuitive :

❌ **Ne pas approfondir les articles courts pour l'instant.** Un article de 2 000 mots en
position 88 reste en position 88. La règle du §3 (« ne rien publier tant que les courts ne sont
pas montés ») devient : **ne rien publier ni approfondir tant que le seuil de ~20 domaines
référents n'est pas approché.**

Le chantier, entièrement manuel, est décrit dans
[`ACQUISITION-BACKLINKS.md`](./ACQUISITION-BACKLINKS.md) : kit de soumission prêt à coller,
ordre des annuaires, suivi. Le premier signal à guetter n'est pas un clic, c'est **une page qui
passe sous la position 30 sur une requête non-marque**.

### Ce qui reste à mesurer hors du dépôt

| Question | Outil | Statut |
|---|---|---|
| Combien de pages réellement indexées ? | Search Console → Indexation des pages | 🔴 jamais relevé — 13 impressions pour 20 URLs laisse l'hypothèse ouverte |
| La propriété GSC est-elle de type *domaine* ? | Search Console | à vérifier (une propriété *préfixe d'URL* n'en montre qu'une fraction) |
| Combien de domaines référents ? | Ahrefs Webmaster Tools (gratuit) | 🔴 à connecter — attendu : 0 à 2 |
| Core Web Vitals terrain | PageSpeed Insights / CrUX | jamais mesuré, non prioritaire |

---

## Règles permanentes

### Ajouter une page publique indexable

1. Créer la route dans `src/App.tsx` **et** son slug dans `src/i18n/route-slugs.json`.
2. Ajouter ses méta dans `src/locales/<locale>/seo.json` (titre 50–60 car., description 140–155).
3. Vérifier qu'elle sort dans `dist/` après `npm run build` — **le prérendu est la source de
   vérité de ce que Google voit**, pas le code React.
4. Ne pas la lister à la main dans `public/sitemap.xml` : `prerender.mjs` s'en charge à partir des
   registres. Le fichier source ne contient que les pages sans registre.
5. Un `<h1>` et un seul. Un `alt` sur chaque image.

> **Cas particulier : `/entreprise-presentation`** (2026-08-15). Cette route rend le **même
> composant que `/`** (`LandingPage`), avec le parcours entreprise au lieu du parcours perso.
> Elle a donc son propre `<h1>`, ses propres méta et son propre bloc `content` dans
> `prerender.mjs` — 492 mots indexables — parce que « Cosmo pour une organisation » et « Cosmo
> pour moi » ne répondent pas à la même requête. Priorité sitemap 0.9, juste sous la home.
> ⚠️ Le corps prérendu reprend les arguments du track : **le retoucher quand la copie de
> `src/pages/landing/entreprise/` change**, sinon le prérendu ment sur ce que la page affiche.

### Reprendre les captures de la landing entreprise

`public/screenshots/entreprise/*.webp` sont de **vraies captures** de l'espace entreprise, prises
sur l'application en mode démo. Elles sont affichées par `landing/entreprise/AppShot` (hero et
section cockpit) et référencées dans le prérendu de `/entreprise-presentation`.

> ⚠️ Une capture périmée ment sur le produit. À reprendre dès que l'UI entreprise change.

Procédure (Playwright, dev server sur le port de `dev-verify`) :

1. `localStorage.theme = 'noir'` **avant** le login démo — la landing est graphite, une capture
   en thème clair y fait une tache blanche.
2. `loginDemo()` puis `/entreprise`, et fermer le bandeau démo, l'avis de tarification et
   replier la barre latérale : on ne montre que le produit.
3. Viewport **1280 de large** et cadrage depuis la barre d'onglets, en 16/10. La largeur compte :
   au-delà, l'UI devient trop petite une fois réduite à la taille d'affichage et le texte n'est
   plus lisible.
4. Encoder en WebP 1500 px (`ffmpeg -c:v libwebp -quality 80`) — l'ensemble tient sous 250 kB.
5. Mettre à jour les `alt` (`enterprise.cockpit.a1…a6`) si le contenu des écrans a changé.

### `lastmod` et `dateModified` — jamais la date du build

Le sitemap déclarait `lastmod = aujourd'hui` sur **toutes** les URLs à chaque déploiement, et le
JSON-LD global faisait de même sur `dateModified`. Un sitemap qui annonce « tout a changé
aujourd'hui » à chaque `git push` apprend à Google à ignorer le champ, et un `dateModified` qui
avance sans que la copie bouge est un signal de fraîcheur artificielle. Corrigé le 2026-08-19.

Chaque page tire désormais sa date de son contenu :

| Page | Source de la date |
|---|---|
| Articles de blog | `dateModified` du registre `ARTICLES` (déjà le cas) |
| Pages use-case | `dateModified` du registre `USE_CASES` (champ ajouté) |
| Index du blog | la plus récente des `dateModified` des articles, calculée au build |
| `/`, `/guide`, `/a-propos`, `/entreprise-presentation` | `CONTENT_LASTMOD` dans `prerender.mjs` |

❌ **Ne jamais réintroduire `TODAY` dans le sitemap ni dans un `dateModified`.** `TODAY` ne sert
plus qu'au `lastBuildDate` du flux RSS, où « date du build » est la bonne réponse.
✅ Retoucher la copie d'une page sans registre = bouger sa ligne dans `CONTENT_LASTMOD`, au même
titre qu'on met à jour son titre.

### Maillage interne du blog — par sujet, jamais par date

La suite de lecture (« À lire ensuite ») était `ARTICLES.slice(0, 3)`, soit **les 3 articles les
plus récents, identiques depuis les 11 pages**. Effet mesuré le 2026-08-19 : 4 articles ne
recevaient aucun lien entrant interne, dont `cosmo-vs-todoist`, la page à intention commerciale.

Chaque article porte maintenant un champ `related: [slug, slug, slug]`, résolu par
`relatedArticles()` (`src/content/blog/index.mjs`) et consommé **aux deux endroits** :
`BlogArticlePage.tsx` et `prerender.mjs`. Repli sur la récence si un slug devient inconnu.

- ✅ Un nouvel article déclare ses `related` **et** se fait citer en corps de texte par au moins
  deux articles existants. Un article qu'on publie sans toucher aux autres naît orphelin.
- ✅ Le blog pointe vers les pages commerciales (`/pour-*`, `/entreprise-presentation`) : elles
  ne recevaient aucun lien depuis les articles avant le 2026-08-19.
- ❌ Ne pas recalculer la suite de lecture par date : c'est la version qu'on vient de retirer.

### Ouvrir une langue à l'indexation

Dans cet ordre, sinon on publie du duplicate content :

1. Traduire **le corps** des pages, pas seulement les méta.
2. Ajouter la locale à `SUPPORTED_LOCALES` (`src/i18n/locale.ts`) — elle devient servie.
3. Ajouter la locale à `INDEXABLE_LOCALES` (`src/i18n/seo-urls.mjs`) — elle devient prérendue,
   déclarée au sitemap et annoncée en `hreflang`.
4. Retirer la règle `X-Robots-Tag: noindex` correspondante dans `vercel.json`.

❌ Ne jamais ajouter une locale à `INDEXABLE_LOCALES` avant que son contenu soit réellement
traduit : c'est le scénario que toute l'architecture i18n a été conçue pour empêcher.

### Ne jamais faire

- ❌ Déclarer au sitemap une URL qu'on désindexe par ailleurs (contradiction signalée par Search Console).
- ❌ Ajouter un `Allow:` par page dans `robots.txt` — `Allow: /` les rend redondants et la liste
  se périme en silence.
- ❌ Bloquer au crawl une page qu'on veut désindexer : Google doit pouvoir **lire** le `noindex`.
  C'est pourquoi `/invite/` et les pages légales sont crawlables mais `noindex` par en-tête.
- ❌ Publier un nouvel article tant que ceux de moins de 900 mots n'ont pas été approfondis.
