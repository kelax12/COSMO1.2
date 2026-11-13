# Performance bundle — `vite.config.ts manualChunks`

## Historique des notes et des audits : archivé

Les notes /100 de ce document ont cessé (ADR 0012, [`INDICATEURS.md`](./INDICATEURS.md)). Leur journal daté, les angles morts mesurés et les récits d'incident qui fondent les règles ci-dessous sont déplacés, sans coupe, dans [`archive/PERFORMANCE-journal-des-notes-2026-08-24-au-2026-11-06.md`](./archive/PERFORMANCE-journal-des-notes-2026-08-24-au-2026-11-06.md). Une règle de ce document qui cite une date ou un incident s'y retrouve.

## Vendor chunks isolés (commenter toute modif)

🔴 **2026-10-23 · un filtre `manualChunks` se termine par `/`.** `id.includes('node_modules/react')`
rangeait aussi `react-day-picker`, `react-redux`, `react-remove-scroll`… dans `vendor-react`, donc
dans le chemin critique. Corrigé à la migration React 19 : chemin critique 328,8 → 302,6 ko gzip,
`vendor-react` 69,2 ko. Mesures : [`MIGRATION-REACT19.md`](./MIGRATION-REACT19.md) §0.

Tailles par chunk, chemin critique et trajectoire du chunk d'entrée (relevés des 2026-08-24 et 2026-08-25) : archive. Les chiffres
courants se mesurent par `npm run check:bundle`. Le chemin critique est l'entrée PLUS tout ce que `dist/index.html` précharge : c'est ce
chiffre qu'il faut regarder, pas la seule taille de `index`.

| Chunk | Contenu | Quand chargé |
|---|---|---|
| `index` (app) | code applicatif partagé | Toujours |
| `vendor-react` | react + react-dom + scheduler | Toujours |
| `vendor-router` | react-router | Toujours (split pour parallel HTTP/2) |
| `vendor-radix` | @radix-ui/* | Toujours |
| `vendor-supabase` | @supabase/supabase-js | Toujours (extrait pour cache CDN) |
| `vendor-sentry` | @sentry/react | Toujours (extrait pour cache CDN) |
| `vendor-animation` | framer-motion | Toujours |
| `vendor-utils` | date-fns + lucide-react + clsx / tailwind-merge / cva | Toujours |
| `vendor-query` | @tanstack/* | Toujours |
| `vendor-charts` | recharts + d3-* + victory-vendor | **Lazy** (StatisticsPage, DashboardChart, GuidePage) ; la landing n'importe pas Recharts |
| catalogues i18n | un chunk par namespace et par langue | **Lazy**, avec la page qui les utilise |
| `vendor-calendar` | @fullcalendar/* + `locales-all` | **Lazy** (`/agenda` uniquement) |
| `vendor-gsap` | gsap + plugins (+ `InertiaPlugin`) | **Lazy** (LandingPage uniquement) |
| `vendor-ogl` | ogl, micro-runtime WebGL | **Lazy** (fond `LightRays` du hero entreprise) |
| `OrganizationPage` | tout le mode entreprise | **Lazy** (`/entreprise`) |
| `TasksPage`, `TaskModal` | page et modal de tâche | **Lazy** |
| `LandingPage` | shell + aiguillage + parcours perso | **Lazy** (`/`) |
| `EnterpriseTrack` | les 10 sections du parcours entreprise | **Lazy** (à la bascule / `/entreprise-presentation`) |

## Images et polices

Les images et les polices pèsent autant que le JavaScript : les mesurer (récit du 2026-08-25, chiffres avant / après : archive).
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

### Polices auto-hébergées

`font-display` (Instrument Serif, 4 fichiers dans `public/fonts/`, licence OFL) et `font-data` (Geist Mono) se déclarent dans
`src/index.css` § Polices d'affichage : sans `@font-face`, la CSP (`font-src 'self'`) les fait retomber en silence sur le repli.
- ✅ Le sous-ensemble `latin-ext` n'est PAS téléchargé : même ordre de déclaration qu'Inter (latin en dernier).
- ❌ **Pas de préchargement dans `index.html`** : la police ne sert qu'au parcours entreprise et aux deux accueils.
Réencodage reproductible : `npm run images:check` (mesure) puis
`node scripts/optimize-images.mjs`.

## Règles non négociables

- ❌ **Ne jamais importer Recharts ou un composant qui l'utilise (DashboardChart/StatsShowcase) sans `React.lazy`** — sinon il retombe dans le chunk du caller et pollue le critical path. Faille P-2.
- ⚠️ **GSAP : réintroduit en 2026-07, landing page uniquement.** L'ancienne règle « ne jamais réintroduire GSAP » (finding P-1, 2026-05) **ne s'applique plus** : la lib est de retour derrière le point d'entrée unique `src/lib/gsap.ts`, isolée dans le chunk `vendor-gsap` que seule la `LandingPage` (lazy) charge. Contrainte maintenue : **aucun import GSAP hors landing**, et jamais `import { gsap } from 'gsap'` en direct.
- ❌ **Toute nouvelle dep > 50 kB minified doit être ajoutée à `manualChunks`** avec une règle explicite et commentée.
- ✅ `lucide-react` : imports nominaux uniquement (`import { Icon } from 'lucide-react'`). Jamais `import * as`.
- ✅ `date-fns/locale/fr` : import nominal. Jamais `import * as locales`.
- ✅ Tout composant globalement monté dans App.tsx (CommandPalette, etc.) qui n'apparaît qu'après un geste utilisateur → **lazy avec Suspense**.

## Budget bundle

- **Les plafonds se relisent dans le fichier commité** : `scripts/check-bundle-budget.mjs` fait foi, pas ce document. `npm run check:bundle` bloque dans `lint-test-build`, juste après un build fait avec `VITE_SENTRY_DSN` comme en production (un build sans Sentry pèse environ 45 ko de moins que ce qui part).
- **Le cliquet ne fait que descendre.** Relever un plafond exige un arbitrage écrit d'Axel, commenté dans le script, et jamais pour faire passer la CI : une marge se regagne en allégeant la mesure (ADR 0011 : charger à la demande ce qui ne sert pas au premier écran).
- **`toast` passe par la façade `@/lib/toast`** (jamais `sonner` en import direct) : c'est ce qui l'a sorti du chemin critique. La landing n'importe pas Recharts ; `vendor-charts` est un chunk paresseux.
- **Lighthouse CI** (`lighthouserc.json`, job `lighthouse` de `ci.yml`) mesure LCP, TBT, CLS, accessibilité et SEO sur les routes prérendues (`/`, `/guide`, `/blog`, `/pour-freelances`). Bloquant sur accessibilité, SEO et CLS ; avertissement sur la performance, qui varie avec le runner. Les routes protégées demandent une session : Playwright, pas Lighthouse.
- Les chiffres (taille du chunk d'entrée, du chemin critique) se mesurent par `npm run check:bundle`.

Les récits datés (les plafonds posés et abaissés du 2026-08-26 au 2026-10-22, les chunks ramenés sous le plafond, le levier `sonner` du 2026-09-11) et les résiduels de l'audit du 2026-05-29 sont dans [`archive/PERFORMANCE-budget-bundle-recits-2026-05-29-au-2026-10-22.md`](./archive/PERFORMANCE-budget-bundle-recits-2026-05-29-au-2026-10-22.md).

### Découpage sous Vite 8 (Rolldown) : groupes priorisés

`manualChunks` est déprécié sous Rolldown. La fonction `chunkFor` de `vite.config.ts` alimente
`build.rolldownOptions.output.codeSplitting.groups` : un groupe par chunk nommé, avec une priorité
(`GROUP_PRIORITY`). Le retrait des `console.*` passe par `output.minify.compress` (`dropConsole`,
`dropDebugger`), Oxc ne reprenant pas `esbuild.pure`.

- 🔴 Un groupe Rolldown aspire par défaut les dépendances de ses modules. Sans priorités, `clsx`
  (partagé par `cn()` et recharts) part dans `vendor-charts`, qui devient un import statique de
  l'entrée : chemin critique mesuré à 511,5 ko au passage à Vite 8 (V18.2), contre 314,3 ko avec
  les priorités. Les socles partagés capturent donc avant les gros chunks lazy.
- ❌ Ne pas couper l'aspiration (`includeDependenciesRecursively: false`) : les modules partagés
  tombent alors dans des chunks de page (`LandingPage`, `OrganizationPage`) qui entrent dans le
  chemin critique (515,7 ko mesurés).
- ⚠️ Suite ouverte : le chemin critique compte 43 chunks (8 sous Rollup). Rolldown sort en petits
  chunks communs les modules partagés entre l'entrée et les pages lazy. À mesurer en conditions
  réelles (Lighthouse), puis essayer `codeSplitting.experimentalInlineCommonChunks`.

## Ce que coûte une ouverture d'application

**21 requêtes REST au chargement à froid** sur `/dashboard` (mesure du 2026-08-27 sur les `edge_logs`, 29 avant ; mode entreprise : 4,
payées par les seuls membres d'une organisation). **C'est le multiplicateur de charge du produit** : 100 arrivées simultanées valent
2 100 requêtes. Ce nombre se surveille avant un pic d'acquisition, bien avant le coût unitaire de chacune. Une fenêtre de temps n'est
pas un événement : ne compter que les requêtes du chargement. Récit des quatre premières requêtes retirées : archive.

### La boîte de réception d'entreprise : 5 requêtes en 1 (mig. `129`)

Le palier suivant, et le plus gros. Cinq lectures partaient à chaque ouverture,
sur **toutes** les pages protégées, parce que `Layout` monte `useOrgBadges` pour peindre une
pastille de notification :

| Ce qui partait | Ce que ça servait à afficher |
|---|---|
| `rpc/get_my_org_invitations` | la boîte de réception |
| `rpc/get_my_org_removal_notices` | la boîte de réception |
| `organization_join_requests?user_id=eq.moi` | ma demande d'adhésion en attente |
| `organization_join_requests?org_id=eq.X` | les demandes reçues, vue admin |
| `org_notifications?org_id=eq.X` | la pastille |
| `profiles?id=in.(…)` *(conditionnelle)* | nommer les demandeurs |

`get_my_org_inbox()` les rend ensemble, en un objet JSON. Les cinq hooks gardent leur nom, leur
signature et leur forme de retour : ils deviennent des sélecteurs `useMemo` sur une lecture unique.
Aucun écran n'a changé.

**Deux décisions de conception valent d'être retenues.**

**1. Aucun paramètre, et c'est le point.** Le périmètre vient de `auth.uid()` seul, comme
`get_my_tasks` (mig. 085). Prendre un `p_org` aurait obligé le client à attendre que
l'organisation active soit résolue avant de partir : on aurait échangé quatre requêtes contre du
**délai**, en sérialisant ce qui partait en parallèle. La fonction rend donc les sections par
organisation pour toutes mes organisations, et le client filtre.

**2. `SECURITY INVOKER`, volontairement.** 🔴 Agréger cinq lectures dans une fonction
`SECURITY DEFINER` reviendrait à réécrire cinq autorisations à la main, dans une fonction qui
contourne la RLS. C'est exactement là qu'une agrégation « de performance » devient une fuite. Ici,
les deux sections qui ont besoin de privilèges élevés ne sont pas réécrites, elles **appellent les
fonctions `DEFINER` existantes**, inchangées ; les trois autres lisent leurs tables en direct, donc
sous la RLS de l'appelant. La fonction n'ouvre **aucun accès nouveau**, et si une policy change
demain, elle suit.


⚠️ Les bornes sont appliquées **par organisation** (window function), pas globalement : 200
demandes, 50 notifications. Sans cela, un compte membre de trois organisations verrait la
troisième tronquée par les deux premières, et ça ne se serait vu que chez lui.

❌ Ne pas réintroduire une invalidation par section dans `useOrgInboxRealtime` : ces clés ne
portent plus de donnée, l'écran cesserait de se rafraîchir **en silence**. Garde :
`organizations/inbox.hooks.test.tsx`, vue rouge avant d'être committée.


#### La pastille COMPTE, elle ne lit pas la liste (mig. `142`, finding C-05)


La même boîte de réception porte depuis le 2026-09-05 une section `badge_tasks`. `useOrgBadges`
montait `useTeamTasks`, donc `get_my_team_tasks` + `.limit(1000)`, la lecture la plus chère du
produit, sur **toutes les pages protégées**, pour peindre un nombre. Le rechargement avait été
coupé le 2026-08-27 (`background`), la **lecture** pas.

- Le serveur rend les **seules** lignes utiles : assignations en cours qui ne viennent pas de moi
  (`kind = 'assigned'`), et noms des tâches visées par mes notifications non lues
  (`kind = 'notified'`). Bornes : 200 et 50 **par organisation**, jamais globalement.
- ❌ **Ne jamais faire compter une ligne `notified`.** Une tâche peut sortir dans les DEUX branches ;
  le client leur retire toute assignation pour cette raison précise. Sans ça, elle compte deux fois
  et le nombre affiché change.
- ❌ **Ne jamais passer `lastSeen` au serveur.** Il vit dans `localStorage`, il est **par
  organisation**, et il change à chaque visite de /entreprise : en paramètre, il ferait dépendre la
  clé de cache d'une valeur mouvante, et un seul horodatage ne pourrait pas servir plusieurs
  organisations. La borne reste côté client, sur un ensemble déjà réduit.
- ✅ `my_org_badge_tasks()` est `SECURITY DEFINER` pour la SEULE raison qui vaut ici : appeler
  `my_team_project_ids`, dont `EXECUTE` est révoqué à `authenticated` (mig. 100/113). L'autorisation
  est celle de `get_my_team_tasks`, reprise mot pour mot. La RPC d'agrégat, elle, reste
  `SECURITY INVOKER` : agréger des lectures, oui ; agréger des autorisations, jamais.
- ⚠️ En **démo** la source reste `useTeamTasks` : c'est du `localStorage`, donc gratuit, et écrire
  une seconde dérivation de « nouvelle assignation » dans le repository local aurait fait deux
  définitions du même chiffre. Hors démo l'identifiant vaut `undefined` et rien ne part.
- Gardes : `src/lib/hooks/org-badges.server-count.test.tsx` (dont un témoin qui exige que le
  compteur TOMBE quand la source serveur est vidée : sans lui, le fichier passerait encore si plus
  aucune source n'alimentait rien).

### 🔴 Le correctif que personne ne reçoit : les onglets jamais rechargés

**91,5 % du trafic Supabase du 2026-08-26 est venu de DEUX onglets** qui exécutaient encore l'ancien bundle (ventilation : archive).
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

### Tâches et agenda : pagination serveur (V14.1 et V14.2, constat PER-01, 2026-11-09)

L'audit externe du 2026-11-06 relevait : « listes chargées en entier côté client, tronquées à
5 000 lignes ». `useTasks()` lisait tout le compte par `fetchAllPages` ; au-delà de `MAX_ROWS`,
des tâches manquaient à l'écran, signalées par un toast et rien d'autre.

**Ce qui a changé, et pourquoi pas « paginer `useTasks()` ».** Une quarantaine d'écrans
calculaient sur `useTasks()` (compteurs par chip, smart lists, tri, « Aujourd'hui »,
statistiques). Les couper en pages aurait rendu des compteurs faux. Ce qui grossit sans limite,
ce sont les tâches **terminées** ; le travail en cours reste borné. D'où trois lectures :

| Lecture | Hook | Ce qu'elle rend | Plafond |
|---|---|---|---|
| Jeu de travail | `useTasks()` | toutes les non terminées + terminées depuis 35 j (`working-set.ts`) | aucun |
| Archive « Terminées » | `useTaskArchive(q)` | pages serveur, curseur de clé `created_at` puis `id` décroissants, filtres en SQL | aucun (pages) |
| Sous-ensemble borné | `useTaskSubset(q)` | fenêtre de `completed_at`, catégorie(s), ids | aucun |
| Compte | `useTaskCount(q)` | `HEAD` compté par PostgREST, aucune ligne transférée | sans objet |

Contrat commun aux deux repositories : `TaskQuery` et `matchesTaskQuery`
(`src/modules/tasks/task-query.ts`), joué en démo et sur la base locale par
`src/test/contracts/__test__/tasks.contract.ts` (pages stables, tâche créée entre deux pages,
compte, fenêtre de complétion). Témoin : `src/modules/tasks/pagination-6000.test.ts`
(6 000 tâches, toutes accessibles ; la même source lue par `fetchAllPages` s'arrête à 5 000).

Les écrans qui dépendaient du « tout en mémoire » (vue « Terminées », statistiques, graphiques, export CSV, palette ⌘K, fiche ouverte,
dépendances, agenda) passent par `useTaskArchive`, `useTaskSubset`, `useTaskCount`, `useKnownTask` ou `useChartCompletedTasks` ; le détail
écran par écran est en archive.

Restent sur le jeu de travail, et c'est suffisant : tout ce qui ne lit que les non terminées
(barre d'onglets, rappel d'échéances, Aujourd'hui, listes, barre de tâches de l'agenda, OKR,
ajout à une liste) et ce qui regarde moins de 35 jours en arrière (insights des statistiques,
bilan de la semaine, colonne « Terminé » du Tableau, 7 jours).

**Agenda (V14.2).** Les événements se lisent déjà par fenêtre (`getWindow`, plage visible plus un
mois de marge, tous les récurrents). Depuis la V14.2 : fenêtre **sans plafond**, bornes comparées
en **instants** côté démo comme en SQL (`window.ts`), et la barre de tâches lit les seuls
événements liés à une tâche (`getLinkedToTasks`) au lieu de `useEvents()` complet.

Mutations : toute mise à jour optimiste passe par `patchTaskCaches`
(`src/modules/tasks/cache-patch.ts`), qui l'applique à TOUS les caches de tâches et retire d'un
cache filtré ce qui ne répond plus à sa requête. Aucune migration : tout passe par
`get_my_tasks()` existante, filtrée par PostgREST.

### Lectures complètes restantes

`fetchAllPages` (plafond `MAX_ROWS` = 5 000) ne sert plus qu'à ces lectures, chacune pour une
raison écrite. Toutes passent par `warnIfTruncated` : plafond atteint, un message Sentry
(`pagination truncated: <table>`) et un toast une fois par session, jamais une liste amputée
présentée comme complète.

- `habits` `getAll` : par compte, une ligne par habitude (dizaines) ; l'historique vit dans
  `habit_completions` (mig. `248`), fenêtré par `get_my_habits(p_days)`.
- `okrs` `getAll`, `team-okrs` : quelques dizaines d'objectifs par compte ou par organisation.
- `events` `getAll` (`useEvents()`) : tableau de bord, statistiques, palette. Huit écrans, dont la
  palette qui cherche dans tout l'historique : une fenêtre changerait ce qu'elle trouve. Suite à
  donner écran par écran.

Bornées sans plafond (PER-01) :

- `kr-completions` : les écrans lisent `getSince` (fenêtre de `KR_COMPLETIONS_WINDOW_DAYS` = 400
  jours, l'écran le plus long étant /statistics sur 365) ; `getFiltered` (le journal d'un OKR,
  capturé avant suppression pour « Annuler ») et `getAllForExport` lisent tout. Pages de clé
  `(completed_at, id)`, curseur validé avant interpolation.
- `events` `getAllForExport` : l'export CSV relit tout au clic par les pages de clé de `getPage`.
- `events` `getWindow`, `getWindowForUser`, `getLinkedToTasks` : `fetchAllPages` **sans plafond**
  (`UNCAPPED`), pages par décalage parce que le filtre de fenêtre occupe déjà le `.or()`.

- Les `getAll()` à faible volume (categories, lists, friends) gardent `.limit(200)`.
- ❌ Ne pas réintroduire un `.limit(500)` sec, ni un plafond, sur une lecture de tâches.
- ❌ Ne jamais compter, chercher ou calculer une statistique sur `useTasks()` en la prenant pour
  l'historique complet : c'est le jeu de travail.
- ✅ Une nouvelle lecture volumineuse passe par une page (`getPage`), un sous-ensemble borné
  (`fetchAllByCursor`) ou un compte serveur, jamais par `fetchAllPages`.

## Ne jamais faire — Performance

- ❌ Créer une clé React Query distincte pour un **filtre** d'une liste déjà chargée. Une clé de plus est une requête de plus, et sur Supabase le repository enchaîne souvent une seconde lecture pour hydrater ce qu'il vient de lire : deux requêtes pour un `filter()`. Dériver avec `useMemo` depuis le hook de base. Cas réels : `useActiveOkrs` (2 requêtes par ouverture, pour tester `length > 0`) et `useSharesByTask` (un sous-ensemble strict d'une lecture déjà faite).
- ❌ Lire une table, **puis** une seconde avec un `in(...)` bâti sur le premier résultat. Ce sont deux allers-retours séquentiels, le second ne pouvant pas partir avant le retour du premier. Quand une clé étrangère existe, la jointure PostgREST (`select=col, autre_table(*)`) fait les deux en une requête, sans changer la RLS : la ligne jointe reste filtrée par sa propre policy.
- ❌ Écrire un prédicat de policy RLS qui appelle une fonction **sur une colonne** (`fn(user_id)`). Il est rappelé pour chaque ligne examinée et rend l'index inutilisable. Un helper sans argument, dont le périmètre vient de `auth.uid()` seul, est hissé en InitPlan et évalué une fois par requête. Trois occurrences déjà : `tasks` (085), `team_tasks` (113, 117), `events` (128).
- ❌ **Valider un correctif de performance CLIENT sur un compteur agrégé de Postgres** (`pg_stat_user_tables`, `pg_stat_statements`). Ils cumulent depuis la création de la base et mélangent les anciens et les nouveaux clients : ils donneront tort au correctif pendant des jours. Ventiler les `edge_logs` par `request.sb.jwt.authorization.payload.session_id`, une seule session du bundle courant suffit à trancher.
- ❌ Conclure quoi que ce soit d'un total cumulé. Seul un **delta entre deux instants**, mesuré au repos, donne un débit. `organization_members` affichait 2 440 047 balayages pour 11 lignes et n'en prenait **aucun** sur une fenêtre de 285 s au repos.

## Optimisations de l'audit technique du 2026-07-15 : archivées

Agrégats de statistiques en SQL (RPC `get_work_time_stats`), `staleTime` différencié, préchargement au survol, Brotli et polices : le détail est dans [`archive/PERFORMANCE-budget-bundle-recits-2026-05-29-au-2026-10-22.md`](./archive/PERFORMANCE-budget-bundle-recits-2026-05-29-au-2026-10-22.md).

⚠️ **Règle qui reste vivante** : la sémantique de la RPC `get_work_time_stats` doit rester **identique** à `calculateWorkTimeForPeriod` (dates locales inclusives via `p_tz`), pour que les modes démo et production affichent la même chose.

## Chemins de lecture indexables · repris de `CLAUDE.md` (déplacé le 2026-09-16)

> Déplacé de `CLAUDE.md`. La règle courte vit dans [`src/modules/CLAUDE.md`](../src/modules/CLAUDE.md).

## ⚡ Lecture des tâches — passer par `get_my_tasks()`

**Ne jamais lire `tasks` en direct pour une vue de liste.** La policy
`tasks_select_own_or_shared` (mig. 049) est un `OR` entre une égalité et un `EXISTS` : Postgres
ne peut pas utiliser `idx_tasks_user_id` et fait un **`Seq Scan` de la table globale** (vérifié
par `EXPLAIN` en prod le 2026-08-07). Le coût d'une lecture croît alors avec le volume de TOUTE
la plateforme, pas avec celui de l'utilisateur.

```typescript
supabase.from('tasks').select(...)          // ❌ Seq Scan global
supabase.rpc('get_my_tasks').select(...)    // ✅ Index Scan (mig. 085)
```

`get_my_tasks()` ne prend **aucun paramètre** : son périmètre vient de `auth.uid()` seul. Les
policies RLS restent en place (défense en profondeur) ; l'isolation est prouvée par
`e2e/rls/get-my-tasks.test.ts`. Exception légitime : `getById` (accès par clé primaire).

> ⚠️ **`task_dependencies` (mig. 132) se lit en direct, et c'est voulu.** Sa policy est
> `(SELECT auth.uid()) = user_id`, pas un `EXISTS` sur `tasks` : le périmètre est porté par une
> colonne dénormalisée (redérivée par trigger, jamais envoyée par le client), donc indexable dès
> le premier jour. Déléguer à `tasks` aurait payé le `OR` ci-dessus **par arête** — l'erreur que
> la mig. 117 a dû rattraper côté entreprise. Second motif, suffisant à lui seul : une tâche
> personnelle peut être **partagée**, et déléguer à « les tâches que je vois » ferait entrer dans
> le graphe des arêtes entre deux tâches d'un autre compte. Le graphe personnel est celui de son
> propriétaire ; la version partagée du graphe, c'est le mode entreprise.

### ⚡ Tables entreprise — même règle, même correctif (mig. 113)

`team_tasks` et `team_projects` avaient exactement le même défaut : les policies les filtrent par
`USING (can_access_team_project(...))`, un prédicat-fonction sur une colonne, qui **ne peut pas
utiliser d'index** — donc `Seq Scan` de toute la table et une CTE récursive (`get_subtree`)
évaluée **par ligne**. Mesuré en prod le 2026-08-14 : **≈ 60× le coût par ligne** du prédicat de
`tasks`.

```typescript
supabase.from('team_tasks').select(...)                                // ❌ Seq Scan + CTE par ligne
supabase.rpc('get_my_team_tasks',             { p_org: orgId })        // ✅ mig. 113
supabase.rpc('get_my_team_projects',          { p_org: orgId })        // ✅ mig. 113
supabase.rpc('get_my_team_task_dependencies', { p_org: orgId })        // ✅ mig. 117
```

- Le périmètre vient de `auth.uid()` seul : **`p_org` est un filtre, pas une portée.** Forger un
  `p_org` étranger renvoie 0 ligne (les trois branches exigent l'appartenance de l'appelant).
- Le gain tient en une phrase : `get_subtree()` est appelée **une fois par organisation** au lieu
  d'une fois par ligne lue.
- Les policies restent en place, inchangées (défense en profondeur). Le déploiement est donc
  réversible sans downtime — mais la **mig. 113 doit être appliquée AVANT** de déployer le front,
  sinon la RPC n'existe pas. **Appliquée en prod le 2026-08-24**, avant que `main` (qui appelle
  déjà ces RPC) ne soit déployé sur Vercel.
- Le chemin d'accès est verrouillé par test (`src/modules/team-projects/supabase.repository.test.ts`) :
  un retour à `.from('team_tasks')` échoue en CI.

> ⚠️ **Ne pas ajouter de nouvelle table entreprise sur le modèle prédicat-fonction.** Exprimer
> l'appartenance en **jointure indexable** dans une RPC, en réutilisant `my_team_project_ids()`
> plutôt qu'en déléguant à `team_tasks` : c'est la délégation qui a fait hériter
> `team_task_dependencies` du coût qu'on venait d'éliminer (mig. 108, refermé par la mig. 117).
> Détail et projections : [`SCALABILITY.md`](./SCALABILITY.md) §2.

### ⚡ `events` : un ensemble calculé une fois, jamais une fonction par ligne (mig. 128)

Troisième occurrence de la même classe, la première hors du mode entreprise. La policy de lecture
d'`events` appelait `manages_user(user_id)`, donc une fonction **sur une colonne**, donc un appel
par ligne examinée, chacun joignant deux fois `organization_members` puis évaluant `get_subtree`.

```sql
-- ❌ dépend de la ligne : rappelée pour chaque ligne, index inutilisable
USING ((SELECT auth.uid()) = user_id OR (manages_user(user_id) AND NOT is_private))
-- ✅ ne dépend PAS de la ligne : hissée en InitPlan, et devient condition d'index
USING ((SELECT auth.uid()) = user_id
       OR (NOT is_private AND user_id = ANY (public.my_managed_user_ids())))
```

Mesuré en prod le 2026-08-26, lecture de l'agenda d'un membre non géré : **17,19 ms → 0,61 ms**,
et zéro ligne remontée du tas pour être rejetée ensuite (`Rows Removed by Filter: 128` → BitmapOr
de deux Index Scan). Lire son propre agenda ne changeait rien et ne change rien : la branche
« own » court-circuitait déjà le `OR`.

- ❌ **Ne jamais faire dépendre un prédicat de policy d'un argument pris dans la ligne.** La règle
  couvre `tasks` (085), `team_tasks` / `team_projects` (113), `team_task_dependencies` (117) et
  maintenant `events` (128). Un helper sans argument, dont le périmètre vient de `auth.uid()`
  seul, est évalué une fois par requête, exactement comme `(SELECT auth.uid())` depuis la 043.
- 🔴 **Une policy réécrite « pour aller plus vite » se prouve AVANT d'être écrite.** Pour la 128 :
  parité booléenne sur chaque couple (acteur, cible) de `organization_members`, puis égalité de
  l'ensemble des `events.id` visibles pour **chaque** compte de `auth.users`. C'est une frontière
  de sécurité, pas un plan d'exécution.
- ⚠️ `manages_user` survit, redéfinie **en fonction** de `my_managed_user_ids()` : deux
  définitions concurrentes de « qui je gère » finiraient par diverger.
- Garde : `scripts/migration-guards.test.mjs`, vue rouge sur la régression avant d'être committée.


---

## Budget de bundle · repris de `CLAUDE.md` (déplacé le 2026-09-16)

```bash
npm run check:bundle        # Budget de bundle sur le build réel (CI, après npm run build)
```

- Les plafonds se relisent dans le fichier **commité** (`scripts/check-bundle-budget.mjs`), jamais dans l'arbre qu'on vient d'éditer.
  ❌ Ne jamais remonter un plafond.
- 🔴 **Exige `VITE_SENTRY_DSN` au build** : sans elle, Vite rend la branche `if (sentryDsn)` morte et jette presque tout `@sentry/react`
  (~45 ko de moins), la garde sous-estimerait le chemin critique. Elle refuse un build dont `vendor-sentry` pèse moins de 20 ko (`SENTRY_FLOOR`).
- ⚠️ Un job qui PESE un artefact et un job qui l'EXÉCUTE n'ont pas les mêmes besoins : un faux DSN suffit à peser, mais fait
  s'initialiser Sentry pour de bon (`best-practices` de 100 à 96 dans Lighthouse).

---

## Shader du hero ENTREPRISE (C-68) — une file GPU qui sature bloque le fil principal

> Descendu de [`src/pages/landing/CLAUDE.md`](../src/pages/landing/CLAUDE.md) le 2026-09-22,
> **sans une coupe** : le fichier de dossier avait depasse son plafond, et ce recit est
> une mesure de performance avant d'etre une regle de landing.

🔴 **Le shader du hero ENTREPRISE se règle tout seul, et il ne doit jamais redevenir fixe**
  (finding C-68, corrigé le 2026-09-05). `LightRays` peint le viewport entier dans un fragment
  shader à chaque frame, indéfiniment. Quand la machine ne tient pas la frame, les commandes
  s'empilent, le tampon se remplit, et **le fil principal BLOQUE** dans
  `CommandBufferProxyImpl::WaitForGetOffset` en attendant qu'il se vide. Mesuré sur le build de
  prod, rastérisation logicielle : **3 637 ms bloquées sur 4 000 au repos**, dont ~2 800 de pure
  attente. **Aucun de nos JavaScript ne tournait** — c'est pour ça que couper les flous, les 23
  `ScrollTrigger` et les 8 tweens infinis ne déplaçait pas la mesure d'un point, et pourquoi la
  cause a mis quatre jours à être nommée. Le composant mesure désormais la cadence qu'il obtient et
  le temps qu'il passe **dans** `render`, et descend d'un palier tant que ça ne tient pas :
  demi-résolution (le **départ**) → un huitième des pixels → 20 img/s → **gel**, la dernière frame
  restant affichée. **Les rayons restent visibles dans tous les cas** ; c'est le mouvement qui se
  retire, jamais l'image.
❌ **Ne jamais remplacer ça par une détection de rastériseur logiciel** (`SwiftShader`,
  `llvmpipe`) : ça verdit la sonde sans rien rendre à un téléphone d'entrée de gamme, qui a bien un
  GPU et n'en sature pas moins.
❌ **Ne jamais faire repartir l'échelle de la pleine résolution.** Descendre depuis le haut coûte
  la descente : mesuré, un résidu **stable** de 315 à 393 ms sur six passes, là où la même page
  sans canvas rendait 0 sur six. Ces frames-là tombent dans les premières secondes, le seul moment
  où quelqu'un regarde.
⚠️ **Une file qui sature n'a pas un coût progressif, elle a deux états.** C'est ce qui rendait la
  mesure BIMODALE, et aucune moyenne ne pouvait l'expliquer. Toute mesure de cette page se lit
  passe par passe, jamais en médiane.
- 🔴 **Le hero perso est CENTRÉ depuis le 2026-09-22** (DA de référence : Mobbin). Plus de
  colonne de droite : une **tuile produit** (`HeroAppIcon`, 96 px, deux feuilles empilées
  derrière) tourne sur les quatre modules au-dessus du H1, et les **quatre puces**
  (`HeroModuleDock`) flottent dans les marges de part et d'autre du titre, chacune reliée au
  centre par un filet d'encre (`.hero-link`). Les quatre modules sont décrits **une seule fois**,
  dans `hero-modules.ts` : la tuile et les puces doivent toujours dire la même chose.
⚠️ **`AppWindowShowcase` n'est plus dans le hero** — 540 px au-dessus du titre repoussaient la
  promesse sous la ligne de flottaison. Les quatre vitrines qu'elle faisait tourner sont montrées
  en grand, une par une, dès `FeaturesSection`.
⚠️ **Deux dispositions, UN seul jeu de puces**, basculé par des classes `xl:`. Rendre deux jeux
  et en masquer un coûterait soit un doublon annoncé aux lecteurs d'écran, soit un `aria-hidden`
  sur la seule liste libellée, donc la disparition de `hero.modulesLabel` sur grand écran.
🔴 **`LandingSkeleton` (dans `App.tsx`) DOIT décalquer ce hero**, pas seulement en occuper la
  place. Il a décrit la mise en page à deux colonnes pendant que le hero était déjà centré : un
  squelette qui annonce autre chose fabrique le saut de mise en page qu'il est censé éviter.
- 🔴 **Les tailles du H1 perso sont ARBITRAIRES (`text-[4.25rem]`), jamais nommées.** Les classes
  nommées de Tailwind (`text-6xl`, `text-7xl`…) posent **aussi** un `line-height`, et leurs
  variantes responsives sont émises **après** `leading-[…]` dans la feuille : à poids égal, la
  dernière gagne. Écrit `lg:text-6xl`, le titre rendait `line-height: 1` à partir de 1024 px —
  mesuré à 68 px pour 68 px de corps, là où `leading-[0.98]` en demande 66,6. Aucune erreur,
  aucun avertissement : la classe existe bien dans la feuille, elle est simplement recouverte.
⚠️ Même piège sur le sous-titre (`sm:text-lg`), corrigé en même temps.
- ⚠️ **Les alphas des aurores ont été divisés par deux une SECONDE fois** avec le hero centré, et
  pour une raison distincte de la première : le titre porte lui-même un dégradé bleu → fuchsia et
  s'affiche devant ces nappes. Un fond teinté dans les couleurs du texte qu'il porte enlève au
  texte ce qu'il donne au fond — le coin haut-droit virait au rose franc. Si le fond commence à
  se voir, c'est qu'il est déjà trop fort.
