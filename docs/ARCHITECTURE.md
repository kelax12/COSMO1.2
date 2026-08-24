# Architecture — invariants, dette et vérification

**Audit du 2026-08-14, invariants remesurés le 2026-08-24** (colonne « 2026-08-24 » du tableau
§1). Mesuré contre le code de `main` et la prod. Remplace
[`archive/AUDIT-ARCHITECTURE-2026-08-07.md`](./archive/AUDIT-ARCHITECTURE-2026-08-07.md)
(20 correctifs, note 60→79), 77 commits plus tôt.

Ce document ne redécrit pas l'architecture — c'est le rôle de [`../CLAUDE.md`](../CLAUDE.md). Il
répond à une seule question : **les invariants qu'on s'est donnés tiennent-ils encore ?**

---

## 1. Les invariants, vérifiés un par un

| Invariant | Où il est écrit | État au 2026-08-24 |
|---|---|---|
| Les lectures de liste de `tasks` passent par `get_my_tasks()` | CLAUDE.md ⚡ | ✅ **Tenu.** Les 4 `.from('tasks')` de `supabase.repository.ts` restent `getById` (exception légitime), `insert`, `update`, `delete` |
| Aucun import GSAP hors de la landing | CLAUDE.md | ✅ **Tenu.** 0 import direct de `'gsap'` |
| `useAuth` vient de `@/modules/auth/AuthContext` | CLAUDE.md | ✅ **Tenu.** 0 import depuis `@/modules/user` |
| Une seule policy PERMISSIVE par rôle + action | mig. 049 + `check:rls` | ✅ **Tenu.** **120** policies sur **66** migrations, 0 violation |
| La récurrence est générée côté serveur | mig. 086 | ✅ Tenu |
| Un seul canal Realtime, monté dans `App.tsx` | CLAUDE.md 📡 | ✅ Tenu (1 seul `.channel()` dans tout `src/`) |
| Toutes les tables `public` ont RLS activée | `SECURITY.md` | ✅ **Tenu**, vérifié en prod le 2026-08-24 : 0 table avec `relrowsecurity = false` |
| **Jamais de `supabase.from()` hors d'un repository** | `SCALABILITY.md` §5 + garde | ✅ **Tenu depuis le 2026-08-24** — 4 fichiers assainis (et non 1 : le comptage manuel avait raté les trois autres), invariant désormais **outillé** (§2) |
| Imports toujours via l'alias `@/` | CLAUDE.md + ESLint | ✅ **Tenu depuis le 2026-08-24** — 74 imports relatifs réécrits, et la convention est désormais **outillée** (`no-restricted-imports`), donc elle ne peut plus se diluer en silence (§2) |
| Aucun fichier source > 600 LOC | refactor de juin 2026 + cliquet | ❌ **Toujours violé — 16 fichiers** (17 le matin même), mais l'hémorragie est **arrêtée** et le budget a **baissé** : 13 103 → 12 503 lignes (§3) |
| **Les lectures de liste entreprise passent par une RPC indexable** | CLAUDE.md ⚡ + test | ✅ **Tenu depuis le 2026-08-24** — `get_my_team_projects` / `get_my_team_tasks` (mig. 113). Verrouillé par `team-projects/supabase.repository.test.ts` |
| **Aucune position d'arrivée portée par une animation de transform** | CLAUDE.md + garde | 🟠 **17 feuilles encore écrites à la main**, mais les 5 réellement cassées sont corrigées et un cliquet interdit toute nouvelle (cf. [`MOBILE.md`](./MOBILE.md) §1) |
| Suite unitaire verte | `TESTING.md` | ✅ **1576/1576 au 2026-08-24** — après correctifs. Elle ne l'était PAS à l'ouverture de cette passe (cf. [`TESTING.md`](./TESTING.md)) |

Les invariants qui portent la **sécurité** et la **performance** tiennent tous.

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

## 3. 🟠 L'objectif « aucun fichier > 600 LOC » — 17 → 16 fichiers (2026-08-24)

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
| `MobileScreen`, `ListRow` (`src/components/mobile`) | **0** (cf. [`MOBILE.md`](./MOBILE.md)) |
| `useTasksInfinite` / `getPage` | **0** (cf. [`SCALABILITY.md`](./SCALABILITY.md) §5) |
| `MobileHeader`, `TouchTarget`, `BottomSheet`, `Segmented` | 2 chacun |

Ce n'est pas grave pris isolément, mais c'est un **motif** : on construit la brique générique, on
migre la première page en vitrine, et la migration s'arrête là. Le coût n'est pas le code mort
lui-même — c'est que la doc décrit alors une architecture qui n'existe pas.

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

## 5. 🔴 Dérive repo ↔ prod

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
