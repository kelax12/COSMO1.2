> ⚠️ **ARCHIVE : récits et mesures datés, extraits de `docs/PERFORMANCE.md` le 2026-11-13 (DOC-02), non maintenus.**
> Chaque bloc décrit l'état **à sa date**. Les règles vivantes sont dans [`docs/PERFORMANCE.md`](../PERFORMANCE.md). Texte repris
> **sans une coupe** ; le titre de chaque bloc dit d'où il vient. Le code et la production font foi contre ce fichier.

# PERFORMANCE · journal (extraits du 2026-11-13)

---
## Vendor chunks · tailles du 2026-08-24 et 2026-08-25, chemin critique, trajectoire du chunk d'entrée

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

## Images et polices · le poste qu'on n'avait jamais pesé (2026-08-25), le « œ » à 85 ko, résultat mesuré sur `/`

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


## Instrument Serif auto-hébergée (2026-10-04), mesures

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


## Ce que coûte une ouverture d'application · 29 requêtes ramenées à 21 (2026-08-27), les quatre premières requêtes retirées

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

## Boîte de réception d'entreprise · vérification en prod, deuxième piste

**Vérifié en prod après application**, sur des demandes d'adhésion posées en transaction annulée
pour que la section admin ne soit pas jugée sur du vide :

| Compte | Demandes vues | Notifications | Invitations |
|---|---|---|---|
| admin de l'org | 2 | 0 | 0 |
| **membre simple de la même org** | **0** | 0 | 1 |
| non-membre | 0 | 20 | 0 |

Parité prouvée avant application, pour **chaque** compte de `auth.users`, section par section,
contre les requêtes que le client émettait.

## Boîte de réception d'entreprise · deuxième piste (friends, friend_requests)

⚪️ **Deuxième piste** : `friends` puis `profiles?email=in.(…)`, et `friend_requests` en deux
requêtes (reçues, émises). La première paire ne peut pas devenir une jointure PostgREST, il n'y a
pas de clé étrangère entre `friends.email` et `profiles.email`.

## Pastille COMPTE · note de déplacement du 2026-10-15

> Descendu de `src/modules/organizations/CLAUDE.md` le 2026-10-15 (plafond de 14 000 o dépassé),
> sans une coupe. Le dossier n'en garde que les interdits. Trace « avant » et parité mesurée :
> [`SCALABILITY.md`](./SCALABILITY.md) § 3 (récit dans l'archive citée à cet endroit).

## Onglets jamais rechargés · ventilation du 2026-08-26

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


## Pagination serveur · tableau « avant / après » des écrans (V14.1)

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

## Budget de bundle · commentaires datés de `check:bundle` (plafonds du 2026-09-14, incident C-58, SENTRY_FLOOR)

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

## Ne jamais faire · lignes redites des « Règles non négociables »

- ❌ Importer `gsap` hors de la landing page, ou en direct depuis `'gsap'` — passer par `@/lib/gsap` (chunk `vendor-gsap`, cf. CLAUDE.md). Partout ailleurs : Framer Motion ou CSS keyframes.
- ❌ Importer un composant Recharts sans `React.lazy` — fait retomber `vendor-charts` (374 kB) dans le critical path.
- ❌ Ajouter une dépendance > 50 kB minified sans règle `manualChunks`.
- ❌ Importer `* as locales` de `date-fns/locale` ou `* as Icons` de `lucide-react` — casse le tree-shaking.
- ❌ Monter un composant gros au niveau App qui ne s'affiche qu'après un geste — il doit être `lazy` + Suspense.

