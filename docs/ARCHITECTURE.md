# Architecture — invariants, dette et vérification

**Audit du 2026-08-14, invariants remesurés le 2026-08-24 puis le 2026-08-25** (colonne
« 2026-08-25 » du tableau §1), **budget de taille et suite unitaire remesurés le 2026-08-27**
(§3, 4ᵉ passe du cliquet). Le reste du tableau §1 n'a **pas** été revérifié le 27, sa colonne le
dit ligne par ligne. Mesuré contre le code de `main` et la prod. Remplace
[`archive/AUDIT-ARCHITECTURE-2026-08-07.md`](./archive/AUDIT-ARCHITECTURE-2026-08-07.md)
(20 correctifs, note 60→79), 77 commits plus tôt.

Ce document ne redécrit pas l'architecture — c'est le rôle de [`../CLAUDE.md`](../CLAUDE.md). Il
répond à une seule question : **les invariants qu'on s'est donnés tiennent-ils encore ?**

## Historique des notes et des audits : archivé

Les notes /100 de ce document ont cessé (ADR 0012, [`INDICATEURS.md`](./INDICATEURS.md)). Leur journal daté, les angles morts mesurés et les récits d'incident qui fondent les règles ci-dessous sont déplacés, sans coupe, dans [`archive/ARCHITECTURE-journal-des-notes-2026-07-01-au-2026-11-06.md`](./archive/ARCHITECTURE-journal-des-notes-2026-07-01-au-2026-11-06.md). Une règle de ce document qui cite une date ou un incident s'y retrouve.

## 1. Les invariants, vérifiés un par un

| Invariant | Où il est écrit | État au 2026-08-25 |
|---|---|---|
| Les lectures de liste de `tasks` passent par `get_my_tasks()` | CLAUDE.md ⚡ | ✅ **Tenu.** Les 4 `.from('tasks')` de `supabase.repository.ts` restent `getById` (exception légitime), `insert`, `update`, `delete` |
| Aucun import GSAP hors de la landing | CLAUDE.md | ✅ **Tenu.** 0 import direct de `'gsap'` |
| `useAuth` vient de `@/modules/auth/AuthContext` | CLAUDE.md | ✅ **Tenu.** 0 import depuis `@/modules/user` |
| Une seule policy PERMISSIVE par rôle + action | mig. 049 + `check:rls` | ✅ **Tenu.** **128** policies sur **81** migrations, 0 violation |
| La récurrence est générée côté serveur | mig. 086 | ✅ Tenu |
| Les canaux Realtime sont montés dans `App.tsx`, une seule fois | CLAUDE.md 📡 | ✅ **Tenu.** 3 `.channel()` dans `src/`, les trois montés au niveau App (`shared_tasks`, `org-inbox` mig. 118, `friends-inbox` mig. 120) |
| Toutes les tables `public` ont RLS activée | `SECURITY.md` | ✅ **Tenu**, vérifié en prod : 0 table avec `relrowsecurity = false` |
| **Jamais de `supabase.from()` hors d'un repository** | `SCALABILITY.md` §5 + garde | ✅ **Tenu** · invariant **outillé** (§2) |
| Imports toujours via l'alias `@/` | CLAUDE.md + ESLint | ✅ **Tenu** · outillé par `no-restricted-imports` (§2) |
| Les fonctions restent sous les seuils de complexité, et aucun fichier ne dépasse 1 000 lignes | `eslint.config.js` + `complexite.guard` + `architecture.guard` | ✅ **Outillé le 2026-11-07** (ARC-05) : `complexity` 20, `max-depth` 4, `max-lines-per-function` 200, cliquet de **134 fichiers, 207 valeurs** qui ne peut que baisser ; plafond de fichier relevé de 600 à 1 000, dernier recours (§3) |
| **Les lectures de liste entreprise passent par une RPC indexable** | CLAUDE.md ⚡ + test | ✅ **Tenu** · `get_my_team_projects` / `get_my_team_tasks` (mig. 113), `get_my_team_task_dependencies` (mig. 117). Verrouillé par `team-projects/supabase.repository.test.ts` |
| **Un droit entreprise se lit dans `permissions.ts`, jamais recalculé** | CLAUDE.md 🔐 + garde | ✅ **Tenu depuis le 2026-08-25** : une seule source de vérité cliente (`useMyOrgPermissions`), miroir du SQL, 205 tests |
| **Aucune position d'arrivée portée par une animation de transform** | CLAUDE.md + garde | 🟠 **17 feuilles encore écrites à la main**, mais les 5 réellement cassées sont corrigées et un cliquet interdit toute nouvelle (cf. [`MOBILE.md`](./MOBILE.md) §1) |
| **Aucun `refetchInterval` permanent** | CLAUDE.md 📡 | ✅ **Tenu au 2026-08-25, mais au deuxième essai.** Annoncé acquis le matin alors que 3 subsistaient ; corrigés l'après-midi. Décompte nominatif dans [`SCALABILITY.md`](./SCALABILITY.md) §3 |
| Suite unitaire verte | `TESTING.md` | ✅ **1 802 / 1 802 au 2026-08-27** (1 736 au 08-25) |

Les invariants qui portent la **sécurité** tiennent tous. Celui qui porte le **coût de
lecture** aussi. Celui qui porte le **coût de sondage**, non (§7).

Au 2026-08-24, deux des quatre violations sont refermées — et c'est le **même** geste qui les a
refermées : leur donner un outil. La convention d'import est passée de 1 à 6 entorses en dix jours
tant qu'elle ne vivait que dans un Markdown ; elle est réglée en une règle ESLint. Restent
`supabase.from()` hors repository (§2, une seule page) et les fichiers > 600 LOC (§3) — les deux
seules dettes de ce tableau que **rien ne mesure encore**, et donc les deux seules qui continueront
de grandir. C'est le motif de fond de cet audit : *une règle qu'aucun script ne mesure recule à
chaque vague de features.*

### 1.1 Une divergence **GELÉE**, et c'est une décision (C-03, 2026-09-12)

Le dépôt porte deux découpages de la journée, et ils ne coïncident pas toujours. Ce n'est pas une
dette qui attend son tour : c'est un arbitrage rendu, qui doit se lire ici comme les invariants
ci-dessus se lisent — sinon il se représentera au prochain audit sous forme de « bug à corriger ».

| Ce qui découpe la journée | Source | Suit la préférence de fuseau ? |
|---|---|---|
| échéances de tâches, reports, listes « Aujourd'hui » | `src/lib/timezone.ts` → `dayKeyInTz` / `todayKeyInTz` | ✅ oui, depuis la revue R-01 |
| clés de `habits.completions`, séries, grilles d'habitudes | `toLocaleDateString('en-CA')` (fuseau de la **machine**) | ❌ **non, et c'est gelé** |

**Pourquoi le gel plutôt que la migration.** Convertir une clé de jour d'un fuseau vers un autre
demande de savoir dans quel fuseau était la personne **ce jour-là**. La base ne le sait pas : elle
ne stocke qu'une préférence *courante*, posée aujourd'hui, qui ne dit rien de l'historique derrière.
Migrer appliquerait donc le décalage d'aujourd'hui à des journées vécues ailleurs, et le prix se
paierait en **séries** : une seule journée décalée fait perdre la série entière, `streak_best`
compris. On casserait une donnée que les gens ont construite pour corriger une incohérence qu'ils
ne voient pas.

**Ce que la personne voit quand les deux divergent.** Uniquement en réglage `manual`, et uniquement
si le décalage choisi la fait changer de jour par rapport à sa machine — donc **jamais en
métropole**, où les deux coïncident. Dans ce cas : sur le même écran, une tâche peut être « due
aujourd'hui » pendant qu'une habitude cochée compte pour la veille, et la case du jour de la grille
d'habitudes ne correspond pas à la colonne « Aujourd'hui » de la liste de tâches. La série, elle,
reste **cohérente avec elle-même** — calculée de bout en bout en date machine, elle ne saute pas,
elle est seulement calée sur un autre jour.

- ❌ **Ne jamais corriger une seule des deux moitiés.** Basculer l'AFFICHAGE sur `dayKeyInTz` en
  laissant l'ÉCRITURE en date machine ferait apparaître les jours cochés décalés d'une case : un
  historique faux présenté comme juste, strictement pire que la divergence actuelle, qui est au
  moins interne à chaque module.
- ✅ **Ce qui rouvrirait la question** : une colonne qui enregistrerait le décalage AU MOMENT de la
  complétion. À partir de là, et seulement à partir de là, une migration saurait ce qu'elle
  convertit. Rien dans le produit ne l'écrit aujourd'hui.

La même décision est écrite dans `CLAUDE.md` § « Fuseau horaire », à côté de la règle qui interdit
`toLocaleDateString('en-CA')` seul dans un chemin d'échéance — les deux doivent se lire ensemble,
sinon la seconde donne l'impression que la première est un oubli.

## 2. ✅ Les deux entorses de `SettingsPage` — réglées, et outillées

**État au 2026-08-24 : les deux invariants sont tenus, et chacun a désormais un outil.**
C'est la seule partie qui compte : les deux avaient déjà été « corrigés » par le passé, et les
deux étaient revenus.

### 2.1 Imports relatifs

Le comptage du 2026-08-14 (« 1 entorse ») était faux **par sous-mesure** : il ne cherchait que
`../modules`. En élargissant à `../lib`, `../components`, `../pages`, `../i18n`, on trouvait
**74 imports relatifs dans 29 fichiers**.

Tous réécrits en `@/…` (résolution mécanique du chemin, `tsc -b` vert), puis la convention rendue
**exécutable** par une règle ESLint `no-restricted-imports` — périmètre volontairement étroit :
seuls les chemins qui *remontent* pour atteindre `src/` sont interdits ; les imports relatifs
internes à un module (`./constants`, `./types`) restent légitimes, ce sont eux qui rendent un
module déplaçable.

### 2.2 `supabase.from()` hors repository

Même histoire, en pire. Ce document affirmait « `SettingsPage.tsx` concentre les deux
violations ». **C'était faux** : il y en avait quatre, dans quatre modules différents. Les trois
autres avaient échappé au `grep` initial parce qu'il ne balayait que `src/pages` et
`src/components` — or les trois vivaient dans `src/modules`.

| Fichier | Ce qu'il faisait | Où c'est parti |
|---|---|---|
| `src/pages/SettingsPage.tsx` | 2 × `UPDATE profiles` (avatar) | `src/modules/user/profile.repository.ts` |
| `src/modules/billing/billing.context.tsx` | `SELECT` + `INSERT subscriptions` | `billing.repository.ts` → `fetchOwnSubscriptionRow()` |
| `src/modules/friends/share-link.hooks.ts` | get-or-create sur `share_links` | `share-link.repository.ts` |
| `src/modules/organizations/notifications.ts` | 3 requêtes sur `org_notifications` | `notifications.repository.ts` |

Deux choix méritent d'être relus avant d'être « simplifiés » :

- `fetchOwnSubscriptionRow()` **duplique** `getSubscription()` au lieu de l'appeler. Ce n'est pas
  un oubli : elle utilise `getSession()` (lecture locale) au lieu de `getCurrentUser()` (qui
  revalide le JWT auprès de Supabase, donc un RTT par appel), et renvoie `null` au lieu de lever.
  Ce provider est monté pour toute l'application — le coût y est payé sur chaque écran.
- Le branchement démo des notifications reste dans les hooks. Il ne lit pas une table mais
  `localStorage` ; le sortir imposerait une paire local/supabase complète pour trois fonctions,
  sans rien protéger de plus. Ce que l'invariant vise, c'est l'accès direct à une **table** depuis
  du code d'interface.

**Garde** : `src/architecture.guard.test.ts` échoue si un fichier hors `*.repository.ts` contient
`supabase.from(`. Les commentaires sont retirés avant la recherche — sans ça, la phrase qui
explique la règle déclenchait la règle.

## 3. Taille et complexité · état au 2026-11-07 (ARC-05, V17.4)

**Décision du 2026-11-07.** Le plafond de **600 lignes par fichier** est relevé à **1 000**, en
simple garde-fou de dernier recours. Le signal passe aux **fonctions** : trois règles standard
d'ESLint, figées en **cliquet**. Mesuré sur `main` à `76b62791`.

### Pourquoi : le plafond faisait tasser le code

L'audit externe du 2026-11-06 (ARC-05) l'a vu, la mesure le confirme. Sur les **1 034 fichiers**
du périmètre (`src/` hors tests, `ui/`, `showcase/`, `generated/`) :

| Lignes par fichier (`wc -l`) | 400-449 | 450-499 | 500-549 | **550-599** | 600 et plus |
|---|---|---|---|---|---|
| Fichiers | 20 | 17 | 24 | **25** | 0 |
| Dont une fonction au-dessus des seuils ci-dessous | 14 (70 %) | 14 (82 %) | 19 (79 %) | 19 (76 %) | |

- Les deux tranches de 50 lignes sous la barre sont les plus peuplées depuis 400 lignes (49
  fichiers contre 37) : la barre attire le code au lieu de le simplifier.
- **35 fichiers de moins de 300 lignes** portent une fonction trop complexe ou trop longue
  (`CollaboratorItem.tsx`, 196 lignes : une fonction de complexité 45). `wc -l` ne les voyait pas.

### Mesures du 2026-11-07

**Par fonction** (11 964 fonctions, règles ESLint standard, valeurs lues dans leurs messages) :

| Mesure (règle ESLint) | p50 | p90 | p99 | max | > seuil |
|---|---|---|---|---|---|
| Complexité cyclomatique (`complexity`) | 1 | 5 | 18 | **107** (`OrganizationPage.tsx`) | 101 fonctions, 92 fichiers |
| Imbrication de blocs (`max-depth`) | 1 | 2 | 3 | 5 (`TeamOKRModal.tsx`, `report-pdf.ts`) | 2 blocs, 2 fichiers |
| Longueur, lignes non vides hors commentaires (`max-lines-per-function`) | 2 | 21 | 176 | **474** (`GuidePage.tsx`) | 104 fonctions, 101 fichiers |

Pour comparer, la complexité au-dessus de 15 aurait mis **162** fonctions au cliquet, au-dessus
de 10, **321** ; la longueur au-dessus de 100, **239**.

**Par module** (graphe d'imports statiques de `npm run check:cycles` : 0 non résolu,
0 cycle exigés) :

| Fan-out (importe le plus) | | Fan-in (le plus importé) | |
|---|---|---|---|
| `lib/repository.factory.ts` | 37 | `i18n/useT.ts` | 476 |
| `pages/DashboardPage.tsx` | 34 | `i18n/format.ts` | 99 |
| `pages/OKRPage.tsx` | 33 | `lib/toast.ts` | 88 |
| `components/organization/TeamTasksTab.tsx` | 32 | `modules/organizations/index.ts` | 74 |
| `components/TaskTable.tsx` | 31 | `modules/team-projects/index.ts` | 65 |

### Les seuils retenus, et le cliquet

| Règle | Seuil | Motif |
|---|---|---|
| `complexity` | **20** | défaut d'ESLint, juste au-dessus du p99 (18) : vise le 1 % du haut |
| `max-depth` | **4** | défaut d'ESLint ; 2 dépassements seulement |
| `max-lines-per-function` | **200** | au-dessus du p99 (176) ; un composant React plus long mélange plusieurs surfaces |

- **Où** : `eslint.config.js`, sur le même périmètre que `architecture.guard`. `npm run lint`
  refuse tout dépassement dans un fichier qui n'est pas dans la ligne de base.
- **La ligne de base** : `eslint-rules/complexite.baseline.json`, **134 fichiers, 207 valeurs**
  (101 complexités, 2 imbrications, 104 longueurs). Chaque fichier y reçoit sa pire valeur
  mesurée comme plafond ESLint.
- **Le cliquet, fonction par fonction** : `eslint-rules/complexite.guard.test.mjs` relint ces
  134 fichiers au seuil commun et exige EXACTEMENT la liste de la ligne de base. Une valeur qui
  monte, ou une fonction de plus au-dessus du seuil : rouge. Une valeur qui baisse : rouge aussi,
  avec la valeur à recopier, pour que le cliquet ne reprenne jamais de mou.

🔴 **C'est la ligne de base d'une métrique NEUVE, pas une allowlist pour faire passer.** On n'y
ajoute jamais un fichier, on n'y relève jamais une valeur. Un nouveau dépassement se règle en
découpant la fonction, jamais en éditant le JSON.

**Témoin du 2026-11-07** : une fonction de complexité 21 posée dans un fichier neuf de `src/` a
fait rougir `npm run lint` ; une seconde fonction trop complexe ajoutée à un fichier déjà listé, en
dessous de sa pire valeur, passait `npm run lint` et a fait rougir `complexite.guard`. Les deux
retirés, tout revient au vert. Le témoin permanent (une fonction de complexité 21 refusée, de 20
acceptée, et la configuration réelle relue fichier par fichier) vit dans le même fichier de garde.

### Ce qui reste rapporté, et la revue humaine

- **Couplage : rapporté, pas bloquant.** Les plus forts fan-in sont des façades voulues (i18n,
  `toast`, l'`index.ts` d'un module) et les plus forts fan-out des racines de composition (la
  fabrique de repositories, les pages) : un plafond punirait le motif recherché. La règle
  standard de fan-out (`import/max-dependencies`) demanderait `eslint-plugin-import`, une
  dépendance que ce dépôt refuse pour une mesure (cf. l'en-tête de `check-import-cycles.mjs`).
- **Les découpages viennent ensuite, un par un, en revue humaine.** Ordre de travail : les pires
  valeurs d'abord (complexité : `OrganizationPage` 107, `TeamTaskModal` 99, `PyramidNodeCard` 76,
  `admin/repository` 74 ; longueur : `GuidePage` 474, `ApercuWidgetGrid` 449, `TeamTaskModal` 433,
  `InboxMenu` 432). Une découpe suit une frontière réelle (un geste, une surface, une dérivation),
  jamais une coupe à la valeur près pour passer sous un seuil.
- **Le plafond de 1 000 lignes** reste dans `src/architecture.guard.test.ts`, liste d'exceptions
  vide. Il n'arrête plus que le fichier fourre-tout fait de petites fonctions, que les règles
  ci-dessus laisseraient passer. ❌ Ne pas le rabaisser à 600 : ce serait rouvrir le tassement.

L'histoire du plafond de 600 (17 fichiers hors budget au 2026-08-24, liste vidée le 2026-09-05 par
`C-09`) n'est plus recopiée ici : elle se lit dans l'historique git de ce document et de
`architecture.guard.test.ts`.

## 4. 🟡 Code livré sans consommateur — un motif récurrent

Le dépôt accumule des primitives et des hooks livrés puis jamais adoptés :

| Élément | Consommateurs |
|---|---|
| ~~`useMessages` (`src/modules/user`)~~ | ✅ **supprimé le 2026-08-24** — avec `useUser`, `useWatchAd` et `useUpdateUserSettings` : tout le module sauf le type `User` |
| ~~`useTasksInfinite`~~ | ✅ **supprimé le 2026-08-25** : la marche à suivre est restée en commentaire à sa place (cf. [`SCALABILITY.md`](./SCALABILITY.md) §5). `getPage()` est **conservé** : capacité d'interface implémentée et testée sur tous les modules |
| **`MobileHeader`** | ✅ **2 → 8 le 2026-08-25** : les 6 pages migrées (cf. [`MOBILE.md`](./MOBILE.md) §2) |
| ~~`MobileScreen`, `ListRow` (`src/components/mobile`)~~ | ✅ **supprimés le 2026-09-05** (C-10) — 0 consommateur en six semaines d'existence (cf. [`MOBILE.md`](./MOBILE.md)) |
| `TouchTarget` | 2 |
| `BottomSheet`, `Segmented` | 2 chacun, mais 16 fichiers importent une variante de feuille (cf. [`MOBILE.md`](./MOBILE.md) §3) |
| ~~49 hooks de `src/modules`~~ | ✅ **supprimés le 2026-09-05** (C-49) — dont trois `hooks.derived.ts` orphelins EN ENTIER. Le motif est désormais **outillé** : `src/modules/orphan-hooks.guard.test.ts` |

Ce n'est pas grave pris isolément, mais c'est un **motif** : on construit la brique générique, on
migre la première page en vitrine, et la migration s'arrête là. Le coût n'est pas le code mort
lui-même — c'est que la doc décrit alors une architecture qui n'existe pas.

> ✅ **Ce motif a un outil depuis le 2026-09-05** : `src/modules/orphan-hooks.guard.test.ts`. Il
> échoue dès qu'un hook exporté par `src/modules` n'est monté par rien. C'est la seule sortie
> durable — les trois relevés manuels (2026-08-24, 08-25, 09-03) ont chacun trouvé la même chose,
> parce qu'aucun d'eux ne laissait derrière lui de quoi la voir revenir.
>
> 🔴 **Deux angles morts, rencontrés POUR DE VRAI en écrivant cette garde**, et qui valent pour
> tout balayage de ce dépôt :
>
> 1. **Une mention en commentaire n'est pas un appel.** `useCreateKRCompletion` disparaissait de
>    la liste des orphelins parce que deux commentaires expliquant pourquoi il est dangereux le
>    nommaient. Même correctif que `architecture.guard.test.ts` pour `supabase.from(`.
> 2. **Un hook appelé par un autre hook du même fichier n'est pas orphelin.** `useFilteredTasks`
>    n'est importé par aucun écran, mais `usePendingTasks` l'appelle, et celui-là sert deux
>    composants vivants. La liste de C-49 demandait sa suppression : l'appliquer littéralement
>    cassait `DeadlineCalendar` et `TasksSummary`.
>
> **Une liste de « noms sans consommateur direct » n'est pas une liste de suppressions sûres.**

> ✅ **Le motif s'est inversé une fois, et il faut le noter parce que c'est la première.**
> `MobileHeader` a été **adopté** (2 → 8 consommateurs) au lieu d'être supprimé, et la migration
> a révélé que le composant **n'avait jamais fonctionné** sur la seule page qui l'utilisait
> (il écoutait `window.scroll` alors que c'est le `<main overflow-auto>` de `Layout` qui scrolle).
>
> **La leçon dépasse ce composant.** Un code sans consommateur n'est pas seulement inutile : il
> est **non éprouvé**. Personne ne peut dire s'il marche, parce que personne ne s'en sert. Le
> réflexe « on le garde, ça resservira » suppose qu'il fonctionne ; ici, il ne fonctionnait pas,
> et depuis un mois. Deux sorties seulement pour un code sans consommateur : **l'adopter ou le
> supprimer.** Le garder, c'est accumuler du code dont on ignore l'état.
>
> ✅ **`MobileScreen` et `ListRow` ont pris la seconde sortie le 2026-09-05** (C-10) : six semaines
> à 0 consommateur, ils sont supprimés. C'est le premier item de cette table à être fermé par la
> suppression plutôt que par l'adoption, et les deux issues comptent autant — ce que la règle
> interdit, c'est la troisième, « on garde, ça resservira ».
>
> ⚠️ **Ce que la suppression a confirmé, et qu'on ne voit qu'en la faisant** : les deux primitives
> étaient livrées AVEC leurs tests (67 lignes, tous verts). Un test vert sur un composant que rien
> ne monte ne prouve que sa propre cohérence, jamais son adéquation à un écran. C'est la même
> illusion que `MobileHeader`, qui ne fonctionnait pas pendant un mois : sa page l'utilisait, mais
> personne n'avait regardé le résultat. Livré ≠ éprouvé, et testé ≠ éprouvé non plus.

> **2026-08-27 · une troisième forme du motif, plus discrète : le hook existant mais non exporté.**
> `useUpcomingEvents` (module `events`) était écrit, testé par son module, et **absent du barrel**.
> La carte « Mon agenda » de l'aperçu entreprise (`3fbe2dc`) n'a eu qu'à l'exporter pour s'en
> servir. Ce n'est pas du code mort au sens des lignes ci-dessus, c'est du code **inatteignable
> depuis les zones qui en ont besoin**, et l'effet pratique est le même : la fonctionnalité se
> réécrit ailleurs, ou ne se fait pas. À surveiller à l'ajout d'un hook, la question n'est pas
> « existe-t-il ? » mais « une autre zone peut-elle l'importer ? ».

> ⚠️ La ligne `import { useMessages } from '@/modules/user'` de `CLAUDE.md` décrivait un hook que
> personne n'appelait. Elle a survécu à la réécriture documentaire du 2026-08-14 parce que j'ai
> vérifié que le fichier existait, pas qu'il servait. **Vérifier l'existence ne suffit pas ;
> il faut vérifier l'usage.**
>
> ✅ **Résolu le 2026-08-24, et la suite est plus intéressante que la ligne de doc.** En vérifiant
> l'usage, il s'est avéré que `src/modules/user` n'avait qu'UN seul consommateur — et que ce
> consommateur écrivait dans `cosmo_user`, une clé que plus rien ne relisait depuis que `useAuth`
> est devenu la source de vérité du type `User`. En mode démo, changer son nom, son email ou sa
> photo affichait « Profil mis à jour » et **ne changeait rien**, ni tout de suite ni après
> rechargement (faille B7, deuxième occurrence). Le code mort ne coûtait pas que de la place : il
> cachait un bug de parcours, sur le mode démo, qui est l'entonnoir d'acquisition.
>
> La mutation est remontée dans `AuthContext` (`updateDemoProfile`), la partie pure est isolée et
> testée (`src/modules/auth/demo-profile.ts` + 10 tests), et le reste du module a été supprimé.

## 5. ✅ Dérive repo ↔ prod — refermée

> **Vérifié en base le 2026-08-25 : la mig. `099` est appliquée**, ainsi que toutes les
> suivantes jusqu'à la `119`. Le ledger et le dépôt sont alignés, il ne reste aucune
> migration en attente.
>
> ⚠️ Ce paragraphe est resté marqué 🔴 pendant que le problème était déjà réglé. C'est le
> défaut classique d'un audit qu'on corrige sans rouvrir : **le titre survit au finding**.
> Avant de citer un marqueur de ce fichier, revérifier le fait.

### Le diagnostic d'origine

La migration **`099_admin_stats_v3.sql` n'est pas appliquée** en prod (dernière appliquée : `098`,
vérifié dans `supabase_migrations.schema_migrations`). Conséquence fonctionnelle détaillée dans
[`ACQUISITION.md`](./ACQUISITION.md) : la chaîne d'attribution `?ref=` est complète en base et
muette dans `/admin`.

C'est la seule dérive détectée. Après une migration appliquée, la preuve est la relecture au
catalogue de l'objet créé ; `Migration coverage` (quotidien) refuse un fichier dont aucun objet
n'existe en prod.

## 6. ✅ Ce qui a tenu depuis l'audit du 2026-08-07

Les correctifs structurants de cet audit sont toujours en place et, pour deux d'entre eux,
**vérifiés par la mesure** dans cette série :

- `get_my_tasks()` planifie bien en `Index Scan` (mesuré à chaud, cf. `SCALABILITY.md` §6).
- Le passage du sondage au Realtime tient sur `tasks` — mais **seulement sur `tasks`** :
  8 `refetchInterval` subsistent ailleurs (`SCALABILITY.md` §3).
- `isDemoMode` / `setDemoMode` ne sont plus exportés (source unique `appModeStore`).
- Les gardes `check:rls` et `validate:migrations` tournent et sont vertes.

---

## Comment refaire cet audit

```bash
# Invariants (doivent tous renvoyer vide, sauf le premier)
grep -rn "from('tasks')" src/modules/tasks/supabase.repository.ts   # getById/insert/update/delete uniquement
grep -rln "supabase.from(" src --include="*.tsx" | grep -v repository
grep -rln "from 'gsap'" src | grep -v lib/gsap
grep -rn "useAuth.*from '@/modules/user'" src

# Dette de taille et de complexité (§3)
npm run lint                                         # seuils + ligne de base
npx vitest run eslint-rules/complexite.guard.test.mjs   # cliquet fonction par fonction
npm run check:cycles                                 # cycles, fan-in et fan-out

# Code sans consommateur (remplacer <nom>)
grep -rl "<nom>" src --include="*.tsx" --include="*.ts" | grep -v "définition"

# Gardes
npm run check:rls && npm run validate:migrations
```
