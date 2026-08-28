# Architecture — invariants, dette et vérification

**Audit du 2026-08-14, invariants remesurés le 2026-08-24 puis le 2026-08-25** (colonne
« 2026-08-25 » du tableau §1), **budget de taille et suite unitaire remesurés le 2026-08-27**
(§3, 4ᵉ passe du cliquet). Le reste du tableau §1 n'a **pas** été revérifié le 27, sa colonne le
dit ligne par ligne. Mesuré contre le code de `main` et la prod. Remplace
[`archive/AUDIT-ARCHITECTURE-2026-08-07.md`](./archive/AUDIT-ARCHITECTURE-2026-08-07.md)
(20 correctifs, note 60→79), 77 commits plus tôt.

Ce document ne redécrit pas l'architecture — c'est le rôle de [`../CLAUDE.md`](../CLAUDE.md). Il
répond à une seule question : **les invariants qu'on s'est donnés tiennent-ils encore ?**

## Note d'architecture : 74 → 79 → **81 / 100** (2026-08-24 → 2026-08-25 → 2026-08-27)

| Ce qui compose la note | 08-24 | 08-25 | **08-27** |
|---|---|---|---|
| Invariants tenus | 10 / 13 | **12 / 14** | **12 / 14**, inchangé |
| Fichiers > 600 LOC | 16 · 12 503 lignes | 15 · 11 452 lignes (−1 051) | **14 · budget de garde 10 811** (−643) |
| Plus gros fichier | `PyramidTab` 1 506 | **`TaskTable` 1 124** (PyramidTab tombé à 1 045) | `TaskTable` **1 124**, inchangé |
| Primitives livrées sans consommateur | 3 | **2** (`MobileHeader` passe de 2 à **8** consommateurs) | 2, non remesuré |
| Invariants **outillés** (une garde, pas un Markdown) | 6 | 6 | 6 |
| Suite unitaire | 1 583 / 143, verte | 1 736 / 151, verte | **1 802 / 159, verte** |

### 2026-08-27 · +2, et un seul critère les porte

**Deux critères bougent, les quatre autres sont explicitement inchangés** (colonne ci-dessus) :
le budget de taille, quatrième passe du cliquet, et la suite unitaire, +66 tests. Rien d'autre
n'a été remesuré ce jour-là, et rien d'autre ne prend de point.

**Ce qui vaut plus que les deux points : le cliquet a attrapé une régression que son auteur
niait.** Le correctif d'états de chargement (`1d98f93`) ajoutait 9 lignes à `TeamTasksTab.tsx`,
déjà hors budget : le total est passé à 11 463 pour un plafond à 11 454, et la garde
`architecture.guard` est passée au rouge. Elle a été déclarée **deux fois** « antérieure à ce
travail », sur la foi d'un `git stash` pris à un moment où le commit fautif était déjà en place.
La vérification correcte, restaurer `src/` à `4b91816` et relancer, montre la garde **verte**
avant. Le commit `180fba1` porte cette correction en tête de son propre message.

> ⚠️ **La leçon est méthodologique, et elle est la même que celle du 2026-08-25 sur les
> `refetchInterval`** : un « avant » ne se lit pas dans un stash, il se reconstruit à un commit
> nommé. Une garde rouge est coupable jusqu'à preuve du contraire, et la preuve est une mesure au
> commit précédent, pas un souvenir de l'état de l'arbre de travail.

**+5.** Le cliquet de taille a joué deux fois en deux jours et le budget a baissé de 1 051 lignes
sans qu'aucune fonctionnalité ne soit reportée : c'est la démonstration que la garde rend le
refactor moins cher que le contournement. Et pour la première fois, une primitive livrée puis
abandonnée (§4) a été **adoptée** au lieu d'être supprimée.

**Ce qui empêche de monter plus haut est un incident de méthode, pas un défaut de code.**
`CLAUDE.md` a affirmé le matin du 2026-08-25 qu'il ne restait « aucun `refetchInterval`
permanent », il en restait **trois**, dont un monté à l'échelle de l'application. Ils ont été
trouvés par recomptage nominatif et corrigés dans la journée. L'invariant tient donc, mais il a
été **déclaré acquis avant de l'être**, sur la règle la plus récemment écrite du dossier. C'est le
motif de fond de cet audit, appliqué à lui-même : *une règle qu'aucun script ne mesure ne devient
jamais un acquis, quelle que soit la conviction de celui qui l'écrit.*

Les deux dettes que rien ne mesure encore restent donc les mêmes : les fichiers > 600 LOC (§3,
mais le cliquet les fait baisser) et la taille du chunk `index`
([`PERFORMANCE.md`](./PERFORMANCE.md), le seul budget sans garde, et le seul qui ait reculé).

---

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
| Aucun fichier source > 600 LOC | refactor de juin 2026 + cliquet | ❌ **Toujours violé · 14 fichiers au 2026-08-27**, mais le budget a **encore baissé** : 13 103 → 12 503 → 11 452 → **10 811** (§3) |
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

## 3. 🟠 L'objectif « aucun fichier > 600 LOC » · 17 → 14 fichiers, 13 103 → 10 811 lignes

> **Remesuré le 2026-08-25 : 15 fichiers, 11 452 lignes.** Le budget a baissé de **1 651 lignes
> en deux jours**, alors que ces deux jours ont livré sept migrations et un système de permissions
> complet. C'est le résultat le plus net de tout cet audit : **le cliquet ne coûte pas de la
> vitesse, il en achète.**
>
> Classement au 2026-08-25 : `TaskTable` 1 124 · `PyramidTab` 1 045 · `AgendaPage` 900 ·
> `SettingsPage` 852 · `InboxMenu` 802 · `useTaskModal` 719 · `TasksPage` 712 ·
> `team-projects/local.repository` 710 · `DesktopDetailsStep` 703 · `TaskModalMobileBody` 697 ·
> `TeamTaskModal` 692 · `TeamTasksTab` 642 · `AuthContext` 626 · `TaskListsBar` 615 ·
> `MobileShowcases` 613.
>
> ⚠️ **Le nouveau plus gros fichier est `TaskTable.tsx` (1 124), et il n'a pas bougé de la
> journée.** Tant qu'on découpe l'entreprise, la dette du socle reste où elle est. La prochaine
> coupe utile n'est plus dans `/entreprise`.

### 4ᵉ passe (2026-08-27) : `TeamTasksTab` sort de la liste, et c'est la garde qui l'a imposé

> **14 fichiers, budget de garde 11 454 → 10 811.** `TeamTasksTab.tsx` passe de **651 à 573**
> lignes par extraction de `TeamTasksToolbar.tsx` (recherche, tri, création, filtres de statut),
> composant **purement présentationnel** : aucun état de filtre n'a bougé, il reste dans l'onglet
> qui sait ce qu'il filtre.
>
> **Le déclencheur n'est pas une intention de refactor.** Le correctif d'états de chargement
> (`1d98f93`) ajoutait 9 lignes à ce fichier déjà hors budget, le total passait à 11 463, la garde
> a refusé. La découpe a suivi. C'est la **quatrième** fois de suite que la séquence est
> identique : une feature ajoute quelques lignes à un gros fichier, le cliquet refuse la
> croissance nette, un découpage réel se fait. La garde ne demande jamais de refactor, elle rend
> le refactor moins cher que le contournement.
>
> Classement au 2026-08-27, mesuré : `TaskTable` 1 124 · `PyramidTab` 1 045 · `AgendaPage` 900 ·
> `SettingsPage` 852 · `InboxMenu` 802 · `useTaskModal` 719 · `TasksPage` 712 ·
> `team-projects/local.repository` 710 · `DesktopDetailsStep` 703 · `TaskModalMobileBody` 697 ·
> `TeamTaskModal` 692 · `AuthContext` 626 · `TaskListsBar` 615 · `friends/supabase.repository` 600.
>
> ⚠️ **`TaskTable.tsx` (1 124) n'a toujours pas bougé**, troisième journée consécutive. Les quatre
> passes du cliquet ont toutes porté sur `/entreprise`, parce que c'est là que le travail a lieu.
> **La dette du socle ne baisse pas toute seule** : le cliquet empêche la croissance, il ne
> désigne pas la prochaine coupe utile. Celle-ci reste `TaskTable`.

### 3ᵉ passe (2026-08-24) : le plus gros fichier du dépôt n'est plus `PyramidTab`

> Ses 385 lignes
> de `NodeCard` (le rendu récursif d'une carte de l'organigramme) sont parties dans
> `PyramidNodeCard.tsx` : **1 506 → 1 046**. Budget total : 11 915 → **11 454**.
>
> La coupe suit une frontière réelle, pas un compte de lignes : d'un côté le rendu
> D'UNE carte, de l'autre l'orchestration de l'arbre (recherche, repli,
> glisser-déposer, sheets). Aucune logique n'a changé, et la pyramide a été vérifiée
> dans le navigateur après extraction (6 membres, pastilles d'équipe, non-placés).
>
> ⚠️ **Le découpage n'est pas fini, il est commencé.** `PyramidTab` reste hors budget
> à 1 046 lignes. La suite naturelle est d'extraire le glisser-déposer dans un hook —
> c'est la moitié de ce qui reste, et la seule partie qui décide vraiment quelque chose.

### Historique

> **Le cliquet a servi le jour même.** Le correctif de scalabilité (mig. 113) ajoutait du
> commentaire à `team-projects/supabase.repository.ts` (601 lignes, donc dans la liste) : le
> budget a refusé la croissance nette, et la découpe a suivi — les mappers de lignes brutes sont
> partis dans `supabase.mappers.ts`, le fichier est tombé à **483**. Nouveau total :
> **16 fichiers, 12 503 lignes** (contre 17 / 13 103).
>
> C'est exactement le comportement recherché : la garde ne demande pas de refactor, elle rend le
> refactor moins cher que le contournement. `PyramidTab.tsx` (1 507) reste entier.

### Le diagnostic d'origine

**Au 2026-08-24 : 15 fichiers dépassent 600 lignes** (13 au 2026-08-14), le plus gros à
**1 505** (`src/components/organization/PyramidTab.tsx`, +50 lignes en dix jours), suivi de
`TaskTable.tsx` (1 124, **+147**), `AgendaPage.tsx` (900) et `SettingsPage.tsx` (857).
La liste complète au 2026-08-24 compte quatre fichiers `src/components/organization/`
(`PyramidTab` 1 505, `TeamTaskModal` 672, `TeamProjectsTab` 602) et
`src/modules/team-projects/local.repository.ts` (706) : la croissance vient de la vague
entreprise.

Le refactor de juin 2026 avait ramené le maximum sous 600 et la règle avait été inscrite comme
acquise. Elle a cédé pendant la construction du mode entreprise, sans que rien ne le signale —
aucune garde automatique ne mesure la taille des fichiers.

Coût réel, mesuré ailleurs dans cette série d'audits : ces fichiers alimentent le chunk `index`
(438 kB, cf. [`PERFORMANCE.md`](./PERFORMANCE.md)) et rendent chaque intervention plus chère à
charger en contexte.

**Correction, moitié faite le 2026-08-24.** La garde CI demandée ici existe désormais
(`src/architecture.guard.test.ts`) et pose un **cliquet** en deux temps :

- aucun **nouveau** fichier ne dépasse 600 lignes ;
- le **total** des 17 fichiers déjà hors budget (13 103 lignes) ne remonte jamais.

Le budget en total plutôt que par fichier est délibéré : il autorise à déplacer du code entre deux
gros fichiers pendant un refactor, tout en interdisant la croissance nette. Un troisième test
interdit à la liste de garder un fichier assaini — sans lui, un découpage libérerait de la place
pour un futur dépassement, et le cliquet reprendrait du mou en silence.

Ce que la garde ne fait PAS : découper `PyramidTab.tsx`. C'est un chantier, pas un correctif, et
il reste entier. Mais l'hémorragie s'arrête ici — les 17 fichiers de la liste sont tous arrivés
« juste au-dessus ».

> Le comptage manuel s'est trompé une troisième fois dans cet audit : `friends/supabase.repository.ts`
> (601 lignes) manquait à la liste écrite à la main. C'est l'argument du fichier de garde, pas une
> anecdote — **une règle mesurée à la main mesure ce à quoi on a pensé.**

## 4. 🟡 Code livré sans consommateur — un motif récurrent

Le dépôt accumule des primitives et des hooks livrés puis jamais adoptés :

| Élément | Consommateurs |
|---|---|
| ~~`useMessages` (`src/modules/user`)~~ | ✅ **supprimé le 2026-08-24** — avec `useUser`, `useWatchAd` et `useUpdateUserSettings` : tout le module sauf le type `User` |
| ~~`useTasksInfinite`~~ | ✅ **supprimé le 2026-08-25** : la marche à suivre est restée en commentaire à sa place (cf. [`SCALABILITY.md`](./SCALABILITY.md) §5). `getPage()` est **conservé** : capacité d'interface implémentée et testée sur tous les modules |
| **`MobileHeader`** | ✅ **2 → 8 le 2026-08-25** : les 6 pages migrées (cf. [`MOBILE.md`](./MOBILE.md) §2) |
| `MobileScreen`, `ListRow` (`src/components/mobile`) | **0** (cf. [`MOBILE.md`](./MOBILE.md)) |
| `TouchTarget` | 2 |
| `BottomSheet`, `Segmented` | 2 chacun, mais 16 fichiers importent une variante de feuille (cf. [`MOBILE.md`](./MOBILE.md) §3) |

Ce n'est pas grave pris isolément, mais c'est un **motif** : on construit la brique générique, on
migre la première page en vitrine, et la migration s'arrête là. Le coût n'est pas le code mort
lui-même — c'est que la doc décrit alors une architecture qui n'existe pas.

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
> ⚠️ `MobileScreen` et `ListRow` sont toujours à **0**, un mois après le constat.

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

C'est la seule dérive détectée. `npm run check:drift` reste l'outil de référence avant tout
déploiement comportant une migration.

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

# Dette de taille
git ls-files 'src/**/*.tsx' 'src/**/*.ts' | xargs wc -l | awk '$1>600 && $2!="total"'

# Code sans consommateur (remplacer <nom>)
grep -rl "<nom>" src --include="*.tsx" --include="*.ts" | grep -v "définition"

# Gardes
npm run check:rls && npm run validate:migrations && npm run check:drift
```
