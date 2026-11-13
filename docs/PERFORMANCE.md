# Performance bundle — `vite.config.ts manualChunks`

## Historique des notes et des audits : archivé

Les notes /100 de ce document ont cessé (ADR 0012, [`INDICATEURS.md`](./INDICATEURS.md)). Leur journal daté, les angles morts mesurés et les récits d'incident qui fondent les règles ci-dessous sont déplacés, sans coupe, dans [`archive/PERFORMANCE-journal-des-notes-2026-08-24-au-2026-11-06.md`](./archive/PERFORMANCE-journal-des-notes-2026-08-24-au-2026-11-06.md). Une règle de ce document qui cite une date ou un incident s'y retrouve.

## Vendor chunks isolés (commenter toute modif)

🔴 **2026-10-23 · un filtre `manualChunks` se termine par `/`.** `id.includes('node_modules/react')`
rangeait aussi `react-day-picker`, `react-redux`, `react-remove-scroll`… dans `vendor-react`, donc
dans le chemin critique. Corrigé à la migration React 19 : chemin critique 328,8 → 302,6 ko gzip,
`vendor-react` 69,2 ko. Mesures : [`MIGRATION-REACT19.md`](./MIGRATION-REACT19.md) §0.

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

### Instrument Serif, auto-hébergée (2026-10-04)

`tailwind.config.js` déclarait `font-display: "Instrument Serif"` depuis le hero entreprise
(2026-09-23), mais **aucun `@font-face` n'existait** et la CSP (`font-src 'self'`) interdit
Google Fonts : tout titre `font-display` sortait en Georgia, le repli, sans erreur ni
avertissement. Quatre fichiers dans `public/fonts/` (droit et italique, latin et latin-ext,
licence OFL à côté), déclarés dans `src/index.css` § Polices d'affichage.

Mesuré dans Chromium headless, `/entreprise-presentation` à 1440 × 900 :

| | Georgia (police bloquée) | Instrument Serif |
|---|---|---|
| Fichiers téléchargés | aucun | `latin` droit (21 ko) + `latin` italique (22 ko) |
| Boîte du `h1` | 960 × 199 px | **960 × 199 px** |
| CLS de la page | 0,000006 | **0,0064** (seuil « bon » : 0,1) |

- ✅ Le sous-ensemble `latin-ext` n'est PAS téléchargé : même ordre de déclaration qu'Inter
  (latin en dernier, cf. la règle ci-dessus sur le chevauchement U+0152-0153).
- ❌ **Pas de préchargement dans `index.html`** : la police ne sert qu'au parcours entreprise de la
  landing et aux deux accueils ; la précharger ferait payer ~21 ko à chaque visiteur de l'app.
- ✅ `font-data` (`"Geist Mono"`) était dans le même cas : déclarée, jamais servie, rendue en
  `ui-monospace` (Consolas sous Windows). Auto-hébergée le 2026-10-05 (variable 100-900, latin
  23 ko, latin-ext 15 ko, mêmes règles).

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

**29 requêtes REST au chargement, ramenées à 21 le 2026-08-27.** Le compte vient des
`edge_logs` de production, sur une session réelle du bundle courant arrivant à froid sur
`/dashboard`.

⚠️ **Correction d'un chiffre annoncé la veille.** La trace de 25 secondes contient 32 requêtes,
et elles ont d'abord été comptées comme étant toutes celles du chargement. Trois d'entre elles
portent en fait un identifiant de tâche précis (`tasks?id=eq.…`, `shared_tasks?task_id=eq.…`,
`share_links?task_id=eq.…`) : c'est une fiche que l'utilisateur a ouverte juste après. Le
chargement lui-même en coûtait **29**. Une fenêtre de temps n'est pas un événement.

| Ce qui les émet | Avant | Après | Payées par |
|---|---|---|---|
| Données du tableau de bord (tâches, catégories, listes, agenda, habitudes, OKR, KR) | 9 | **7** | tout le monde |
| Collaboration (amis, profils, demandes reçues et émises, tâches et listes partagées) | 8 | **7** | tout le monde |
| Mode entreprise (org, membres, adhésions, notifications, invitations, projets, tâches d'équipe) | 9 | **4** | **membres d'une org seulement** |
| Session et abonnement (`touch_last_seen`, `subscriptions`, profil) | 3 | 3 | tout le monde |
| **Total** | **29** | **21** | |

Ce n'est pas absurde pour sept domaines métier affichés, et ces requêtes partent en parallèle sur
HTTP/2, pas en série. Mais **c'est le multiplicateur de charge du produit** : 100 arrivées
simultanées valaient 2 900 requêtes, elles en valent 2 100. C'est ce nombre qu'il faut surveiller
avant un pic d'acquisition, bien avant le coût unitaire de chacune.

### Les 4 premières requêtes retirées, et pourquoi elles existaient

Aucune migration, aucun changement d'écran, aucune donnée affichée en moins. Les quatre venaient
du même travers : **une donnée déjà chargée, redemandée sous un autre angle.**

1. **`okrs?completed=eq.false` et le `key_results` qui suivait (−2).** `useWeeklyCheckin()` est
   monté par le tableau de bord à chaque ouverture et ne se sert de cette liste que pour tester
   `length > 0`, un lundi ou un mardi. Elle passait par une clé React Query distincte, donc une
   requête réseau, et le repository enchaînait un second appel pour hydrater les `key_results`
   des OKR qu'il venait de lire. `completed` est une colonne déjà présente sur chaque OKR chargé
   par `useOkrs()` : le filtre se fait en mémoire, sur quelques dizaines d'éléments.
2. **`shared_tasks?shared_by=eq.moi` (−1).** Deux lectures de la même table cohabitaient :
   `mine` (`shared_by = moi`) et `related` (`shared_by = moi OR friend_id = moi`). La seconde
   contient déjà la première en entier, et sélectionne toutes ses colonnes. C'était une requête
   pour un sous-ensemble de l'autre. Effet de bord bienvenu : les badges d'avatars suivent
   désormais le canal Realtime, qui n'invalidait que la clé `related`.
3. **`organizations?id=in.(…)` (−1).** `getMyOrganizations` lisait les adhésions, **puis**
   les organisations avec un `in(...)` bâti sur le premier résultat : deux allers-retours
   **séquentiels**, le second ne pouvant même pas partir avant le retour du premier. La jointure
   PostgREST sur la clé étrangère `organization_members.org_id` fait les deux en une requête. La
   RLS ne change pas : la ligne jointe est filtrée par sa propre policy, et une organisation
   illisible revient à `null`, écartée côté client.

Les trois sont verrouillées par des tests qui échouent si on les rebranche
(`okrs/hooks.test.tsx`, `friends/hooks.test.tsx`, `organizations/supabase.repository.test.ts`),
et chaque garde a été vue **rouge** sur la régression qu'elle prétend attraper.

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

**Vérifié en prod après application**, sur des demandes d'adhésion posées en transaction annulée
pour que la section admin ne soit pas jugée sur du vide :

| Compte | Demandes vues | Notifications | Invitations |
|---|---|---|---|
| admin de l'org | 2 | 0 | 0 |
| **membre simple de la même org** | **0** | 0 | 1 |
| non-membre | 0 | 20 | 0 |

Parité prouvée avant application, pour **chaque** compte de `auth.users`, section par section,
contre les requêtes que le client émettait.

⚠️ Les bornes sont appliquées **par organisation** (window function), pas globalement : 200
demandes, 50 notifications. Sans cela, un compte membre de trois organisations verrait la
troisième tronquée par les deux premières, et ça ne se serait vu que chez lui.

❌ Ne pas réintroduire une invalidation par section dans `useOrgInboxRealtime` : ces clés ne
portent plus de donnée, l'écran cesserait de se rafraîchir **en silence**. Garde :
`organizations/inbox.hooks.test.tsx`, vue rouge avant d'être committée.

⚪️ **Deuxième piste** : `friends` puis `profiles?email=in.(…)`, et `friend_requests` en deux
requêtes (reçues, émises). La première paire ne peut pas devenir une jointure PostgREST, il n'y a
pas de clé étrangère entre `friends.email` et `profiles.email`.

#### La pastille COMPTE, elle ne lit pas la liste (mig. `142`, finding C-05)

> Descendu de `src/modules/organizations/CLAUDE.md` le 2026-10-15 (plafond de 14 000 o dépassé),
> sans une coupe. Le dossier n'en garde que les interdits. Trace « avant » et parité mesurée :
> [`SCALABILITY.md`](./SCALABILITY.md) § 3 (récit dans l'archive citée à cet endroit).

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

Dépendances au « tout en mémoire » et leur traitement :

| Écran | Avant | Après |
|---|---|---|
| Vue « Terminées » de la page Tâches | filtre mémoire | `useTaskArchive` + compte serveur, chargement continu |
| « Voir les N terminées » (fin de liste) | longueur du tableau | `useTaskCount` sur les mêmes filtres |
| Statistiques, période glissante (≤ 365 j) | `useTasks()` | `useTaskSubset({ completedSince, completedBefore })` |
| Graphiques du tableau de bord (6 mois) | `useTasks()` | `useChartCompletedTasks` (190 j de `completed_at`) |
| Impact et réaffectation avant suppression de catégorie | `useTasks()` | toutes les tâches de la branche, relues |
| Export CSV (art. 20) | `useTasks()` | `getAll()` sans plafond, au clic ; compte serveur |
| Accueil « compte vide » | longueur du tableau | `useTaskCount({})` |
| Palette ⌘K | `useTasks()` | jeu de travail + recherche serveur dans l'archive |
| Fiche ouverte depuis l'archive ou un lien | `tasks.find` | `useKnownTask` (caches, puis `getById`) |
| Dépendances d'une tâche | `tasks.find` | tâches manquantes relues par id |
| Coche verte des créneaux de l'agenda | `useTasks()` | tâches liées manquantes relues par id |
| `usePendingTasks` | `getFiltered` sans `range` (plafond PostgREST 1 000) | dérivé du jeu de travail |

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

- ❌ Importer `gsap` hors de la landing page, ou en direct depuis `'gsap'` — passer par `@/lib/gsap` (chunk `vendor-gsap`, cf. CLAUDE.md). Partout ailleurs : Framer Motion ou CSS keyframes.
- ❌ Importer un composant Recharts sans `React.lazy` — fait retomber `vendor-charts` (374 kB) dans le critical path.
- ❌ Ajouter une dépendance > 50 kB minified sans règle `manualChunks`.
- ❌ Importer `* as locales` de `date-fns/locale` ou `* as Icons` de `lucide-react` — casse le tree-shaking.
- ❌ Monter un composant gros au niveau App qui ne s'affiche qu'après un geste — il doit être `lazy` + Suspense.
- ❌ Créer une clé React Query distincte pour un **filtre** d'une liste déjà chargée. Une clé de plus est une requête de plus, et sur Supabase le repository enchaîne souvent une seconde lecture pour hydrater ce qu'il vient de lire : deux requêtes pour un `filter()`. Dériver avec `useMemo` depuis le hook de base. Cas réels : `useActiveOkrs` (2 requêtes par ouverture, pour tester `length > 0`) et `useSharesByTask` (un sous-ensemble strict d'une lecture déjà faite).
- ❌ Lire une table, **puis** une seconde avec un `in(...)` bâti sur le premier résultat. Ce sont deux allers-retours séquentiels, le second ne pouvant pas partir avant le retour du premier. Quand une clé étrangère existe, la jointure PostgREST (`select=col, autre_table(*)`) fait les deux en une requête, sans changer la RLS : la ligne jointe reste filtrée par sa propre policy.
- ❌ Écrire un prédicat de policy RLS qui appelle une fonction **sur une colonne** (`fn(user_id)`). Il est rappelé pour chaque ligne examinée et rend l'index inutilisable. Un helper sans argument, dont le périmètre vient de `auth.uid()` seul, est hissé en InitPlan et évalué une fois par requête. Trois occurrences déjà : `tasks` (085), `team_tasks` (113, 117), `events` (128).
- ❌ **Valider un correctif de performance CLIENT sur un compteur agrégé de Postgres** (`pg_stat_user_tables`, `pg_stat_statements`). Ils cumulent depuis la création de la base et mélangent les anciens et les nouveaux clients : ils donneront tort au correctif pendant des jours. Ventiler les `edge_logs` par `request.sb.jwt.authorization.payload.session_id`, une seule session du bundle courant suffit à trancher.
- ❌ Conclure quoi que ce soit d'un total cumulé. Seul un **delta entre deux instants**, mesuré au repos, donne un débit. `organization_members` affichait 2 440 047 balayages pour 11 lignes et n'en prenait **aucun** sur une fenêtre de 285 s au repos.

## Optimisations de l'audit technique du 2026-07-15 : archivées

Agrégats de statistiques en SQL (RPC `get_work_time_stats`), `staleTime` différencié, préchargement au survol, Brotli et polices : le détail est dans [`archive/PERFORMANCE-budget-bundle-recits-2026-05-29-au-2026-10-22.md`](./archive/PERFORMANCE-budget-bundle-recits-2026-05-29-au-2026-10-22.md).

⚠️ **Règle qui reste vivante** : la sémantique de la RPC `get_work_time_stats` doit rester **identique** à `calculateWorkTimeForPeriod` (dates locales inclusives via `p_tz`), pour que les modes démo et production affichent la même chose.

## Chemins de lecture indexables · repris de `CLAUDE.md` (déplacé le 2026-09-16)

> Ce bloc vivait dans `CLAUDE.md`, chargé à chaque session. Déplacé ici **sans une coupe**.
> La règle courte vit dans [`src/modules/CLAUDE.md`](../src/modules/CLAUDE.md).

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

> Commentaires de la section `## Scripts` de `CLAUDE.md`, où ils étaient chargés à chaque
> session. Déplacés ici **sans une coupe**. La racine ne garde que la commande.

```bash
npm run check:bundle        # Budget de bundle sur le build reel (CI, apres npm run build)
                            # Plafonds EN VIGUEUR DANS LE DEPOT depuis le 2026-09-14
                            # (commit `7134d7fe`, run CI `34846164939` vert) :
                            # chemin critique < 323 000 o gzip (mesure 306,6 ko,
                            # marge 5,1 %), entree < 71 000 o (mesure 66,9 ko,
                            # marge 5,8 %). Les deux ont ETE ABAISSES, la mesure
                            # ayant baisse de 10,1 ko des deux cotes (sonner sort
                            # du chemin critique, cf. § Toasts).
                            # 🔴 CES DEUX CHIFFRES ONT VECU TROIS JOURS DANS UN
                            # ARBRE NON COMMITE. Ce fichier les annoncait comme
                            # en vigueur pendant que `main` portait encore
                            # 78 000 / 370 000, et une branche a ete arbitree
                            # contre un plafond qui n'existait nulle part
                            # (cf. C-58). Un plafond se relit dans le fichier
                            # COMMITE, jamais dans celui qu'on vient d'editer.
                            # ⚠️ Ils sont poses a ~5 % au-dessus du mesure, pas
                            # a ~1,5 % comme les precedents : le critere de sortie
                            # de C-14 exige 5 % de marge sur les DEUX budgets, et
                            # un cliquet a 1,5 % rouvrirait l'item le jour meme.
                            # ❌ Ne jamais remonter un plafond.
                            # 🔴 EXIGE `VITE_SENTRY_DSN` AU BUILD. Sans elle, Vite remplace la
                            # variable A LA COMPILATION, la branche `if (sentryDsn)` de main.tsx
                            # devient du code mort, et Rollup jette presque tout @sentry/react :
                            # vendor-sentry passe de 49,3 a 3,8 ko gzip. La garde sous-estimait
                            # alors le chemin critique de ~45 ko, et annoncait 57,8 ko de marge
                            # la ou il en restait 11,9. Elle REFUSE desormais de valider un build
                            # dont vendor-sentry pese moins de 20 ko (`SENTRY_FLOOR`).
                            # ⚠️ Un job qui PESE un artefact et un job qui l'EXECUTE n'ont pas
                            # les memes besoins : un faux DSN suffit a peser, mais il fait
                            # s'initialiser Sentry pour de bon, qui emet vers un hote inexistant
                            # et fait tomber `best-practices` de 100 a 96 dans lighthouse.
```

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
