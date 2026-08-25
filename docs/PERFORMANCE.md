# Performance bundle — `vite.config.ts manualChunks`

## Vendor chunks isolés (commenter toute modif)

**Tailles réelles, `npm run build` du 2026-08-24** (brut / gzip). La colonne « 08-15 » garde la
mesure précédente pour rendre la dérive lisible :

| Chunk | Contenu | 08-15 (gzip) | **08-24 (gzip)** | Quand chargé |
|---|---|---|---|---|
| `index` (app) | code applicatif partagé | 448 kB (128 kB) | **470 kB (134 kB)** 🟠 | Toujours |
| `vendor-react` | react + react-dom + scheduler | 227 kB (72 kB) | 227 kB (72 kB) | Toujours |
| `vendor-router` | react-router | 38 kB (14 kB) | 38 kB (14 kB) | Toujours (split pour parallel HTTP/2) |
| `vendor-radix` | @radix-ui/* | 177 kB (51 kB) | 145 kB (45 kB) | Toujours |
| `vendor-supabase` | @supabase/supabase-js | 191 kB (50 kB) | 215 kB (56 kB) | Toujours (extrait pour cache CDN) |
| `vendor-sentry` | @sentry/react | 140 kB (47 kB) | 146 kB (49 kB) | Toujours (extrait pour cache CDN) |
| `vendor-animation` | framer-motion | 146 kB (49 kB) | 148 kB (49 kB) | Toujours |
| `vendor-utils` | date-fns + lucide-react | 71 kB (21 kB) | 70 kB (21 kB) | Toujours |
| `vendor-query` | @tanstack/* | 55 kB (16 kB) | 60 kB (18 kB) | Toujours |
| `vendor-charts` | **recharts + d3-* + victory-vendor** | 400 kB (116 kB) | 414 kB (118 kB) | **Lazy** (StatisticsPage, DashboardChart, GuidePage) |
| `vendor-calendar` | @fullcalendar/* **+ `locales-all`** | 290 kB (85 kB) | 290 kB (85 kB) | **Lazy** (`/agenda` uniquement) |
| `vendor-gsap` | gsap + plugins (+ `InertiaPlugin`) | 139 kB (55 kB) | 139 kB (55 kB) | **Lazy** (LandingPage uniquement) |
| `vendor-ogl` | ogl — micro-runtime WebGL | 44 kB (13 kB) | 44 kB (13 kB) | **Lazy** (fond `LightRays` du hero entreprise) |
| **`OrganizationPage`** | **tout le mode entreprise** | non listé | **265 kB (61 kB)** 🟠 | **Lazy** (`/entreprise`) |
| `TasksPage` | page Tâches | non listé | 130 kB (30 kB) | **Lazy** |
| `TaskModal` | modal de tâche | non listé | 104 kB (24 kB) | **Lazy** |
| `LandingPage` | shell + aiguillage + parcours perso | 90 kB (24 kB) | 81 kB (21 kB) | **Lazy** (`/`) |
| `EnterpriseTrack` | les 10 sections du parcours entreprise | 51 kB (12 kB) | 44 kB (11 kB) | **Lazy** (à la bascule / `/entreprise-presentation`) |

> 🟠 **Le warning Vite « chunks larger than 400 kB » est actif** (build du 2026-08-24) :
> le chunk `index` est à **470 kB brut / 134 kB gzip**, et `vendor-charts` à 414 kB brut (lazy,
> donc sans effet sur le critical path). La trajectoire du chunk `index` est le seul point qui
> demande une décision : **124 kB (08-14) → 128 kB (08-15) → 134 kB (08-24)**, soit +10 kB gzip
> en dix jours pour un budget de 150 kB. Au rythme actuel, le budget est franchi autour de
> **mi-septembre 2026**. La hausse initiale depuis les 124 kB du 2026-08-14
> **ne vient pas du track entreprise** : vérifié par `grep` sur le chunk construit, aucun de ses
> symboles (`gate-panel`, `pyramid-stage`, `ent-hero-line`) n'y figure — il vit dans
> `LandingPage` et `EnterpriseTrack`, tous deux lazy. Sous le budget gzip (< 150 kB) mais la marge
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

- Chunk `index` : **< 150 kB gzip** (au 2026-08-24 : **134 kB** — **marge : 16 kB**, cf. la
  trajectoire ci-dessus. C'est le poste à surveiller en priorité).

> **Le levier est identifié et mesuré — il n'est PAS appliqué (2026-08-24).**
> Le catalogue de référence `fr` est importé **statiquement** par `src/i18n/catalog.ts` : les
> 19 namespaces, soit **208 ko de JSON brut**, partent dans le chunk `index`. (`en` est déjà
> paresseux via `import.meta.glob` — ce point-là est propre.)
>
> Or la moitié de ce poids n'a rien à faire sur le chemin critique :
> `org.json` **48 ko** (page Entreprise, lazy), `landing.json` **32 ko** (landing, lazy),
> `guide.json` **16 ko** (GuidePage, lazy), `tutorials.json` **8 ko** → **~104 ko de JSON brut**
> chargés sur chaque écran de l'app connectée pour des pages qu'on n'ouvrira peut-être jamais.
>
> ⚠️ **Ne pas le faire naïvement.** L'import statique de `fr` est ce qui rend le repli
> **synchrone** : `t()` ne renvoie jamais de promesse. Rendre ces namespaces paresseux sans
> rendre le montage des pages concernées conscient du chargement produirait un flash de clés
> brutes (`org.project.name` à l'écran) — un bug bien plus visible que 100 ko d'avance.
> Le chantier est donc : catalogue paresseux **par namespace** + attente dans le `Suspense` qui
> enveloppe déjà chaque page lazy. À faire quand la marge de 16 ko sera consommée, avec
> vérification visuelle sur les trois pages concernées.
- Chaque chunk lazy : **< 80 kB gzip**. Exceptions documentées : `vendor-charts` (118 kB),
  `vendor-calendar` (85 kB), `vendor-gsap` (55 kB).
  ⚠️ **`OrganizationPage` est à 61 kB gzip au 2026-08-24** : sous le budget, mais c'est de loin le
  plus gros chunk de page, et il grossit à chaque vague entreprise. Il découle directement de la
  dette « fichiers > 600 LOC » ([`ARCHITECTURE.md`](./ARCHITECTURE.md) §3) : `PyramidTab.tsx`
  pèse à lui seul 1 505 lignes.

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

> **🔴 Tables entreprise : prédicat RLS non indexable** (mesuré le 2026-08-14).
> `team_tasks` / `team_projects` sont filtrées par `can_access_team_project(...)` — une fonction
> appelée par ligne, donc `Seq Scan` obligatoire + CTE récursive à chaque ligne. **≈ 60× le coût
> par ligne** du prédicat de `tasks`. Même classe de bug que celle corrigée par la mig. 085, pas
> encore traitée. Mesures, projections et correctif : [`SCALABILITY.md`](./SCALABILITY.md) §2.

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
