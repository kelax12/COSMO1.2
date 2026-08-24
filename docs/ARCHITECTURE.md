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
| **Jamais de `supabase.from()` hors d'un repository** | `SCALABILITY.md` §5 | ❌ **Violé** — voir §2 (toujours le seul `SettingsPage.tsx`) |
| Imports toujours via l'alias `@/` | CLAUDE.md + ESLint | ✅ **Tenu depuis le 2026-08-24** — 74 imports relatifs réécrits, et la convention est désormais **outillée** (`no-restricted-imports`), donc elle ne peut plus se diluer en silence (§2) |
| Aucun fichier source > 600 LOC | refactor de juin 2026 | ❌ **Violé, et ça empire** — 13 fichiers au 2026-08-14, **15** au 2026-08-24 (§3) |
| Suite unitaire verte | `TESTING.md` | ✅ **Rétablie le 2026-08-24** — 1560/1560 (cf. [`TESTING.md`](./TESTING.md)) |

Les invariants qui portent la **sécurité** et la **performance** tiennent tous.

Au 2026-08-24, deux des quatre violations sont refermées — et c'est le **même** geste qui les a
refermées : leur donner un outil. La convention d'import est passée de 1 à 6 entorses en dix jours
tant qu'elle ne vivait que dans un Markdown ; elle est réglée en une règle ESLint. Restent
`supabase.from()` hors repository (§2, une seule page) et les fichiers > 600 LOC (§3) — les deux
seules dettes de ce tableau que **rien ne mesure encore**, et donc les deux seules qui continueront
de grandir. C'est le motif de fond de cet audit : *une règle qu'aucun script ne mesure recule à
chaque vague de features.*

## 2. 🟡 Deux entorses ponctuelles dans `SettingsPage`

`src/pages/SettingsPage.tsx` concentre les deux violations :

- **Lignes 288 et 315** : `await supabase.from('profiles')…` en direct depuis une page. La règle
  (« ne jamais appeler `supabase.from()` hors d'un repository ») n'est pas cosmétique : c'est elle
  qui garde le pattern repository comme unique frontière de données, donc qui rend une sortie de
  Supabase envisageable en jours plutôt qu'en mois.
- **Ligne 14** : `import { useUpdateUserSettings } from '../modules/user'` — chemin relatif au lieu
  de l'alias `@/`.

**Mise à jour du 2026-08-24 : ✅ réglé, et outillé.** Le comptage du 2026-08-14 (« 1 entorse »)
était faux par sous-mesure : il ne cherchait que `../modules`. En élargissant à `../lib`,
`../components`, `../pages`, `../i18n`, on trouvait **74 imports relatifs dans 29 fichiers**.

Tous réécrits en `@/…` (résolution mécanique du chemin, `tsc -b` vert), puis la convention rendue
**exécutable** par une règle ESLint `no-restricted-imports` — périmètre volontairement étroit :
seuls les chemins qui *remontent* pour atteindre `src/` sont interdits ; les imports relatifs
internes à un module (`./constants`, `./types`) restent légitimes, ce sont eux qui rendent un
module déplaçable.

La leçon n'est pas « il fallait corriger 74 lignes » : c'est que **la mesure elle-même était
fausse** tant qu'aucun outil ne la faisait. Un `grep` écrit à la main mesure ce à quoi on a pensé.

Reste la première entorse de cette section : `await supabase.from('profiles')…` en direct dans
`SettingsPage.tsx`. Non corrigée — elle demande de créer un chemin de repository, pas de déplacer
une ligne.

## 3. 🟠 L'objectif « aucun fichier > 600 LOC » n'est plus tenu

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

**Correction** : découper les trois plus gros, puis ajouter une garde CI (un simple `wc -l` sur
`src/**` qui échoue au-delà d'un seuil) — sans quoi la règle cédera à nouveau, comme l'échelle
z-index et les invariants RLS avant elle.

## 4. 🟡 Code livré sans consommateur — un motif récurrent

Le dépôt accumule des primitives et des hooks livrés puis jamais adoptés :

| Élément | Consommateurs |
|---|---|
| `useMessages` (`src/modules/user`) | **0** — et pourtant **documenté dans `CLAUDE.md`** comme API à utiliser |
| `MobileScreen`, `ListRow` (`src/components/mobile`) | **0** (cf. [`MOBILE.md`](./MOBILE.md)) |
| `useTasksInfinite` / `getPage` | **0** (cf. [`SCALABILITY.md`](./SCALABILITY.md) §5) |
| `MobileHeader`, `TouchTarget`, `BottomSheet`, `Segmented` | 2 chacun |

Ce n'est pas grave pris isolément, mais c'est un **motif** : on construit la brique générique, on
migre la première page en vitrine, et la migration s'arrête là. Le coût n'est pas le code mort
lui-même — c'est que la doc décrit alors une architecture qui n'existe pas.

> ⚠️ La ligne `import { useMessages } from '@/modules/user'` de `CLAUDE.md` décrit un hook que
> personne n'appelle. Elle a survécu à la réécriture documentaire du 2026-08-14 parce que j'ai
> vérifié que le fichier existait, pas qu'il servait. **Vérifier l'existence ne suffit pas ;
> il faut vérifier l'usage.**

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
