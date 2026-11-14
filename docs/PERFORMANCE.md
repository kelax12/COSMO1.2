# Performance

**Quand lire** : en touchant `vite.config.ts` (`chunkFor`), `index.html`, `src/index.css` (polices), un `import` de dépendance lourde, un chemin de lecture Supabase, `src/pages/landing/**`. **Fait foi** : `scripts/check-bundle-budget.mjs`, `npm run check:bundle`, le code.
Notes /100 : cessées (ADR 0012, [`INDICATEURS.md`](./INDICATEURS.md)). Journaux et récits : [`archive/PERFORMANCE-journal-des-notes-2026-08-24-au-2026-11-06.md`](./archive/PERFORMANCE-journal-des-notes-2026-08-24-au-2026-11-06.md), [`archive/PERFORMANCE-budget-bundle-recits-2026-05-29-au-2026-10-22.md`](./archive/PERFORMANCE-budget-bundle-recits-2026-05-29-au-2026-10-22.md), [`archive/DOC-FRONT-recits-retires-2026-11-13.md`](./archive/DOC-FRONT-recits-retires-2026-11-13.md).

## Chunks

Tailles : `npm run build` puis `npm run check:bundle`, jamais recopiées ici. Ce qui se lit : le **chemin critique** (entrée + tout ce que `dist/index.html` précharge), pas la seule taille de `index`.

| Chunk | Contenu | Chargé |
|---|---|---|
| `index` | code applicatif partagé | toujours |
| `vendor-react` `vendor-router` `vendor-radix` `vendor-supabase` `vendor-sentry` `vendor-animation` `vendor-utils` `vendor-query` | react, react-router, @radix-ui, supabase-js, @sentry/react, framer-motion, date-fns + lucide + clsx/tailwind-merge/cva, @tanstack | toujours |
| `vendor-charts` | recharts + d3 + victory-vendor | lazy (`StatisticsPage`, `DashboardChart`, `GuidePage`) |
| `vendor-calendar` | @fullcalendar/* + `locales-all` | lazy (`/agenda`) |
| `vendor-gsap` | gsap + plugins | lazy (`LandingPage`) |
| `vendor-ogl` | ogl (WebGL) | lazy (fond `LightRays`) |
| catalogues i18n | un chunk par namespace et par langue | lazy avec la page |
| `OrganizationPage` `TasksPage` `TaskModal` `LandingPage` `EnterpriseTrack` | pages et modales | lazy |

- 🔴 Un filtre `manualChunks` / `chunkFor` se termine par `/` : `node_modules/react` sans `/` range `react-day-picker`, `react-redux`… dans `vendor-react`, donc dans le chemin critique. Mesures : [`MIGRATION-REACT19.md`](./MIGRATION-REACT19.md).
- 🔴 Sous Vite 8 (Rolldown), `chunkFor` alimente `build.rolldownOptions.output.codeSplitting.groups`, un groupe par chunk avec priorité (`GROUP_PRIORITY`) ; le retrait des `console.*` passe par `output.minify.compress` (`dropConsole`, `dropDebugger`). Un groupe aspire par défaut les dépendances de ses modules : sans priorités, `clsx` part dans `vendor-charts`, qui devient import statique de l'entrée. Les socles partagés capturent avant les gros chunks lazy.
- ❌ Couper l'aspiration (`includeDependenciesRecursively: false`) : les modules partagés tombent dans des chunks de page qui entrent dans le chemin critique.
- ⚠️ Ouvert : Rolldown sort en petits chunks communs les modules partagés entre l'entrée et les pages lazy (plus de chunks préchargés que sous Rollup). À mesurer par Lighthouse, puis essayer `codeSplitting.experimentalInlineCommonChunks`.

## Règles

- ❌ Importer Recharts, `DashboardChart` ou `StatsShowcase` sans `React.lazy` : le chunk retombe dans le chemin critique (P-2). La landing n'importe pas Recharts ; `StatsShowcase` ne vit que dans `GuidePage`.
- ❌ Importer `gsap` hors de la landing, ou directement depuis `'gsap'` : `@/lib/gsap` (chunk `vendor-gsap`). Ailleurs : Framer Motion ou keyframes CSS.
- ❌ Une dépendance > 50 kB minifiée sans règle `manualChunks` explicite et commentée.
- ✅ `lucide-react` et `date-fns/locale/fr` : imports nominaux ; ❌ `import * as`.
- ✅ Un composant monté globalement dans `App.tsx` qui n'apparaît qu'après un geste : `lazy` + `Suspense`.
- ✅ `toast` par `@/lib/toast` (jamais `sonner` en direct) : c'est ce qui l'a sorti du chemin critique ([`src/lib/CLAUDE.md`](../src/lib/CLAUDE.md)).
- ❌ Une clé React Query distincte pour un FILTRE d'une liste déjà chargée : une clé de plus est une requête de plus (souvent deux, le repository hydrate ensuite). Dériver par `useMemo`. Cas réels : `useActiveOkrs`, `useSharesByTask`.
- ❌ Lire une table puis une seconde par `in(...)` bâti sur le premier résultat : deux allers-retours séquentiels. Avec une clé étrangère, la jointure PostgREST (`select=col, autre_table(*)`) fait les deux en une requête, RLS inchangée.
- ❌ Un prédicat de policy RLS qui appelle une fonction SUR UNE COLONNE (`fn(user_id)`) : appelée par ligne, index inutilisable. Un helper sans argument, périmètre tiré de `auth.uid()` seul, est hissé en InitPlan.
- ❌ Valider un correctif CLIENT sur un compteur agrégé Postgres (`pg_stat_user_tables`, `pg_stat_statements`) : cumul depuis la création, anciens clients mêlés. Ventiler les `edge_logs` par `request.sb.jwt.authorization.payload.session_id`.
- ❌ Conclure d'un total cumulé : seul un delta entre deux instants, au repos, donne un débit.

## Budget de bundle

- ✅ Les plafonds se relisent dans `scripts/check-bundle-budget.mjs` COMMITÉ, jamais dans un fichier qu'on vient d'éditer ni dans ce document. `npm run check:bundle` bloque dans `lint-test-build`, après un build fait avec `VITE_SENTRY_DSN` comme en production.
- ❌ Relever un plafond : le cliquet ne fait que descendre ; une marge se regagne en allégeant la mesure (ADR 0011 : charger à la demande ce qui ne sert pas au premier écran). Les plafonds portent ~5 % de marge sur le mesuré, sur le chemin critique ET l'entrée.
- 🔴 Le build exige `VITE_SENTRY_DSN` : sans elle Vite remplace la variable à la compilation, `if (sentryDsn)` de `main.tsx` devient du code mort et `vendor-sentry` s'effondre ; la garde refuse tout build dont `vendor-sentry` pèse moins de `SENTRY_FLOOR`.
- ⚠️ Un job qui PÈSE un artefact et un job qui l'EXÉCUTE n'ont pas les mêmes besoins : un faux DSN suffit à peser, mais fait initialiser Sentry vers un hôte inexistant et dégrade `best-practices` dans Lighthouse.
- ✅ Lighthouse CI (`lighthouserc.json`, `lighthouserc.mobile.json`, job `lighthouse` de `ci.yml`) : LCP, TBT, CLS, accessibilité, SEO sur les routes prérendues (`/`, `/guide`, `/blog`, `/pour-freelances`). Bloquant sur accessibilité, SEO, CLS ; avertissement sur la performance (varie avec le runner). Routes protégées : Playwright.
- ✅ Outils : `npm run analyze:entry` (qui pèse dans l'entrée), `npm run profile:landing`.

## Images et polices

- ❌ Servir une image sans regarder sa taille d'affichage (facteur 2 = retina ; facteur 15 = oubli).
- ❌ Une `<img>` sans `loading="lazy"` dans un bloc masqué : `display:none` n'empêche PAS le téléchargement (le scanner de préchargement lit le balisage avant le CSS). Les captures de la landing perso vivent dans `#seo-fallback`.
- ⚠️ Deux `@font-face` d'une même famille dont les `unicode-range` se chevauchent (Inter latin et latin-ext sur `U+0152-0153`, « œ ») : la DERNIÈRE déclaration gagne. Le subset le plus large se déclare en PREMIER (ordre de la feuille Google Fonts), sinon un seul « œ » télécharge latin-ext.
- ✅ Polices auto-hébergées (la CSP `font-src 'self'` interdit Google Fonts ; une police non déclarée tombe en repli sans erreur) : Instrument Serif (`public/fonts/`, droit et italique, latin et latin-ext, licence OFL, `src/index.css` § Polices d'affichage) et Geist Mono (variable 100-900). ❌ Les précharger dans `index.html` : elles ne servent qu'au parcours entreprise et aux accueils.
- ⚪️ `og-card.png` n'est pas recompressé : seuls les robots de partage la chargent, l'aperçu est la première impression.
- ✅ Mesure et réencodage : `npm run images:check`, puis `node scripts/optimize-images.mjs`.

## Coût d'une ouverture d'application

Le multiplicateur de charge du produit est le NOMBRE de requêtes REST à froid sur `/dashboard` (parallèles sur HTTP/2), à surveiller avant un pic d'acquisition, bien avant le coût unitaire. Mesure : `edge_logs` de production, une session réelle du bundle courant. Une fenêtre de temps n'est pas un événement : écarter les requêtes qui portent un identifiant précis (fiche ouverte après coup).

- ✅ Domaines payés par tous : tableau de bord (tâches, catégories, listes, agenda, habitudes, OKR, KR), collaboration (amis, profils, demandes, partages), session et abonnement. Entreprise : membres d'une organisation seulement.
- ❌ Redemander sous un autre angle une donnée déjà chargée. Verrous (testés, vus rouges) : `okrs/hooks.test.tsx` (le filtre `completed` se fait en mémoire sur `useOkrs()`), `friends/hooks.test.tsx` (`shared_tasks` : `related` contient `mine`), `organizations/supabase.repository.test.ts` (`getMyOrganizations` par jointure PostgREST sur `organization_members.org_id`).
- ⚪️ Piste ouverte : `friends` puis `profiles?email=in.(…)` (pas de clé étrangère `friends.email` ↔ `profiles.email`, donc pas de jointure), et `friend_requests` en deux requêtes.

### La boîte de réception d'entreprise (mig. `129`)

`get_my_org_inbox()` rend en un objet JSON ce que cinq lectures servaient à chaque ouverture, sur toutes les pages protégées (`Layout` monte `useOrgBadges`) : invitations, avis de retrait, demandes d'adhésion (miennes, reçues en vue admin), notifications, profils des demandeurs. Les hooks gardent nom, signature et forme : des sélecteurs `useMemo` sur une lecture unique.

- 🔴 Aucun paramètre : le périmètre vient de `auth.uid()` seul. Un `p_org` obligerait le client à attendre l'organisation active (délai échangé contre des requêtes).
- 🔴 `SECURITY INVOKER` : les sections qui exigent des privilèges APPELLENT les fonctions `DEFINER` existantes, inchangées ; les autres lisent sous la RLS de l'appelant. Agréger des lectures, jamais des autorisations. Parité à prouver avant application, pour chaque compte, section par section.
- ⚠️ Bornes appliquées PAR organisation (window function), 200 demandes et 50 notifications : globalement, la troisième organisation d'un compte serait tronquée par les deux premières.
- ❌ Une invalidation par section dans `useOrgInboxRealtime` : ces clés ne portent plus de donnée, l'écran cesserait de se rafraîchir en silence. Garde : `organizations/inbox.hooks.test.tsx`.

### La pastille COMPTE (mig. `142`, C-05)

`useOrgBadges` montait `useTeamTasks` (`get_my_team_tasks` + `.limit(1000)`) sur toutes les pages protégées pour peindre un nombre. La section `badge_tasks` du même inbox rend les SEULES lignes utiles : assignations en cours qui ne viennent pas de moi (`kind = 'assigned'`) et noms des tâches visées par mes notifications non lues (`kind = 'notified'`), bornes 200 / 50 par organisation.

- ❌ Faire compter une ligne `notified` : une tâche peut sortir dans les DEUX branches, le client leur retire toute assignation, sinon elle compte deux fois.
- ❌ Passer `lastSeen` au serveur : `localStorage`, par organisation, change à chaque visite (clé de cache mouvante, un horodatage ne sert pas plusieurs organisations). La borne reste côté client.
- ✅ `my_org_badge_tasks()` est `SECURITY DEFINER` pour la seule raison d'appeler `my_team_project_ids` (`EXECUTE` révoqué à `authenticated`, mig. 100/113) ; l'autorisation est celle de `get_my_team_tasks`, reprise mot pour mot.
- ⚠️ En démo la source reste `useTeamTasks` (`localStorage`, gratuit) ; hors démo l'identifiant vaut `undefined` et rien ne part.
- Garde : `src/lib/hooks/org-badges.server-count.test.tsx` (un témoin exige que le compteur TOMBE quand la source serveur est vidée). Trace « avant » : [`SCALABILITY.md`](./SCALABILITY.md).

### Les onglets jamais rechargés

Une SPA ne recharge pas son bundle : un onglet laissé ouvert exécute indéfiniment la version téléchargée. Un gain de performance n'atteint que ceux qui rouvrent l'application, et les plus assidus sont les derniers servis et les plus coûteux (91,5 % du trafic Supabase d'une journée est venu de deux onglets d'avant la suppression des sondes).

- ✅ Valider un correctif client par SESSION (jwt `session_id` dans `edge_logs`), jamais sur un agrégat.
- ✅ `NewVersionBanner` (`App.tsx`) signale à un onglet périmé qu'une version existe.

## Chemins de lecture indexables

La règle courte vit dans [`src/modules/CLAUDE.md`](../src/modules/CLAUDE.md). Plans et projections : [`SCALABILITY.md`](./SCALABILITY.md) §2. Identité : `getSession()`, jamais `getUser()` (`src/lib/auth-user.ts`, un aller-retour GoTrue évité).

```typescript
supabase.from('tasks').select(...)                                    // ❌ Seq Scan global
supabase.rpc('get_my_tasks')                                          // ✅ mig. 085
supabase.rpc('get_my_team_tasks',             { p_org: orgId })       // ✅ mig. 113
supabase.rpc('get_my_team_projects',          { p_org: orgId })       // ✅ mig. 113
supabase.rpc('get_my_team_task_dependencies', { p_org: orgId })       // ✅ mig. 117
```

- ✅ `tasks` : la policy `tasks_select_own_or_shared` (mig. 049) est un `OR` entre une égalité et un `EXISTS` : `idx_tasks_user_id` inutilisable, `Seq Scan` de la table GLOBALE. `get_my_tasks()` (aucun paramètre, périmètre `auth.uid()`) exprime le même ensemble en `UNION` indexable. Vaut pour `getAll`, `getByDate`, `getFiltered`, `getPage`. Exception : `getById`. Isolation : `e2e/rls/get-my-tasks.test.ts`.
- ✅ `task_dependencies` (mig. 132) se lit en direct : sa policy `(SELECT auth.uid()) = user_id` porte sur une colonne dénormalisée (redérivée par trigger), indexable. ❌ La faire déléguer à `tasks` (le `OR` payé par arête, et des arêtes d'un autre compte entreraient dans le graphe d'une tâche partagée).
- ✅ Tables entreprise : les policies `can_access_team_project(...)` (fonction par ligne + CTE récursive `get_subtree`) sont gardées en défense en profondeur ; les lectures passent par les RPC, qui évaluent le sous-arbre UNE fois par organisation. `p_org` est un filtre, pas une portée (un `p_org` étranger rend 0 ligne). 🔴 La mig. 113 s'applique AVANT de déployer le front. Verrou : `src/modules/team-projects/supabase.repository.test.ts`.
- ❌ Une nouvelle table entreprise sur le modèle prédicat-fonction : l'appartenance en jointure indexable dans une RPC, par `my_team_project_ids()`, pas par délégation à `team_tasks` (c'est la délégation qui a fait hériter `team_task_dependencies` du coût, mig. 108 puis 117).
- ✅ `events` (mig. `128`) : `my_managed_user_ids()` sans argument, hissée en InitPlan, remplace `manages_user(user_id)` par ligne.

```sql
-- ❌ dépend de la ligne : rappelée par ligne, index inutilisable
USING ((SELECT auth.uid()) = user_id OR (manages_user(user_id) AND NOT is_private))
-- ✅ indépendante de la ligne : InitPlan, condition d'index
USING ((SELECT auth.uid()) = user_id
       OR (NOT is_private AND user_id = ANY (public.my_managed_user_ids())))
```

- 🔴 Une policy réécrite « pour aller plus vite » se prouve AVANT d'être écrite : parité booléenne sur chaque couple (acteur, cible), puis égalité de l'ensemble visible pour chaque compte. C'est une frontière de sécurité. Garde : `scripts/migration-guards.test.mjs`.
- ⚠️ `manages_user` est redéfinie EN FONCTION de `my_managed_user_ids()` : deux définitions de « qui je gère » divergeraient.
- ✅ Habitudes : `get_my_habits(p_days)` (mig. 119) → [`src/modules/habits/CLAUDE.md`](../src/modules/habits/CLAUDE.md).
- ✅ Collaboration : Realtime, pas sondage (mig. 089) → [`src/modules/CLAUDE.md`](../src/modules/CLAUDE.md) § Synchronisation.
- ⚠️ `get_work_time_stats` garde une sémantique IDENTIQUE à `calculateWorkTimeForPeriod` (dates locales inclusives via `p_tz`) : démo et production affichent la même chose.

## Tâches et agenda : pagination serveur (V14.1, V14.2, PER-01)

`useTasks()` n'est pas paginé : une quarantaine d'écrans calculent dessus (compteurs, smart lists, tri, « Aujourd'hui », statistiques) et des pages rendraient des compteurs faux. Ce qui grossit sans limite, ce sont les tâches TERMINÉES. D'où quatre lectures :

| Lecture | Hook | Rend |
|---|---|---|
| Jeu de travail | `useTasks()` | non terminées + terminées depuis 35 j (`working-set.ts`) |
| Archive « Terminées » | `useTaskArchive(q)` | pages serveur, curseur `created_at` puis `id` décroissants, filtres en SQL |
| Sous-ensemble borné | `useTaskSubset(q)` | fenêtre de `completed_at`, catégorie(s), ids |
| Compte | `useTaskCount(q)` | `HEAD` compté par PostgREST, aucune ligne transférée |

- ✅ Contrat commun aux deux repositories : `TaskQuery` et `matchesTaskQuery` (`src/modules/tasks/task-query.ts`), joué par `src/test/contracts/__test__/tasks.contract.ts`. Témoin : `src/modules/tasks/pagination-6000.test.ts` (toutes accessibles ; `fetchAllPages` s'arrêterait à `MAX_ROWS`).
- ✅ Écrans convertis : vue « Terminées » (`useTaskArchive` + compte), « Voir les N terminées » (`useTaskCount`), statistiques glissantes ≤ 365 j (`useTaskSubset`), graphiques du tableau de bord (`useChartCompletedTasks`, 190 j), impact de suppression de catégorie (toute la branche relue), export CSV art. 20 (`getAll()` sans plafond au clic), accueil « compte vide » (`useTaskCount({})`), palette ⌘K (jeu de travail + recherche serveur dans l'archive), fiche ouverte hors jeu (`useKnownTask`), dépendances et coche de l'agenda (relues par id), `usePendingTasks` (dérivé du jeu de travail).
- ✅ Restent sur le jeu de travail : tout ce qui ne lit que les non terminées, et ce qui regarde moins de 35 jours.
- ✅ Agenda : `getWindow` (plage visible + un mois, tous les récurrents), fenêtre SANS plafond, bornes comparées en instants (démo et SQL, `window.ts`) ; la barre de tâches lit `getLinkedToTasks`, pas `useEvents()`.
- ✅ Toute mise à jour optimiste passe par `patchTaskCaches` (`cache-patch.ts`) ; aucune migration (tout passe par `get_my_tasks()` filtrée par PostgREST).
- ✅ `fetchAllPages` (plafond `MAX_ROWS`) ne sert plus qu'à des lectures bornées par nature, toutes par `warnIfTruncated` (Sentry `pagination truncated: <table>` + un toast par session) : `habits` `getAll` (une ligne par habitude ; historique dans `habit_completions`, mig. `248`), `okrs` et `team-okrs` `getAll`, `events` `getAll` (huit écrans dont la palette : une fenêtre changerait ce qu'elle trouve).
- ✅ Sans plafond : `kr-completions` `getSince` (fenêtre `KR_COMPLETIONS_WINDOW_DAYS`, pages de clé `(completed_at, id)`, curseur validé avant interpolation), `getFiltered` et `getAllForExport` (tout) ; `events` `getAllForExport`, `getWindow`, `getWindowForUser`, `getLinkedToTasks` (`UNCAPPED`, pages par décalage car la fenêtre occupe le `.or()`).
- ✅ Les `getAll()` à faible volume (categories, lists, friends) gardent `.limit(200)`.
- ❌ Un `.limit(500)` sec ou un plafond sur une lecture de tâches. ❌ Compter, chercher ou calculer sur `useTasks()` comme sur l'historique.
- ✅ Une nouvelle lecture volumineuse : une page (`getPage`), un sous-ensemble borné (`fetchAllByCursor`) ou un compte serveur, jamais `fetchAllPages`.

## Shader du hero ENTREPRISE (C-68)

Une file GPU qui sature bloque le fil principal (`CommandBufferProxyImpl::WaitForGetOffset`) sans exécuter de JavaScript : couper flous, `ScrollTrigger` et tweens ne déplace pas la mesure.

- 🔴 `LightRays` se règle seul et ne redevient JAMAIS fixe : il mesure sa cadence et le temps passé dans `render`, descend d'un palier tant que ça ne tient pas (demi-résolution au départ, puis un huitième des pixels, puis 20 img/s, puis gel). Les rayons restent visibles : le mouvement se retire, jamais l'image.
- ❌ Remplacer cela par une détection de rastériseur logiciel (`SwiftShader`, `llvmpipe`) : la sonde verdit, un téléphone d'entrée de gamme (GPU réel) sature quand même.
- ❌ Faire repartir l'échelle de la pleine résolution : la descente coûte, résidu stable mesuré, dans les premières secondes (le seul moment où quelqu'un regarde).
- ⚠️ Une file qui sature a deux états, pas un coût progressif : la mesure est BIMODALE. Lire passe par passe, jamais en médiane.

## Hero perso centré

- ✅ Tuile produit `HeroAppIcon` (96 px) tournant sur quatre modules au-dessus du H1 ; quatre puces `HeroModuleDock` dans les marges, reliées par `.hero-link`. Les modules sont décrits UNE fois (`hero-modules.ts`).
- ❌ `AppWindowShowcase` dans le hero (540 px repoussent la promesse sous la flottaison) : les vitrines sont montrées dès `FeaturesSection`.
- ⚠️ Deux dispositions, UN seul jeu de puces, basculé par des classes `xl:` (deux jeux : doublon annoncé, ou `aria-hidden` sur la seule liste libellée).
- 🔴 `LandingSkeleton` (`App.tsx`) DÉCALQUE ce hero : un squelette qui annonce autre chose fabrique le saut qu'il doit éviter.
- 🔴 Tailles du H1 perso ARBITRAIRES (`text-[4.25rem]`), jamais nommées : `text-6xl` pose aussi un `line-height`, et sa variante responsive est émise APRÈS `leading-[…]` (la dernière gagne), sans erreur. Même piège sur le sous-titre (`sm:text-lg`).
- ⚠️ Alphas des aurores calés pour un titre à dégradé bleu → fuchsia : un fond teinté des couleurs du texte lui retire ce qu'il donne au fond. Si le fond commence à se voir, il est déjà trop fort.
