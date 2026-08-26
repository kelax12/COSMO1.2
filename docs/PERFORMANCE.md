# Performance bundle — `vite.config.ts manualChunks`

## Note de performance : 68 → 64 → **88 / 100** (2026-08-24 → 2026-08-25 soir)

| Ce qui compose la note | 08-24 | 08-25 (16 h) | **08-25 (fin)** |
|---|---|---|---|
| Chunk `index` (critical path) | 134 kB gzip | 139,0 kB gzip | **87,2 kB gzip** |
| Marge sur le budget de 150 kB | 16 kB | 11,0 kB | **62,8 kB** |
| **Chemin critique JS** (entrée + preloads) | non mesuré | **580,5 kB gzip** | **420,1 kB gzip** |
| `vendor-charts` préchargé pour TOUS les visiteurs | oui, invisible | oui, invisible | **non** |
| **Images servies sur `/`** | **1 046 kB** | 1 046 kB | **2,7 kB** |
| **Polices servies** | 133 kB | 133 kB | **48 kB** |
| **Poids total de la page d'accueil** | ~1 610 kB | ~1 610 kB | **749 kB** |
| Garde automatique sur le budget | ❌ aucune | ❌ aucune | ✅ `npm run check:bundle`, bloquante en CI |
| Levier i18n (~104 ko de JSON hors chemin critique) | non appliqué | non appliqué | ✅ **appliqué** |
| Lighthouse CI | câblé, seuils provisoires | idem | idem |

**+24 en fin de journée, après être descendu à 64.** La page d'accueil passe de **~1,6 Mo à
749 ko** : le JavaScript perd 160 ko gzip, et les images passent de 1 046 ko à 2,7 ko.

Le plus instructif est la proportion : après une journée entière passée sur le JavaScript, **le
poste le plus lourd restait les images**, et personne ne l'avait jamais pesé.

### 2026-08-26 · ce qui a été mesuré depuis, et pourquoi la note ne bouge pas

La note ci-dessus mesure **le poids envoyé au navigateur**. La journée du 2026-08-26 a mesuré un
autre axe, jamais chiffré jusque-là : **ce que l'application demande au serveur une fois
chargée**. Rien n'a changé dans le bundle, donc la note reste à 88, mais trois chiffres sont
désormais connus et ils vivent dans les sections
[Ce que coûte une ouverture d'application](#ce-que-coûte-une-ouverture-dapplication) et
[Limites de requêtes](#limites-de-requêtes) :

| Ce qui a été mesuré | Résultat | Statut |
|---|---|---|
| Requêtes REST à l'ouverture du tableau de bord | **32**, toutes distinctes | ⚪️ mesuré, non optimisé |
| Part du trafic Supabase du jour venant d'onglets non rechargés | **91,5 %** | 🔴 aucun mécanisme de mise à jour |
| Lecture d'agenda hiérarchique (`events`) | **17,19 ms → 0,61 ms** | ✅ mig. `128`, **appliquée en prod le 2026-08-27** |
| Statistiques, 32 plages (`get_work_time_stats`) | **854 ms → 12,0 ms**, 21 762 → 23 blocs lus | ✅ mig. `127`, **appliquée en prod le 2026-08-27** |

⚠️ **Une note de performance front ne dit rien du coût serveur.** Les deux axes ont été confondus
jusqu'ici : le bundle a été divisé par deux le 2026-08-25 alors que l'ouverture coûtait déjà
32 requêtes, et personne ne le savait.

### Ce qui a produit le gain, dans l'ordre

1. **Les catalogues i18n suivent leur page** (−42,9 kB gzip sur l'entrée, 139,0 → 96,1).
   Le catalogue `fr` était importé statiquement dans son intégralité : 178 ko de JSON brut dans le
   chunk d'entrée, dont `org` 50 ko, `landing` 34 ko et `guide` 14 ko, des pages que la plupart
   des sessions n'ouvrent jamais. Seuls `common` et `errors` restent eager ; les 17 autres sont
   chargés par le gate de route.
2. **`clsx` sortait `vendor-charts` du lazy** (−8,9 kB sur l'entrée, et surtout **−117,5 kB de
   préchargement pour tout visiteur**). Détail ci-dessous : c'est le finding le plus rentable du
   fichier, et il était invisible.

### 🔴 Le finding qui ne se voyait pas : recharts était sur le chemin critique

Ce document affirmait depuis des semaines que `vendor-charts` était **lazy**. Il ne l'était pas.

`dist/index.html` portait `<link rel="modulepreload" href="…/vendor-charts-….js">`, donc
**117,5 kB gzip de recharts + d3 étaient téléchargés par chaque visiteur**, sur la landing, sur
`/login`, partout —, sans jamais être exécutés hors des trois écrans qui font des graphiques.

**La cause tient en une ligne de `manualChunks`.** `cn()` (`src/lib/utils.ts`) appelle `clsx`,
donc `clsx` est dans le graphe de l'entrée. Mais recharts importe `clsx` lui aussi, et un module
partagé entre l'entrée et un **chunk manuel** est absorbé par le chunk manuel. `clsx` atterrissait
donc dans `vendor-charts`, ce qui en faisait un import **statique** de l'entrée, ce qui déclenchait
le `modulepreload`. Une fonction utilitaire de 500 octets traînait 117 kB derrière elle.

**Correctif** : assigner explicitement `clsx`, `tailwind-merge` et `class-variance-authority` à
`vendor-utils`. Trois lignes.

> ⚠️ **La leçon vaut plus que le correctif.** Cette phrase, « `vendor-charts` est lazy », était
> écrite ici, relue plusieurs fois, et fausse. Personne ne l'a vue parce que **le tableau des
> chunks mesure les tailles, pas le graphe de chargement**. Un chunk peut être « lazy » au sens de
> Rollup et préchargé au sens du navigateur. Vérifier `dist/index.html`, pas seulement `dist/assets`.

### Ce qui plafonne encore à 82

- **Les seuils Lighthouse restent provisoires**, jamais posés au réel : la moitié de la mesure
  côté navigateur (LCP, TBT, CLS) n'est donc toujours pas gardée.
- **`vendor-sentry` (49,2 kB gzip) reste sur le chemin critique.** Le différer est techniquement
  simple, mais ce n'est pas un arbitrage de performance : ça revient à ne plus capturer les
  erreurs du démarrage, celles qui blanchissent l'écran. **Non fait volontairement**, à trancher.
- **Rien n'est mesuré côté terrain.** Tous les chiffres ci-dessus sont des octets, pas des
  millisecondes chez un utilisateur.

---

## Vendor chunks isolés (commenter toute modif)

**Tailles réelles, `npm run build` du 2026-08-25** (brut / gzip). Les colonnes précédentes
gardent les mesures antérieures pour rendre la dérive lisible :

| Chunk | Contenu | 08-24 (gzip) | 08-25 midi | **08-25 soir** | Quand chargé |
|---|---|---|---|---|---|
| `index` (app) | code applicatif partagé | 470 kB (134 kB) | 487 kB (139 kB) | **327 kB (87 kB)** ✅ | Toujours |
| `vendor-react` | react + react-dom + scheduler | 227 kB (72 kB) | 227 kB (72 kB) | 227 kB (72 kB) | Toujours |
| `vendor-router` | react-router | 38 kB (14 kB) | 38 kB (13 kB) | 38 kB (14 kB) | Toujours (split pour parallel HTTP/2) |
| `vendor-radix` | @radix-ui/* | 145 kB (45 kB) | 145 kB (45 kB) | 145 kB (45 kB) | Toujours |
| `vendor-supabase` | @supabase/supabase-js | 215 kB (56 kB) | 215 kB (56 kB) | 215 kB (56 kB) | Toujours (extrait pour cache CDN) |
| `vendor-sentry` | @sentry/react | 146 kB (49 kB) | 146 kB (49 kB) | 146 kB (49 kB) | Toujours (extrait pour cache CDN) |
| `vendor-animation` | framer-motion | 148 kB (49 kB) | 148 kB (49 kB) | 148 kB (49 kB) | Toujours |
| `vendor-utils` | date-fns + lucide-react **+ clsx / tailwind-merge / cva** | 70 kB (21 kB) | 71 kB (21 kB) | **100 kB (30 kB)** | Toujours |
| `vendor-query` | @tanstack/* | 60 kB (18 kB) | 60 kB (17 kB) | 60 kB (18 kB) | Toujours |
| `vendor-charts` | **recharts + d3-* + victory-vendor** | 414 kB (118 kB) | 414 kB (118 kB) | 414 kB (118 kB) | **Lazy · et VRAIMENT lazy depuis le 2026-08-25 soir** (StatisticsPage, DashboardChart, GuidePage) |
| **catalogues i18n** | un chunk par namespace et par langue | dans `index` | dans `index` | **`org` 14 kB · `landing` 10 kB · `guide` 4 kB · `tasks` 3 kB · les 13 autres < 2 kB** | **Lazy** (avec la page qui les utilise) |
| `vendor-calendar` | @fullcalendar/* **+ `locales-all`** | 290 kB (85 kB) | 290 kB (85 kB) | 290 kB (85 kB) | **Lazy** (`/agenda` uniquement) |
| `vendor-gsap` | gsap + plugins (+ `InertiaPlugin`) | 139 kB (55 kB) | 139 kB (55 kB) | 139 kB (55 kB) | **Lazy** (LandingPage uniquement) |
| `vendor-ogl` | ogl · micro-runtime WebGL | 44 kB (13 kB) | 44 kB (13 kB) | 44 kB (12 kB) | **Lazy** (fond `LightRays` du hero entreprise) |
| **`OrganizationPage`** | **tout le mode entreprise** | 265 kB (61 kB) | 281 kB (64 kB) | 281 kB (64 kB) 🟠 | **Lazy** (`/entreprise`) |
| `TasksPage` | page Tâches | 130 kB (30 kB) | 129 kB (29 kB) | 129 kB (30 kB) | **Lazy** |
| `TaskModal` | modal de tâche | 104 kB (24 kB) | 102 kB (22 kB) | 102 kB (23 kB) | **Lazy** |
| `LandingPage` | shell + aiguillage + parcours perso | 81 kB (21 kB) | 82 kB (20 kB) | 82 kB (21 kB) | **Lazy** (`/`) |
| `EnterpriseTrack` | les 10 sections du parcours entreprise | 44 kB (11 kB) | 48 kB (12 kB) | 49 kB (12 kB) | **Lazy** (à la bascule / `/entreprise-presentation`) |

**Chemin critique réel**, l'entrée PLUS tout ce que `dist/index.html` précharge, c'est-à-dire ce
que télécharge un visiteur qui arrive et repart :

| | 08-25 midi | **08-25 soir** |
|---|---|---|
| Chunks préchargés | 10 | **9** |
| Total gzip | **580,5 kB** | **420,1 kB** (−27,6 %) |

C'est CE chiffre qu'il faut regarder, pas la seule taille de `index` : c'est lui qui a caché
117 kB de recharts pendant des semaines.

> 🟠 **Le warning Vite « chunks larger than 400 kB » reste actif**, mais il ne concerne plus le
> chemin critique : le seul chunk au-dessus de 400 ko bruts est `vendor-charts` (414 ko), désormais
> réellement lazy. Le chunk `index` est retombé à **327 ko bruts / 87 ko gzip**.
>
> Trajectoire du chunk d'entrée : **124 kB (08-14) → 128 (08-15) → 134 (08-24) → 139 (08-25 midi)
> → 87 (08-25 soir)**. Les quatre premières valeurs montaient parce que rien ne les mesurait ; la
> cinquième descend parce qu'on a enfin regardé *ce qui* était dedans plutôt que *combien* il
> pesait.
>
> Recharts n'est **plus** importé par la landing (`AppWindowShowcase` l'exclut volontairement du
> hero) : `StatsShowcase` ne vit plus que dans `GuidePage`, en `React.lazy`.

## Images et polices, le poste qu'on n'avait jamais pesé

**Tout ce qui précède parle de JavaScript. Ce n'était pas le plus lourd.**

Le 2026-08-25 au soir, le chemin critique JS pesait 420 ko gzip, et la page
d'accueil servait **1 046 ko d'images et 133 ko de polices** aux mêmes
visiteurs. Trois gaspillages, tous invisibles à la lecture du code :

| Ce qui était servi | Poids | Pourquoi c'était du gaspillage |
|---|---|---|
| `logo.png` | **255 ko** | 584 px de côté pour un affichage à 28-40 px, et chargé deux fois plutôt qu'une (`<img>` de l'en-tête ET `rel="icon"`) |
| 3 captures de la landing, en PNG | **790 ko** | Elles vivent dans `#seo-fallback`, qui est en `display:none`. **Aucun visiteur ne les a jamais vues.** Le scanner de préchargement les téléchargeait quand même, parce qu'il lit le balisage avant le CSS |
| `inter-var-latin-ext.woff2` | **85 ko** | Téléchargé à cause d'UN caractère, le « œ » de « coup d'œil » |

### Le « œ » à 85 ko

Les deux `@font-face` d'Inter se **chevauchent** sur `U+0152-0153` (Œ œ) : la
plage latin les liste explicitement, la plage latin-ext les contient dans son
intervalle `U+0100-02BA`. Quand un caractère est couvert deux fois dans la même
famille, **c'est la dernière déclaration qui gagne**. Latin-ext était déclaré
en second : un seul « œ » suffisait à faire venir 85 ko de glyphes
d'Europe centrale sur chaque page d'un site français.

**Correctif : intervertir les deux blocs.** C'est exactement l'ordre qu'utilise
la feuille de style de Google Fonts, et pour cette raison précise. Vérifié dans
le navigateur avant de conclure : le subset latin **contient** la ligature œ
(largeur mesurée 16 px contre 8,8 px pour une police de secours), donc le rendu
est identique au pixel près.

### Résultat mesuré sur `/`

| | avant | après |
|---|---|---|
| Images | 1 046 ko | **2,7 ko** |
| Polices | 133 ko | **48 ko** |
| Total de la page | ~1 610 ko | **749 ko** (−53 %) |

Aucune image n'a été redimensionnée en dessous de sa taille d'affichage, aucun
cadrage n'a changé, aucune balise n'a bougé de place. Les captures restent en
2560 × 1600 pour un affichage en 1280 × 800, c'est-à-dire exactement ce qu'un
écran retina consomme.

### Règles qui en sortent

- ❌ **Ne jamais servir une image sans regarder sa taille d'affichage.** Un
  facteur 2 est du retina ; un facteur 15, comme le logo, est un oubli.
- ❌ **Ne jamais mettre une `<img>` sans `loading="lazy"` dans un bloc masqué.**
  `display:none` n'empêche PAS le téléchargement. C'est contre-intuitif et ça a
  coûté 790 ko par visite pendant des mois.
- ⚠️ **Deux `unicode-range` qui se chevauchent se départagent par l'ordre de
  déclaration.** Le subset le plus large se déclare en PREMIER.
- ✅ Les captures du parcours entreprise étaient déjà en WebP et déjà `lazy`
  (`AppShot.tsx`). Le motif existait dans le dépôt ; il n'avait simplement
  jamais été appliqué à la landing perso.
- ⚪️ **`og-card.png` (504 ko) est laissé tel quel, et c'est une décision.** Elle
  n'est chargée par aucun visiteur, seulement par les robots des réseaux
  sociaux quand un lien est partagé. La recompresser ferait gagner de la bande
  passante de crawl et risquerait de dégrader l'aperçu de partage, qui est la
  première impression du produit. Mauvais échange.

Réencodage reproductible : `npm run images:check` (mesure) puis
`node scripts/optimize-images.mjs`.

## Règles non négociables

- ❌ **Ne jamais importer Recharts ou un composant qui l'utilise (DashboardChart/StatsShowcase) sans `React.lazy`** — sinon il retombe dans le chunk du caller et pollue le critical path. Faille P-2.
- ⚠️ **GSAP : réintroduit en 2026-07, landing page uniquement.** L'ancienne règle « ne jamais réintroduire GSAP » (finding P-1, 2026-05) **ne s'applique plus** : la lib est de retour derrière le point d'entrée unique `src/lib/gsap.ts`, isolée dans le chunk `vendor-gsap` que seule la `LandingPage` (lazy) charge. Contrainte maintenue : **aucun import GSAP hors landing**, et jamais `import { gsap } from 'gsap'` en direct.
- ❌ **Toute nouvelle dep > 50 kB minified doit être ajoutée à `manualChunks`** avec une règle explicite et commentée.
- ✅ `lucide-react` : imports nominaux uniquement (`import { Icon } from 'lucide-react'`). Jamais `import * as`.
- ✅ `date-fns/locale/fr` : import nominal. Jamais `import * as locales`.
- ✅ Tout composant globalement monté dans App.tsx (CommandPalette, etc.) qui n'apparaît qu'après un geste utilisateur → **lazy avec Suspense**.

## Budget bundle (objectif)

- Chunk `index` : **< 150 kB gzip** (au 2026-08-25 soir : **87,2 kB**, **marge : 62,8 kB**).
- **Cliquet** : `npm run check:bundle` refuse un chunk d'entrée au-dessus de **92 kB gzip**, soit
  ~5 % au-dessus du mesuré. Bloquant dans le job CI `lint-test-build`, juste après le build.

> ✅ **Ce budget a enfin sa garde (2026-08-25).** Il était le seul du dépôt à n'être mesuré par
> aucun script, et le seul à avoir reculé sans que personne le voie : +5 kB gzip en une journée,
> pour une marge de 11 kB. `scripts/check-bundle-budget.mjs` lit le build RÉEL, les tailles gzip
> de `dist/assets`, et surtout **le chunk d'entrée déclaré dans `dist/index.html`**, pas le
> premier `index-*.js` venu.
>
> 🔴 **Ne jamais remonter un plafond pour faire passer la CI.** Même règle que
> `vitest.config.ts` : un plafond ne descend que quand la mesure descend.

> ✅ **Le levier i18n est APPLIQUÉ (2026-08-25 soir).** Le catalogue `fr` était importé
> **statiquement** en entier par `src/i18n/catalog.ts` : 19 namespaces, **178 ko de JSON brut**
> dans le chunk `index`, dont `org` 50 ko, `landing` 34 ko, `guide` 14 ko, `tutorials` 8 ko, des
> pages que la plupart des sessions n'ouvrent jamais.
>
> **Ce qui a été fait, et pourquoi c'est sûr.** Seuls `common` et `errors` restent eager. Le choix
> n'est pas arbitraire : `scripts/i18n-shell-namespaces.mjs` parcourt le graphe d'imports
> statiques depuis `App.tsx` et `main.tsx` et dit exactement ce que le SHELL rend avant qu'une
> route soit résolue. Les 17 autres sont attendus par `lazyWithRetry` (src/App.tsx), donc par le
> `<Suspense>` qui enveloppe déjà chaque route.
>
> ⚠️ **Le risque était réel et il est traité par une garde, pas par la vigilance.** Rendre un
> namespace paresseux sans attendre son chargement affiche `org.project.name` à l'écran pendant
> une frame. `src/i18n/lazy-namespaces.guard.test.ts` échoue si une route déclare moins de
> namespaces que son sous-arbre n'en utilise, sous-arbre calculé en traversant AUSSI les `lazy()`
> imbriqués, parce qu'un composant chargé paresseusement dans une page rend quand même sous le
> même toit.
>
> **Vérifié dans le navigateur sur le build de production**, pas seulement en test : 10 routes en
> `fr` et 5 en `en`, balayage du DOM et des attributs `aria-label` / `title` / `placeholder` à la
> recherche du motif `namespace.clé`. **Zéro occurrence.**
>
> ⚠️ Un test de composant qui monte directement un composant utilisant un namespace non-eager doit
> désormais faire `await ensureNamespaces(['org'], 'fr')` dans un `beforeAll`, sinon il assertera
> sur des clés brutes. Exemple : `EnterpriseTierGrid.test.tsx`.

- Chaque chunk lazy : **< 80 kB gzip**. Exceptions documentées : `vendor-charts` (118 kB),
  `vendor-calendar` (85 kB), `vendor-gsap` (55 kB).
  ⚠️ **`OrganizationPage` est à 64,2 kB gzip au 2026-08-25** (61 kB la veille) : toujours sous le
  budget, mais c'est de loin le plus gros chunk de page, et il grossit à chaque vague entreprise.
  Le découpage de `PyramidTab` (1 506 → 1 045 lignes) **n'a rien changé à son poids** : extraire
  `PyramidNodeCard` déplace du code à l'intérieur du même chunk. Découper aide la maintenabilité ;
  seul le `lazy` aide le bundle.

> **`vendor-calendar` : 76 → 85 kB gzip (2026-08-02, i18n Agenda).** `AgendaPage`
> importe `@fullcalendar/core/locales-all` (+9 kB gzip). Sans données de locale,
> FullCalendar retombe sur les défauts anglais pour `firstDay` et l'agenda
> français commençait la semaine le dimanche. L'alternative — un import par
> langue (~1 kB) — obligerait à éditer `AgendaPage.tsx` à chaque nouvelle
> langue, ce que le socle i18n évite partout ailleurs (cf. `src/i18n/catalog.ts`).
> Coût assumé : le chunk est lazy et ne concerne que `/agenda`.
- Le warning Vite `> 400 kB` sur `index` est **déjà là** et ne signale pas une régression du split
  charts (les vendors sont bien isolés) : c'est le code applicatif qui a grossi (mode entreprise,
  i18n). Si tu veux le faire baisser, la cible est le découpage des grosses pages, pas `manualChunks`.

## Résiduels connus (audit perf du 2026-05-29, revérifiés le 2026-08-14)

- ✅ **Lighthouse CI câblé le 2026-08-24** (`lighthouserc.json` + job `lighthouse` dans
  `.github/workflows/ci.yml`). Mesure LCP / TBT / CLS / a11y / SEO sur les 4 routes
  **prérendues** (`/`, `/guide`, `/blog`, `/pour-freelances`) ; les routes protégées
  demandent une session, donc un job Playwright, pas Lighthouse.
  Bloquant sur a11y, SEO et CLS ; avertissement sur la performance, qui varie avec le
  runner — une gate rouge en permanence finit ignorée.
  ⚠️ **Les seuils sont PROVISOIRES et doivent être resserrés après le premier run.**
  Ils n'ont pas pu être posés « au réel mesuré » comme les autres budgets du dépôt :
  Lighthouse a besoin d'un Chrome exécutable, absent de la machine de développement.
  Un budget très au-dessus du réel ne mesure rien.
- **`vendor-charts` reste le plus gros lazy** (118 kB gzip). Le grief d'origine (« chargé au scroll
  de la landing ») est **caduc** : la landing n'importe plus Recharts. Une migration `visx`/`chart.js`
  n'a donc plus d'urgence.
- **15 fichiers source dépassent 600 LOC** (2026-08-25), le plus gros étant désormais
  `src/components/TaskTable.tsx` (1 124 lignes), et non plus `PyramidTab.tsx`, tombé à 1 045.
  L'objectif « aucun fichier > 600 LOC » du refactor de juin 2026 n'est toujours pas tenu, mais le
  budget baisse : 13 103 → 11 452 lignes en deux jours, cf.
  [`ARCHITECTURE.md`](./ARCHITECTURE.md) §3.

## Ce que coûte une ouverture d'application

**32 requêtes REST, mesurées le 2026-08-26** sur les `edge_logs` de production, pour une session
réelle du bundle courant arrivant à froid sur `/dashboard`. Toutes distinctes : React Query
dédoublonne correctement, il n'y a pas de requête émise deux fois.

| Ce qui les émet | Requêtes | Payées par |
|---|---|---|
| Données du tableau de bord (tâches, catégories, listes, agenda, habitudes, OKR, KR) | 9 | tout le monde |
| Collaboration (amis, demandes, tâches et listes partagées, liens) | 6 | tout le monde |
| Mode entreprise (org, membres, adhésions, notifications, invitations, projets, tâches d'équipe) | 8 | **membres d'une org seulement** |
| Session et profil (profil, abonnement, `touch_last_seen`) | 3 | tout le monde |

Ce n'est pas absurde pour sept domaines métier affichés, et ces requêtes partent en parallèle sur
HTTP/2, pas en série. Mais **c'est le multiplicateur de charge du produit** : 100 arrivées
simultanées valent 3 200 requêtes. C'est ce nombre qu'il faut surveiller avant un pic
d'acquisition, bien avant le coût unitaire de chacune.

⚪️ **Piste identifiée, non engagée** : les 8 requêtes du mode entreprise sont montées par
`Layout`, donc sur **toutes** les pages protégées, y compris quand aucun écran entreprise n'est
affiché. Elles ne servent qu'à peindre une pastille de notification. Une RPC d'agrégat
ramènerait l'ouverture à 25 requêtes pour un membre d'organisation, sans rien changer à l'écran.

### 🔴 Le correctif que personne ne reçoit : les onglets jamais rechargés

**91,5 % du trafic Supabase du 2026-08-26 est venu de DEUX onglets** qui exécutaient encore le
bundle d'avant la suppression des sondes (2026-08-25). Ventilation par session, sur les 18 408
requêtes `/rest/v1/*` de la journée :

| Session | Requêtes / 24 h | dont `friend_requests` | Verdict |
|---|---|---|---|
| `051be163` | 10 835 | 6 151 | ancien bundle, **sonde toutes les 16 à 20 s** |
| `dc812ab1` | 6 002 | 2 044 | ancien bundle, **sonde** |
| `7aa61ad2` | 1 185 | 52 | bundle courant, **aucune sonde** |

La session propre est restée ouverte **douze heures** pour 52 lectures de `friend_requests`, soit
4 par heure, toutes attribuables à des changements d'écran. Le code livré est propre. **Ce qui
tourne encore, c'est du code d'avant.**

Une SPA ne recharge pas son bundle toute seule : un onglet laissé ouvert exécute indéfiniment la
version qu'il a téléchargée. Conséquence produit, contre-intuitive : **un gain de performance
n'atteint que les utilisateurs qui rouvrent l'application**, et les plus assidus, ceux qui ne
ferment jamais l'onglet, sont les derniers servis et les plus coûteux.

⚪️ **Reste ouvert** : COSMO n'a aucun mécanisme pour signaler à un onglet ouvert qu'une nouvelle
version existe. C'est le chantier qui transformerait tout correctif client en gain réel.

## Limites de requêtes

> **⚡ `tasks` : lire via `get_my_tasks()`, jamais `.from('tasks')`** (mig. 085,
> 2026-08-07). La policy `tasks_select_own_or_shared` est un `OR` qui rend
> `idx_tasks_user_id` inutilisable → `Seq Scan` de la table GLOBALE, vérifié par
> `EXPLAIN` en prod. La RPC exprime le même ensemble en `UNION` indexable.
> Vaut pour `getAll`, `getByDate`, `getFiltered` **et** `getPage`.
> Exception : `getById` (accès par clé primaire).

> **⚡ Tables entreprise : passer par les RPC indexables** (mig. 113 et 117, appliquées en prod).
> `team_tasks` / `team_projects` / `team_task_dependencies` sont filtrées par
> `can_access_team_project(...)`, une fonction appelée par ligne, donc `Seq Scan` obligatoire +
> CTE récursive à chaque ligne, **≈ 60× le coût par ligne** du prédicat de `tasks` (mesuré le
> 2026-08-14). Les policies restent en place en défense en profondeur ; les lectures passent par
> `get_my_team_tasks`, `get_my_team_projects` et `get_my_team_task_dependencies`, qui n'évaluent
> le sous-arbre managérial **qu'une fois par organisation**. Chemin verrouillé par
> `team-projects/supabase.repository.test.ts`. Détail : [`SCALABILITY.md`](./SCALABILITY.md) §2.


> **⚡ `events` : ne jamais faire juger une ligne par une fonction** (mig. `128`, **appliquée en
> prod le 2026-08-27**). La policy de lecture appelait `manages_user(user_id)`, une fonction **sur une
> colonne**, donc rappelée pour chaque ligne examinée, chaque appel joignant deux fois
> `organization_members` puis évaluant la CTE récursive `get_subtree`. Mesuré en prod le
> 2026-08-26, plan chauffé, lecture de l'agenda d'un membre non géré : **17,19 ms → 0,61 ms**, et
> le plan passe de `Rows Removed by Filter: 128` à un BitmapOr de deux Index Scan, donc **zéro
> ligne remontée du tas pour être jetée**. Lire son propre agenda ne changeait rien (0,25 ms) : la
> branche « own » court-circuitait déjà le `OR`. Le correctif est `my_managed_user_ids()`, sans
> argument, donc hissée en InitPlan et évaluée une fois par requête. Troisième occurrence de la
> classe, après `tasks` (085) et `team_tasks` (113, 117). Garde :
> `scripts/migration-guards.test.mjs`. Détail : [`SCALABILITY.md`](./SCALABILITY.md) §2ter.

> **📉 Habitudes : lire par `get_my_habits(p_days)`** (mig. 119, prod). `habits.completions`
> gagnait 12,7 octets par jour et par habitude, **sans borne**. La RPC renvoie `completions`
> filtré à la fenêtre ET quatre agrégats calculés serveur sur l'historique entier
> (`streak_current`, `streak_best`, `completions_total`, `first_completion_date`), c'est ce qui
> rend la troncature acceptable. **Ne jamais dériver une série ou un total de `completions`.**

> **📡 Collaboration : Realtime, pas sondage** (mig. 089). Le `refetchInterval`
> de 15 s sur `useTasks` coûtait ≈ 58 Mo/mois/utilisateur d'egress Supabase.
> `useSharedTasksRealtime` (monté une fois dans `App.tsx`) écoute
> `shared_tasks` ; le sondage subsiste à 5 min en filet de sécurité.
> Toute table écoutée doit être dans la publication `supabase_realtime` **et**
> en `REPLICA IDENTITY FULL` (sinon les DELETE ne portent que la clé primaire).

> **🔑 Identité : `getSession()`, pas `getUser()`** (`src/lib/auth-user.ts`).
> `supabase.auth.getUser()` fait un **aller-retour réseau** vers GoTrue ; il
> était appelé en tête de presque chaque lecture (45 sites), doublant la latence
> perçue et faisant de GoTrue un SPOF pour la lecture de données.

Les `getAll()` à fort volume (**tasks, events, habits, okrs**) utilisent l'auto-pagination `fetchAllPages()` (`src/lib/fetch-all-pages.ts`) : pagination via `.range(from, to)` par pages de `PAGE_SIZE` (1000) jusqu'à épuisement, plafonné à `MAX_ROWS` (5000). Pour ≤ 1000 items → **une seule requête**. Ordre stable garanti par un tiebreak `.order('id')`.

- Les `getAll()` à faible volume (categories, lists, friends) gardent `.limit(200)`.
- ❌ Ne pas réintroduire un `.limit(500)` sec sur tasks/events/habits/okrs.
- ✅ Tout nouveau `getAll()` volumineux doit passer par `fetchAllPages()`.

## Ne jamais faire — Performance

- ❌ Importer `gsap` hors de la landing page, ou en direct depuis `'gsap'` — passer par `@/lib/gsap` (chunk `vendor-gsap`, cf. CLAUDE.md). Partout ailleurs : Framer Motion ou CSS keyframes.
- ❌ Importer un composant Recharts sans `React.lazy` — fait retomber `vendor-charts` (374 kB) dans le critical path.
- ❌ Ajouter une dépendance > 50 kB minified sans règle `manualChunks`.
- ❌ Importer `* as locales` de `date-fns/locale` ou `* as Icons` de `lucide-react` — casse le tree-shaking.
- ❌ Monter un composant gros au niveau App qui ne s'affiche qu'après un geste — il doit être `lazy` + Suspense.
- ❌ Écrire un prédicat de policy RLS qui appelle une fonction **sur une colonne** (`fn(user_id)`). Il est rappelé pour chaque ligne examinée et rend l'index inutilisable. Un helper sans argument, dont le périmètre vient de `auth.uid()` seul, est hissé en InitPlan et évalué une fois par requête. Trois occurrences déjà : `tasks` (085), `team_tasks` (113, 117), `events` (128).
- ❌ **Valider un correctif de performance CLIENT sur un compteur agrégé de Postgres** (`pg_stat_user_tables`, `pg_stat_statements`). Ils cumulent depuis la création de la base et mélangent les anciens et les nouveaux clients : ils donneront tort au correctif pendant des jours. Ventiler les `edge_logs` par `request.sb.jwt.authorization.payload.session_id`, une seule session du bundle courant suffit à trancher.
- ❌ Conclure quoi que ce soit d'un total cumulé. Seul un **delta entre deux instants**, mesuré au repos, donne un débit. `organization_members` affichait 2 440 047 balayages pour 11 lignes et n'en prenait **aucun** sur une fenêtre de 285 s au repos.

## Optimisations 2026-07-16 (issues de l'audit technique 2026-07-15)

| Optimisation | État |
|---|---|
| **Agrégats stats en SQL** | Module `src/modules/stats/` : `useWorkTimeStats(ranges)` → RPC `get_work_time_stats` (mig. 074, SECURITY INVOKER, cap 32 plages) en prod ; `LocalStatsRepository` (même calcul que `calculateWorkTimeForPeriod`) en démo. StatisticsPage : graphique « Temps investi » + synthèse 4 périodes = **un seul appel RPC (~1 kB)** au lieu d'un reduce client sur toutes les entités. Les sections détaillées (TasksStatistics, heatmap, insights) consomment encore les entités — migration en suivant. |
| **staleTime différencié** | categories : 15 → 30 min ; lists : 10 → 30 min (les mutations invalident le cache, le refetch périodique était du gaspillage). |
| **Prefetch au hover** | Déjà en place (`src/lib/route-prefetch.ts` + sidebar `NavItemLink`). Ajout de la route `/entreprise` (chunk OrganizationPage/PyramidTab). |
| **Brotli + fonts** | Vérifié en prod le 2026-07-16 : `Content-Encoding: br` servi par Vercel sur `/assets/*` (fallback gzip), cache immuable 1 an. `display=swap` déjà présent sur la feuille Google Fonts (`index.html`). Rien à changer. |

- ⚠️ La sémantique de la RPC `get_work_time_stats` doit rester **identique** à `calculateWorkTimeForPeriod` (dates locales inclusives via `p_tz`) — les deux modes démo/prod doivent afficher les mêmes chiffres à données égales.
