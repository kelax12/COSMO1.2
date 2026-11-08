> ⚠️ **ARCHIVE : récits du budget de bundle, levier sonner et résiduels de l'audit du 2026-05-29, extrait de `docs/PERFORMANCE.md` le 2026-11-08, non maintenu.**
> Chaque passage décrit l'état **à sa date**, y compris ses listes « ce qui reste » : une bonne part a été faite depuis.
> État courant : [`docs/PERFORMANCE.md`](../PERFORMANCE.md). Les notes /100 ont cessé (ADR 0012) : [`docs/INDICATEURS.md`](../INDICATEURS.md).
> Les liens relatifs et les ancres de ce passage sont ceux de son document d'origine : certains ne résolvent plus.

## Budget bundle (objectif)

- **Mesure du 2026-09-11** (build avec `VITE_SENTRY_DSN`, arbre propre) : chunk d'entrée
  **66 896 o gzip**, chemin critique **306 347 o gzip** sur 7 chunks.

  ✅ **Ces deux chiffres sont COMMITÉS et vérifiés par la CI depuis le 2026-09-14** — commit
  `7134d7fe`, run `34846164939` vert sur les cinq jobs, étape `Budget de bundle` comprise :
  entrée **66,9 ko**, chemin critique **306,6 ko** sur le build du runner.
  🔴 **Ils ont vécu trois jours dans un arbre de travail NON COMMITÉ**, pendant lesquels ce
  document et `CLAUDE.md` les annonçaient comme en vigueur alors que `main` portait encore
  78 000 / 370 000. Une branche entière (`feat/react-19`) a été arbitrée contre un plafond qui
  n'existait nulle part, et trois commits `fix(build)` d'autres sessions sont revenus à `sonner`
  faute de trouver la façade dans le dépôt. **Un plafond se relit dans le fichier commité.**
- **Cliquet** : `npm run check:bundle` refuse un chunk d'entrée au-dessus de **70 500 o gzip** et
  un chemin critique au-dessus de **323 000 o gzip**. Bloquant dans le job CI `lint-test-build`,
  juste après le build.
- 🔴 **Le plafond d'entrée est passé de 92 à 112 kB le 2026-08-26**, seule remontée de plafond du
  dépôt, justifiée en commentaire dans `scripts/check-bundle-budget.mjs`. Une seconde remontée
  ferait du budget une formalité : la marge se regagne en descendant la mesure. Depuis, il n'a
  fait que descendre : 112 000 → 79 000 → 78 000 → 71 000 → **70 500** (2026-10-01).

### 🟢 2026-10-22 : trois chunks au bord du plafond, marge rendue, deux cliquets abaissés

`vendor-utils`, `StatisticsPage` et `AgendaPage` étaient à moins de 2 % de leur cliquet : le
commit suivant les aurait fait rougir, comme `OrganizationPage` le 2026-10-19. Règle suivie : ne
sortir en lazy que ce qui sert à l'interaction (modales, menus, surfaces secondaires), jamais un
plafond relevé. Mesure contre un build de `main` à `b687a683` dans le même worktree (confirmée par le `check:bundle` de la CI, build avec Sentry, sur `main` à `e9ed98f2` puis sur la PR), **tous les
chunks** comparés par nom de base (octets gzip, comme `check:bundle`). Les deux builds sans
`VITE_SENTRY_DSN`, pour comparer à l'identique ; aucun des chunks ci-dessous ne dépend de Sentry.

| Chunk | `main` | Après | Plafond | Marge | Levier |
|---|---|---|---|---|---|
| `StatisticsPage` | 12 977 | **10 181** | 13 000 → **10 800** | 0,2 % → **5,7 %** | la modale Premium (montée au clic sur un verrou) et la heatmap des habitudes (bas de page, sous la ligne de flottaison) chargées à part, `pages/statistics/lazy-surfaces.tsx` |
| `AgendaPage` | 18 278 | **17 310** | 18 500 → **18 300** | 1,2 % → **5,4 %** | le tutoriel et ses étapes desktop et mobile (première visite seulement), le panneau de revue de la modale d'édition, le menu de revue d'un créneau passé, dans `pages/agenda/lazy-overlays.tsx` |
| `vendor-utils` | 32 854 | **31 342** | 33 000 (laissé) | 0,4 % → **5,0 %** | `match` (parseur) et `formatRelative` retirés des locales date-fns `fr` et `en-US` par un plugin de `vite.config.ts` : aucun code n'appelle `parse()`, `isMatch()` ni `formatRelative()`. Cliquet : `src/i18n/date-fns-no-parse.guard.test.ts` |
| Chemin critique | 305,3 ko | **303,8 ko** | 323,0 ko | | `vendor-utils` est préchargé : le gain vaut pour **tout** visiteur |
| Entrée (`main`) | 67 085 | 67 123 | 70 500 | | +38 o : en-têtes d'import |
| Lot `index` (9 barils) | 86,8 ko | **86,8 ko** | 89 500 | | inchangé, aucun effet « Popper » (le piège du 2026-09-24, où un onglet rendu lazy avait sorti Popper vers `index`) : `dropdown-menu` reste à 20,5 ko |

Les deux cliquets abaissés sont posés au nouveau poids avec 5 % de marge, la convention du
fichier. `vendor-utils` garde 33 000 : l'abaisser ferait passer sa marge sous 5 %.

Nouveaux chunks, tous chargés au geste ou après le premier rendu : `HabitHeatmap` 2,2 ko,
`PremiumGateModal` 1,8 ko, `SlotReviewMenu` 1,0 ko, `AgendaTutorial` 0,8 ko, `SlotReviewPanel`
0,6 ko, `use-mounted-after-first-open` 0,15 ko (le crochet, désormais partagé par trois pages).
Les autres chunks bougent de −49 à +38 o.

⚠️ **`vendor-utils` reste le plus serré des trois** : 5,0 % tout juste. Il porte surtout les icônes
lucide (190 icônes, ~23 ko gzip sur 31) et chaque icône inédite y ajoute ~120 o, payés par tout
visiteur. Levier écarté le 2026-10-22 : laisser Rollup placer les icônes à un seul consommateur
avec celui-ci (50 icônes sur 191, ~5 ko). Il ferait grossir les barils `index` partagés (les
consommateurs comme `DescriptionField` ou `TaskQuickFilters` y vivent) et une trentaine de chunks
de page. Avant d'ajouter une icône : réutiliser une icône déjà présente.

### 🔴 2026-10-01 : `main` rouge sur le budget depuis le 2026-09-24, quatre chunks ramenés

`check:bundle` échouait sur `main` depuis une semaine, sur quatre chunks à la fois, mesurés
identiques sur un build de `HEAD` (`af4e885b`) en worktree avant toute retouche. Aucun plafond
n'a été relevé ; quatre ont été **abaissés** derrière la mesure.

| Chunk | Avant | Après | Plafond | Levier |
|---|---|---|---|---|
| Entrée | 73,2 ko | **67,1 ko** | 71 000 → 70 500 | Six barils (`tasks`, `habits`, `organizations`, `team-projects`, `team-okrs`, `org-teams`) **réexportaient** leur dépôt de démo : importés par le shell, ils le ramenaient dans l'entrée alors que la fabrique le charge à la demande. Réexportations retirées ; tâches et habitudes passent aussi par `demo-repositories.ts` |
| Chemin critique | 315,3 ko | **309,3 ko** | 323 000 | même coupe : c'est ce qui prouve que l'entrée a maigri, et pas déplacé |
| `org` (fr + en) | 40,6 ko | **23,7 ko** | 30 000 → 25 000 | `org` est chargé par `Layout`, donc par **tout** compte connecté. 34 sections que seul `/entreprise` affiche passent dans `orgAdmin`, que la route `/entreprise` charge déjà |
| `legal` (fr + en) | 18,5 ko | **2,7 ko** | 15 500 → 3 000 | CGU et confidentialité dans `legalTerms` / `legalPrivacy` (9,2 et 9,4 ko), chacune chargée par sa seule page |
| `TeamTaskModal` | 16,0 ko | **11,4 ko** | 14 500 → 12 000 | commentaires et arbre de catégories chargés à la demande |
| `OrganizationPage` | 18,0 ko | **17,5 ko** | 18 000 | les mutations de facturation sortent dans `org-billing.mutations.ts` |

⚠️ **Le piège de la première coupe, et il resservira.** Une réexportation dans un baril que le
shell importe annule n'importe quel `import()` dynamique du même module : Rollup le place dans
l'ancêtre commun, c'est-à-dire l'entrée. `demo-repositories.ts` chargeait le dépôt de démo des
organisations à la demande depuis le 2026-09-02, et ses 17 ko bruts étaient pourtant dans
l'entrée, par `export { LocalStorageOrganizationsRepository } from './local.repository'`.

### 🔴 Le levier du 2026-09-11 : `sonner` sort du chemin critique (−10,1 ko pour tout le monde)

| | Avant | Après | Plafond |
|---|---|---|---|
| Chunk d'entrée | 76 954 o (marge **1,34 %**) | **66 896 o** (marge 5,78 %) | 78 000 → 71 000 |
| Chemin critique | 316 407 o (marge 14,48 %) | **306 347 o** (marge 5,16 %) | 370 000 → 323 000 |

Le `<Toaster>` d'`App.tsx` et 58 modules appelaient `sonner` par un import statique. Or aucun de
ces appels ne peut partir avant que la personne agisse : ce sont des `onSuccess` / `onError` de
mutation et des gestionnaires d'évènement. Tout passe désormais par `src/lib/toast.ts`, qui porte
le **seul** `import('sonner')` du dépôt, et le `<Toaster>` est monté en `lazy()` derrière son
propre `<Suspense fallback={null}>`.

⚠️ **Le piège, mesuré, parce qu'il se reproduira.** Nettoyer le SHELL ne suffit pas, et sortir le
module par `manualChunks` non plus :

| Forme | Entrée | Chemin critique |
|---|---|---|
| 57 imports statiques dans des pages lazy, shell nettoyé | 77 017 o | 316 470 o |
| idem + `manualChunks` vers `vendor-toast` | 66 899 o | **316 245 o** |
| **zéro import statique**, un seul `import()` | 66 896 o | **306 347 o** |

La deuxième ligne est le piège : l'entrée maigrit de 10 ko et le chemin critique de **162
octets**. Tant qu'une page lazy garde l'import statique, Rollup place le module dans l'ancêtre
commun des chunks qui le partagent, c'est-à-dire l'entrée ; l'en sortir par un chunk nommé fait
émettre à Vite un `<link rel="modulepreload">` dans `index.html`, donc le navigateur le télécharge
exactement comme avant. **C'est le même piège que celui documenté pour `@sentry` dans
`vite.config.ts`.** Cliquet : `src/lib/toast.guard.test.ts`.

⚠️ **La mesure précédente (74 903 o, 3,97 % de marge, 2026-09-04) n'avait pas été refaite.** Entre
les deux, l'entrée avait REPRIS 2 051 o (refonte mobile, extraction i18n, 53 surfaces modales).
La marge réelle au moment de reprendre l'item n'était pas 3,97 % mais **1,34 %** : un budget qu'on
ne remesure pas dérive dans le sens qui arrange.

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
> *(chiffres du 2026-08-25, conservés à leur date : c'est l'état AVANT le levier. Remesuré le
> 2026-09-14 : le dépôt porte désormais **23 namespaces** et **244 ko** de JSON `fr` sur disque,
> 215 ko pour `en`. Le levier n'est donc pas « un gain de 178 ko » acquis une fois pour toutes,
> c'est une digue dont la pression augmente : +66 ko de catalogue en vingt jours, tous tenus hors
> du chunk d'entrée par la seule règle des deux namespaces eager.)*
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
  [`ARCHITECTURE.md`](../ARCHITECTURE.md) §3.

---

## Optimisations 2026-07-16 (issues de l'audit technique 2026-07-15)

| Optimisation | État |
|---|---|
| **Agrégats stats en SQL** | Module `src/modules/stats/` : `useWorkTimeStats(ranges)` → RPC `get_work_time_stats` (mig. 074, SECURITY INVOKER, cap 32 plages) en prod ; `LocalStatsRepository` (même calcul que `calculateWorkTimeForPeriod`) en démo. StatisticsPage : graphique « Temps investi » + synthèse 4 périodes = **un seul appel RPC (~1 kB)** au lieu d'un reduce client sur toutes les entités. Les sections détaillées (TasksStatistics, heatmap, insights) consomment encore les entités — migration en suivant. |
| **staleTime différencié** | categories : 15 → 30 min ; lists : 10 → 30 min (les mutations invalident le cache, le refetch périodique était du gaspillage). |
| **Prefetch au hover** | Déjà en place (`src/lib/route-prefetch.ts` + sidebar `NavItemLink`). Ajout de la route `/entreprise` (chunk OrganizationPage/PyramidTab). |
| **Brotli + fonts** | Vérifié en prod le 2026-07-16 : `Content-Encoding: br` servi par Vercel sur `/assets/*` (fallback gzip), cache immuable 1 an. `display=swap` déjà présent sur la feuille Google Fonts (`index.html`). Rien à changer. |

- ⚠️ La sémantique de la RPC `get_work_time_stats` doit rester **identique** à `calculateWorkTimeForPeriod` (dates locales inclusives via `p_tz`) — les deux modes démo/prod doivent afficher les mêmes chiffres à données égales.

---
