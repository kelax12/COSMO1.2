# Architecture · invariants et leur garde

> **Quand lire** : avant de toucher un invariant transverse (`src/**` hors landing), `eslint.config.js`, `eslint-rules/`, `src/architecture.guard.test.ts`.
> **Fait foi** : les gardes nommées ci-dessous ; la description de l'architecture est dans [`../CLAUDE.md`](../CLAUDE.md). Mesures et récits passés : [`archive/ARCHITECTURE-etat-verifie-2026-08-14-au-2026-11-13.md`](./archive/ARCHITECTURE-etat-verifie-2026-08-14-au-2026-11-13.md).

## 1. Invariants

| Invariant | Garde |
|---|---|
| Les lectures de liste de `tasks` passent par `get_my_tasks()` ; `.from('tasks')` seulement pour `getById`, `insert`, `update`, `delete` | `src/modules/tasks/supabase.repository.test.ts`, `src/modules/CLAUDE.md` |
| Les lectures de liste entreprise passent par une RPC indexable (`get_my_team_projects`, `get_my_team_tasks`, `get_my_team_task_dependencies`) | `team-projects/supabase.repository.test.ts` |
| Aucun `supabase.from()` hors d'un `*.repository.ts` | `src/architecture.guard.test.ts` (§ 2) |
| Imports toujours par l'alias `@/` | ESLint `no-restricted-imports` (§ 2) |
| `gsap` seulement par `@/lib/gsap`, dans la landing | `src/pages/landing/CLAUDE.md` |
| `useAuth` vient de `@/modules/auth/AuthContext` | `src/CLAUDE.md` |
| Une seule policy PERMISSIVE par rôle et action (mig. `049`) | `npm run check:rls` |
| Toutes les tables `public` sont sous RLS | `npm run check:rls`, [`FAITS.md`](./FAITS.md) |
| La récurrence est générée côté serveur (mig. `086`) | `src/modules/tasks/CLAUDE.md` |
| Les canaux Realtime sont montés une fois, dans `App.tsx` | `src/CLAUDE.md` |
| Aucun `refetchInterval` permanent | [`SCALABILITY.md`](./SCALABILITY.md) |
| Un droit entreprise se lit dans `permissions.ts` (`useMyOrgPermissions`), miroir du SQL, jamais recalculé | `src/modules/organizations/CLAUDE.md` |
| Aucune position d'arrivée portée par une animation de `transform` | [`MOBILE.md`](./MOBILE.md) |
| `isDemoMode` / `setDemoMode` ne sont pas exportés : `appModeStore` est la source unique | `src/lib/app-mode.store.test.ts`, `src/modules/CLAUDE.md` |
| Fonctions sous les seuils de complexité, aucun fichier au-delà de 1 000 lignes | § 3 |
| Aucun hook exporté de `src/modules` sans consommateur | `src/modules/orphan-hooks.guard.test.ts` (§ 4) |
| Aucun cycle d'imports | `npm run check:cycles` |

🔴 Une règle qu'aucun script ne mesure recule à chaque vague de fonctionnalités : un invariant sans garde se dote d'une garde, il ne s'écrit pas plus fort.

### 1.1 Fuseau des habitudes : divergence gelée

- ⚠️ Échéances de tâches : `src/lib/timezone.ts` (`dayKeyInTz`), préférence de fuseau. Clés de `habits.completions` et séries : `toLocaleDateString('en-CA')`, fuseau de la machine. Les deux divergent en réglage `manual` hors du fuseau de la machine.
- ❌ Ne pas migrer les clés d'habitudes : la base ne connaît que la préférence courante, pas le fuseau de chaque jour passé ; une journée décalée casse une série et `streak_best`.
- ❌ Ne jamais corriger une seule moitié : afficher en `dayKeyInTz` en écrivant en date machine décalerait les jours cochés d'une case.
- ✅ La question se rouvre avec une colonne qui enregistre le décalage au moment de la complétion. Rien ne l'écrit aujourd'hui.

## 2. Accès aux tables et imports

- ❌ `supabase.from(` hors d'un `*.repository.ts` : `src/architecture.guard.test.ts` refuse, commentaires retirés avant la recherche.
- ❌ Un import relatif qui remonte vers `src/` (`../lib`, `../modules`…) : ESLint `no-restricted-imports`. ✅ Un import relatif interne à un module (`./types`) reste permis : il rend le module déplaçable.
- ⚠️ `fetchOwnSubscriptionRow()` (`billing.repository.ts`) duplique `getSubscription()` exprès : `getSession()` local au lieu de `getCurrentUser()` (un aller-retour par appel), et `null` au lieu d'une exception, dans un provider monté sur tout l'écran.
- ⚠️ Le branchement démo des notifications d'organisation reste dans les hooks : il lit `localStorage`, pas une table.

## 3. Taille et complexité

- 🔴 Seuils ESLint (`eslint.config.js`, périmètre de `architecture.guard`) : `complexity` 20, `max-depth` 4, `max-lines-per-function` 200.
- 🔴 Ligne de base : `eslint-rules/complexite.baseline.json`, chaque fichier plafonné à sa pire valeur. `eslint-rules/complexite.guard.test.mjs` relint ces fichiers au seuil commun et exige exactement la ligne de base : une valeur qui monte ou une fonction de plus est rouge ; une valeur qui baisse aussi, tant qu'elle n'est pas recopiée dans le JSON.
- ❌ Jamais un fichier ajouté à la ligne de base, jamais une valeur relevée : un dépassement se règle en découpant la fonction.
- ✅ Découper dans l'ordre des pires valeurs de la ligne de base, en revue humaine, le long d'une frontière réelle (un geste, une surface, une dérivation), jamais à la valeur près pour passer sous un seuil.
- 🔴 Plafond de fichier : 1 000 lignes dans `src/architecture.guard.test.ts`, liste d'exceptions vide. ❌ Ne pas le rabaisser à 600 : la barre tassait le code sous elle au lieu de le simplifier.
- ⚠️ Couplage rapporté, pas bloquant (`npm run check:cycles` imprime fan-in et fan-out) : les plus forts sont des façades voulues. ❌ Pas d'`eslint-plugin-import` pour une mesure (en-tête de `scripts/check-import-cycles.mjs`).

## 4. Code sans consommateur

- 🔴 Un code sans consommateur n'est pas éprouvé : l'adopter ou le supprimer, ❌ jamais « on garde, ça resservira ».
- ✅ `src/modules/orphan-hooks.guard.test.ts` refuse un hook exporté que rien ne monte.
- ⚠️ Une mention en commentaire n'est pas un appel : retirer les commentaires avant tout balayage.
- ⚠️ Un hook appelé par un autre hook du même fichier n'est pas orphelin. Une liste de noms sans consommateur direct n'est pas une liste de suppressions sûres.
- ⚠️ Un test vert sur un composant que rien ne monte ne prouve que sa propre cohérence : testé n'est pas éprouvé.
- ⚠️ Un hook écrit mais absent du barrel (`index.ts`) est inatteignable : à l'ajout, vérifier qu'une autre zone peut l'importer.
- ❌ Ne jamais conclure qu'un nom sert parce que son fichier existe : vérifier l'usage.

## 5. Dépôt et production

- 🔴 Après une migration appliquée, la preuve est la relecture au catalogue de l'objet créé ; `npm run check:migration-coverage` (quotidien) refuse un fichier dont aucun objet n'existe en prod → `supabase/migration/CLAUDE.md`.
- ⚠️ Avant de citer un marqueur ✅ 🔴 d'un doc, revérifier le fait : un titre survit souvent au constat.

## Refaire la vérification

```bash
grep -rn "from('tasks')" src/modules/tasks/supabase.repository.ts   # getById, insert, update, delete seulement
grep -rln "supabase.from(" src --include="*.tsx" | grep -v repository
grep -rln "from 'gsap'" src | grep -v lib/gsap
grep -rn "useAuth.*from '@/modules/user'" src
npm run lint && npx vitest run eslint-rules/complexite.guard.test.mjs src/architecture.guard.test.ts
npm run check:cycles && npm run check:rls && npm run validate:migrations
```
