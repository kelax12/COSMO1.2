> ⚠️ **ARCHIVE : `docs/SEO.md` tel qu'il était avant sa réécriture en état courant, sans une coupe, non maintenu.**
> Contient les relevés datés (audit prérendu du 2026-08-14, Search Console du 2026-08-19, bascule de l'anglais du 2026-09-08) et les récits d'incident. `docs/SEO.md` porte les règles courantes ; le prérendu, la production et le code font foi contre ce fichier.

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

## Historique des notes et des audits : archivé

Les notes /100 de ce document ont cessé (ADR 0012, [`INDICATEURS.md`](./INDICATEURS.md)). Leur journal daté, les angles morts mesurés et les récits d'incident qui fondent les règles ci-dessous sont déplacés, sans coupe, dans [`archive/SEO-journal-des-notes-2026-01-10-au-2026-11-06.md`](./archive/SEO-journal-des-notes-2026-01-10-au-2026-11-06.md). Une règle de ce document qui cite une date ou un incident s'y retrouve.

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
| 404 | ✅ vraie page + `noindex` (statut HTTP 200, limite SPA assumée). Depuis le 2026-10-09 le `noindex` est aussi dans le HTML SERVEUR : `app.html` sort sans `index` ni canonical vers `/`, visible par Bing et les crawlers IA qui n'exécutent pas le JS |
| Image OG | ✅ une par page depuis le 2026-10-12 : `public/og/<clé>.jpg`, rendues par `scripts/capture-og-images.mjs` (Playwright, après `npm run build`) et **commitées**, le build Vercel n'ayant pas de navigateur. Le prérendu retombe sur `og-card.png` si l'image manque ; l'accueil FR garde `og-card.png`. Garde : `src/og-images.guard.test.ts` (chaque article, chaque langue). ⚠️ Article neuf : relancer le script |
| Canonical de la landing | ✅ depuis le 2026-10-12, `useLandingSeoMeta(track)` : `/entreprise-presentation` gardait son canonical prérendu puis React le réécrivait vers `/` (Lighthouse SEO 92). Témoin : `src/lib/useSeoMeta.test.ts` |

**Le grief central de juillet — « le prérendu ne sort que 161 mots » — est corrigé** : l'accueil
émet ~600 mots de contenu propre, les pages use-case 680–900.

## 2. International : l'anglais est OUVERT à l'indexation (2026-09-08)

> 🔄 **Bascule C-20, le 2026-09-08.** Ce paragraphe décrivait `INDEXABLE_LOCALES = ['fr']` comme
> un choix délibéré : `/en/` était servi, mais son **corps** restait français, et l'indexer aurait
> produit du duplicate content. Cette raison a cessé d'être vraie : le corps anglais a été écrit.

`INDEXABLE_LOCALES = ['fr', 'en']`. La condition de sortie était le **contenu**, pas la config, et
elle a été mesurée avant la bascule, pas déduite : accueil, guide, à-propos et entreprise
(430 à 700 mots), les 4 pages métier (579 à 815 mots) et les 11 articles (657 à 1 985 mots) ont
tous un corps anglais réel. Aucune page ne restait en français.

Vérifié dans `dist/` après `npm run build`, jamais depuis la lecture du code de `prerender/` :

| Contrôle | Résultat |
|---|---|
| Pages prérendues | **50**, dont **26 sous `/en`** |
| URLs au sitemap | **40**, dont **20 sous `/en`** |
| `lastmod` manquant | **0** |
| `hreflang` réciproques (`fr-FR` + `en-US` + `x-default`), `<head>` et sitemap | **50/50 pages**, et chaque alternate pointe vers un fichier qui existe |
| `canonical` / `lang` / `og:locale` conformes à la locale | **50/50** |
| URL au sitemap **et** `noindex` (contradiction) | **0** |
| FAQPage JSON-LD | suit la locale (`faqSchemaFor`), FAQ anglaise sur `/en/`, française sur `/` |

`vercel.json` ne pose donc plus de `noindex` sur `/en`, et le conserve sur `/es`, sur
`/en/(terms|legal-notice|privacy-policy)` (le français fait foi contractuellement), sur les
invitations et sur les pages de mot de passe.

> ⚠️ **Trois défauts trouvés par la bascule. Les deux premiers étaient invisibles tant que `fr`
> était seule indexable ; le troisième était là depuis toujours :**
>
> 1. **`/` et `/guide` étaient absents du sitemap en anglais.** Ils venaient du socle statique
>    `public/sitemap.xml`, pas de `sitemapGroup` : une entrée écrite à la main ne porte qu'une URL,
>    donc ni `/en/…` ni alternates. Les deux pages les plus importantes du site étaient les seules
>    au groupe de langue muet. Le socle est désormais **vide** et tout passe par le générateur.
> 2. **`robots.txt` ne couvrait pas les routes applicatives sous `/en`.** `Disallow:` est un
>    préfixe : `/dashboard` ne matche pas `/en/dashboard`. Le `noindex` global sur `/en/(.*)` les
>    bouchait ; le retirer découvrait les dix. Elles sont maintenant nommées.
> 3. **`robots.txt` interdisait au crawl `/entreprise-presentation`**, la page publique qui porte
>    l'offre payante, prérendue et déclarée au sitemap en **priorité 0.9**, la plus haute après
>    l'accueil. `Disallow: /entreprise` visait la route applicative, mais `Disallow:` matche par
>    **préfixe** et le slug public partage ses onze premiers caractères. C'est la contradiction du
>    § « Ne jamais faire » ci-dessous, en pire : la page n'était pas seulement déclarée puis
>    désindexée, elle était déclarée puis **rendue incrawlable**. Corrigé par `Disallow:
>    /entreprise$` plus `Disallow: /entreprise/`. Préexistant, sans rapport avec l'ouverture de
>    `en` ; c'est l'audit des 40 URLs du sitemap contre les 20 règles qui l'a sorti, et c'était la
>    seule collision. Le slug anglais est `for-companies`, il n'a jamais eu le problème.

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

### Prérendu : où vit quoi (V14.3, COD-04)

Le HTML servi aux moteurs sort de `prerender/` (TypeScript, ancien `prerender.mjs`), lancé par
`npm run build` après `vite build` : `node --disable-warning=ExperimentalWarning prerender/main.ts`.
Il est dans `tsc -b` (`tsconfig.app.json`), dans le lint avec les seuils de complexité de `src/`, et
dans le plafond de taille de fichier (`architecture.guard.test.ts`).

| Fichier | Rôle |
|---|---|
| `main.ts` | l'ordre des étapes, rien d'autre |
| `routes.ts`, `routes-registries.ts` | les routes : pages écrites ici, index du blog, articles, cas d'usage |
| `content/` | les corps HTML indexables écrits en dur (guide, à-propos, entreprise, home, pages courtes) |
| `page.ts` | une page : `<head>` réécrit (méta, OG, `canonical`, `hreflang`), JSON-LD de la route, corps |
| `ld.ts`, `chrome.ts` | JSON-LD et image OG ; fil d'Ariane, pied de page et libellés par locale |
| `copies.ts` | les copies peintes avant React (`#lp-hero`) : capture du hero, rendu React des pages de contenu |
| `verify.ts` | un seul `<h1>` par page, plancher de mots du guide : le build échoue sinon |
| `generate.ts` | écriture de `dist/<route>/index.html` pour chaque route et chaque locale publiée |
| `sitemap.ts`, `feeds.ts` | `sitemap.xml` (avec `hreflang` réciproques), `rss.xml`, sections générées de `llms.txt` |
| `config.ts`, `flags.ts`, `types.ts` | constantes et dates de contenu, miroir des prix, types |
| `instantanes/` | le HTML attendu de chaque sortie : voir `docs/TESTING.md` § Instantanés du prérendu |

- **Exécution.** Node retire les types lui-même (Node 22.18 et plus, `engines` impose >= 22.22.0),
  sans `tsx` ni compilation préalable : aucune dépendance de plus, aucune étape de plus sur Vercel.
  Conséquence : seule la syntaxe effaçable est permise (pas d'`enum`, de `namespace` ni de propriété
  de paramètre), les imports relatifs portent leur extension `.ts`, et l'alias `@/` n'existe
  que pour les types (`import type`, effacés).
- **Changer le HTML sans le vouloir se voit.** `npm run check:prerender` compare chaque sortie à
  `prerender/instantanes/` après le build, dans `ci-noyau.yml`.

### Ajouter une page publique indexable

1. Créer la route dans `src/App.tsx` **et** son slug dans `src/i18n/route-slugs.json`.
2. Ajouter ses méta dans `src/locales/<locale>/seo.json` (titre 50–60 car., description 140–155).
3. Vérifier qu'elle sort dans `dist/` après `npm run build` — **le prérendu est la source de
   vérité de ce que Google voit**, pas le code React.
4. Ne pas la lister à la main dans `public/sitemap.xml` : `prerender/sitemap.ts` s'en charge à partir des
   registres. Le fichier source ne contient que les pages sans registre.
5. Un `<h1>` et un seul. Un `alt` sur chaque image.

> **Cas particulier : `/entreprise-presentation`** (2026-08-15). Cette route rend le **même
> composant que `/`** (`LandingPage`), avec le parcours entreprise au lieu du parcours perso.
> Elle a donc son propre `<h1>`, ses propres méta et son propre bloc `content` dans
> `prerender/` — 492 mots indexables — parce que « Cosmo pour une organisation » et « Cosmo
> pour moi » ne répondent pas à la même requête. Priorité sitemap 0.9, juste sous la home.
> ⚠️ Le corps prérendu reprend les arguments du track : **le retoucher quand la copie de
> `src/pages/landing/entreprise/` change**, sinon le prérendu ment sur ce que la page affiche.

### Reprendre les captures de la landing entreprise

`public/screenshots/entreprise/*.webp` sont de **vraies captures** de l'espace entreprise, prises
sur l'application en mode démo. Elles sont affichées par `landing/entreprise/AppShot` (hero et
section cockpit) et référencées dans le prérendu de `/entreprise-presentation`.

> ⚠️ Une capture périmée ment sur le produit. À reprendre dès que l'UI entreprise change.

Procédure : `scripts/capture-entreprise-shots.mjs` (Playwright), refait le 2026-10-02 pour la
navigation à une route par section.

1. Un serveur de dev en **mode démo forcé** (`dev-landing-shots` dans `.claude/launch.json`, port
   5521, variables Supabase vides), puis `SHOTS_BASE=http://localhost:5521 node scripts/capture-entreprise-shots.mjs`.
2. Le script pose `theme = 'noir'` **avant** la démo, neutralise ce qui ne s'affiche qu'une fois
   (glossaire au premier affichage d'un rôle, carte « Gardez votre organisation », bandeau démo) et
   replie la barre latérale de l'app : on ne montre que l'espace entreprise.
3. Viewport **1280 de large**, cadrage = colonne principale **et** panneau de navigation de droite,
   en 16/10. La largeur compte : au-delà, l'UI devient illisible une fois réduite.
4. WebP 1600 px, ré-encodés par le canvas de Chromium : l'ensemble tient sous 1 Mo.
5. Mettre à jour les `alt` (`enterprise.shot.*Alt` des catalogues `landing`, et les `<img>` du
   prérendu de `/entreprise-presentation` dans `prerender/content/entreprise.ts`) si le contenu des écrans a changé.

⚠️ L'onglet **Statistiques** est masqué de la navigation depuis le 2026-09-30 : ne pas le
recapturer pour la landing. L'étape « Suivi » montre les rapports d'activité (`rapports.webp`).

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
| `/`, `/guide`, `/a-propos`, `/entreprise-presentation` | `CONTENT_LASTMOD` dans `prerender/config.ts` |

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
`BlogArticlePage.tsx` et `prerender/routes-registries.ts`. Repli sur la récence si un slug devient inconnu.

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
5. Nommer les routes applicatives sous le nouveau préfixe dans `robots.txt` : `Disallow:` est un
   **préfixe**, `/dashboard` ne couvre pas `/xx/dashboard`, et c'est le `noindex` global qu'on
   vient de retirer qui les bouchait.
6. Faire tourner `npm run build` et vérifier dans `dist/`, jamais dans le code de `prerender/`.

🔴 **Les points 3 et 4 se commitent ENSEMBLE.** L'état à moitié ouvert (contenu prérendu et
`noindex` retiré, mais locale absente d'`INDEXABLE_LOCALES`) est le plus dangereux des trois :
Google peut indexer `/xx` sans hreflang ni sitemap. `npm run i18n:check` le refuse, et c'est cette
gate qui rattrape l'oubli, pas la relecture.

❌ Ne jamais ajouter une locale à `INDEXABLE_LOCALES` avant que son contenu soit réellement
traduit : c'est le scénario que toute l'architecture i18n a été conçue pour empêcher.

### Ne jamais faire

- ❌ Déclarer au sitemap une URL qu'on désindexe par ailleurs (contradiction signalée par Search Console).
- ❌ Ajouter un `Allow:` par page dans `robots.txt` — `Allow: /` les rend redondants et la liste
  se périme en silence.
- ❌ **Écrire une règle `robots.txt` en préfixe nu quand un slug public commence par les mêmes
  lettres.** `Disallow:` matche par préfixe : `/entreprise` bloquait `/entreprise-presentation`.
  Utiliser `$` (fin d'URL) et une règle explicite pour le sous-arbre. Vaut aussi à l'ouverture
  d'une langue : `/dashboard` ne couvre pas `/en/dashboard`.
- ❌ Bloquer au crawl une page qu'on veut désindexer : Google doit pouvoir **lire** le `noindex`.
  C'est pourquoi `/invite/` et les pages légales sont crawlables mais `noindex` par en-tête.
- ❌ Publier un nouvel article tant que ceux de moins de 900 mots n'ont pas été approfondis.
