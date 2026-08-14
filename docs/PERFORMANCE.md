# Performance bundle — `vite.config.ts manualChunks`

## Vendor chunks isolés (commenter toute modif)

**Tailles réelles, `npm run build` du 2026-08-14** (brut / gzip) :

| Chunk | Contenu | Taille (gzip) | Quand chargé |
|---|---|---|---|
| `index` (app) | code applicatif partagé | **438 kB (124 kB)** | Toujours |
| `vendor-react` | react + react-dom + scheduler | 227 kB (72 kB) | Toujours |
| `vendor-router` | react-router | 38 kB (14 kB) | Toujours (split pour parallel HTTP/2) |
| `vendor-radix` | @radix-ui/* | 177 kB (51 kB) | Toujours |
| `vendor-supabase` | @supabase/supabase-js | 191 kB (50 kB) | Toujours (extrait pour cache CDN) |
| `vendor-sentry` | @sentry/react | 140 kB (47 kB) | Toujours (extrait pour cache CDN) |
| `vendor-animation` | framer-motion | 146 kB (49 kB) | Toujours |
| `vendor-utils` | date-fns + lucide-react | 71 kB (21 kB) | Toujours |
| `vendor-query` | @tanstack/* | 55 kB (16 kB) | Toujours |
| `vendor-charts` | **recharts + d3-* + victory-vendor** | 400 kB (116 kB) | **Lazy** (StatisticsPage, DashboardChart, GuidePage) |
| `vendor-calendar` | @fullcalendar/* **+ `locales-all`** | 290 kB (85 kB) | **Lazy** (`/agenda` uniquement) |
| `vendor-gsap` | gsap + plugins | 133 kB (52 kB) | **Lazy** (LandingPage uniquement) |

> 🟠 **Le warning Vite « chunks larger than 400 kB » est actif** (build du 2026-08-14) :
> le chunk `index` est à 438 kB brut / 124 kB gzip. Sous le budget gzip (< 150 kB) mais la marge
> s'est réduite — c'est le poste à surveiller, pas les vendors.
> Recharts n'est **plus** importé par la landing (`AppWindowShowcase` l'exclut volontairement du
> hero) : `StatsShowcase` ne vit plus que dans `GuidePage`, en `React.lazy`.

## Règles non négociables

- ❌ **Ne jamais importer Recharts ou un composant qui l'utilise (DashboardChart/StatsShowcase) sans `React.lazy`** — sinon il retombe dans le chunk du caller et pollue le critical path. Faille P-2.
- ⚠️ **GSAP : réintroduit en 2026-07, landing page uniquement.** L'ancienne règle « ne jamais réintroduire GSAP » (finding P-1, 2026-05) **ne s'applique plus** : la lib est de retour derrière le point d'entrée unique `src/lib/gsap.ts`, isolée dans le chunk `vendor-gsap` que seule la `LandingPage` (lazy) charge. Contrainte maintenue : **aucun import GSAP hors landing**, et jamais `import { gsap } from 'gsap'` en direct.
- ❌ **Toute nouvelle dep > 50 kB minified doit être ajoutée à `manualChunks`** avec une règle explicite et commentée.
- ✅ `lucide-react` : imports nominaux uniquement (`import { Icon } from 'lucide-react'`). Jamais `import * as`.
- ✅ `date-fns/locale/fr` : import nominal. Jamais `import * as locales`.
- ✅ Tout composant globalement monté dans App.tsx (CommandPalette, etc.) qui n'apparaît qu'après un geste utilisateur → **lazy avec Suspense**.

## Budget bundle (objectif)

- Chunk `index` : **< 150 kB gzip** (au 2026-08-14 : **124 kB** — marge réduite, à surveiller).
- Chaque chunk lazy : **< 80 kB gzip**. Exceptions documentées : `vendor-charts` (116 kB),
  `vendor-calendar` (85 kB), `vendor-gsap` (52 kB).

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

- **Lighthouse CI toujours absent** — aucun job ne mesure LCP/TBT/CLS par route. Reste à câbler.
- **`vendor-charts` reste le plus gros lazy** (116 kB gzip). Le grief d'origine (« chargé au scroll
  de la landing ») est **caduc** : la landing n'importe plus Recharts. Une migration `visx`/`chart.js`
  n'a donc plus d'urgence.
- **13 fichiers source dépassent 600 LOC**, le plus gros étant
  `src/components/organization/PyramidTab.tsx` (1455 lignes). L'objectif « aucun fichier > 600 LOC »
  du refactor de juin 2026 **n'est plus tenu** — impact surtout sur la maintenabilité et le chunk `index`.

## Limites de requêtes

> **⚡ `tasks` : lire via `get_my_tasks()`, jamais `.from('tasks')`** (mig. 085,
> 2026-08-07). La policy `tasks_select_own_or_shared` est un `OR` qui rend
> `idx_tasks_user_id` inutilisable → `Seq Scan` de la table GLOBALE, vérifié par
> `EXPLAIN` en prod. La RPC exprime le même ensemble en `UNION` indexable.
> Vaut pour `getAll`, `getByDate`, `getFiltered` **et** `getPage`.
> Exception : `getById` (accès par clé primaire).

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

## Optimisations 2026-07-16 (issues de l'audit technique 2026-07-15)

| Optimisation | État |
|---|---|
| **Agrégats stats en SQL** | Module `src/modules/stats/` : `useWorkTimeStats(ranges)` → RPC `get_work_time_stats` (mig. 074, SECURITY INVOKER, cap 32 plages) en prod ; `LocalStatsRepository` (même calcul que `calculateWorkTimeForPeriod`) en démo. StatisticsPage : graphique « Temps investi » + synthèse 4 périodes = **un seul appel RPC (~1 kB)** au lieu d'un reduce client sur toutes les entités. Les sections détaillées (TasksStatistics, heatmap, insights) consomment encore les entités — migration en suivant. |
| **staleTime différencié** | categories : 15 → 30 min ; lists : 10 → 30 min (les mutations invalident le cache, le refetch périodique était du gaspillage). |
| **Prefetch au hover** | Déjà en place (`src/lib/route-prefetch.ts` + sidebar `NavItemLink`). Ajout de la route `/entreprise` (chunk OrganizationPage/PyramidTab). |
| **Brotli + fonts** | Vérifié en prod le 2026-07-16 : `Content-Encoding: br` servi par Vercel sur `/assets/*` (fallback gzip), cache immuable 1 an. `display=swap` déjà présent sur la feuille Google Fonts (`index.html`). Rien à changer. |

- ⚠️ La sémantique de la RPC `get_work_time_stats` doit rester **identique** à `calculateWorkTimeForPeriod` (dates locales inclusives via `p_tz`) — les deux modes démo/prod doivent afficher les mêmes chiffres à données égales.
