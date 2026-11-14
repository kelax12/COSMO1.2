# Modules · règles transversales

**Quand lire** : en touchant `src/modules/**`. Carte module → fichiers, tables, RPC : [`docs/MODULES.md`](../../docs/MODULES.md) ; nombre de modules : [`docs/FAITS.md`](../../docs/FAITS.md). **Fait foi** : le code.
Par module : [billing](billing/CLAUDE.md) · [tasks](tasks/CLAUDE.md) · [habits](habits/CLAUDE.md) · [okrs](okrs/CLAUDE.md) · [categories](categories/CLAUDE.md) · [team-categories](team-categories/CLAUDE.md) · [organizations](organizations/CLAUDE.md) · [team-projects](team-projects/CLAUDE.md).

## Double mode

- ✅ Démo : pas de Supabase, `localStorage` ; automatique sans env vars ou via `loginDemo()`. Production : Supabase si les deux env vars existent.
- ✅ `src/lib/app-mode.store.ts` : `appModeStore.isDemo`, `appModeStore.setDemo(bool)`, `useIsDemo()`.
- ✅ Repositories choisis par `src/lib/repository.factory.ts` (`getTasksRepository()`, …, `resetRepositories()`, `clearDemoStorage()`).
- ❌ Dériver `isDemo` de l'email. ❌ Appeler `login(email, password)` pour l'utilisateur démo.

`loginDemo()` (`AuthContext.tsx`, transitions dans `auth/demo-session.ts`), dans cet ordre : `clearDemoStorage()` → `appModeStore.setDemo(true)` → `resetRepositories()` → `queryClient.clear()` → `setUser({ id: 'demo-user', … })` → `setIsLoading(false)`.

- ❌ `navigate('/dashboard')` après `loginDemo()` sans `setTimeout(…, 0)` : `ProtectedRoute` doit voir `setUser()` commité.
- ❌ Modifier un seed sans `clearDemoStorage()` avant. Seeds dans le `local.seed.ts` du module, rechargés à chaque `loginDemo()` ; ❌ `Math.random()` (utiliser `generateCompletions`, dates relatives).
- ❌ Muter `DEMO_FRIENDS` / `DEMO_INCOMING_REQUESTS` en place : `JSON.parse(JSON.stringify(...))` (B12).

## Forme d'un module (garde `src/architecture.guard.test.ts` § 3)

```
src/modules/{module}/
├── types.ts · constants.ts  # types ; clés React Query + clés localStorage
├── repository.ts            # interface I{Module}Repository et ses types, RIEN qui s'exécute
├── local.repository.ts      # classe démo (localStorage), helpers `local.*.ts`
├── local.seed.ts            # jeu de données démo, sans lecture ni écriture de stockage
├── supabase.repository.ts   # classe Supabase
├── hooks.ts                 # hooks React Query (via le factory)
└── index.ts                 # surface publique ; n'exporte JAMAIS la classe démo
```

- ✅ Facette (`governance`, `roles`, `execution`) : même forme préfixée (`governance.local.repository.ts`). Un seul backend : `supabase.repository.ts` seul (`admin`).
- ✅ Instanciation **uniquement** par `defineRepository(démo, production)` (`src/lib/define-repository.ts`), côté démo toujours `lazy` depuis `src/lib/demo-repositories.ts`. ❌ Import statique d'un `local.repository` / `local.seed` hors fichiers démo et tests.
- ✅ Hors forme (dépôts-fonctions à deux modes) : `follows`, `messages`, `audience`, `inbox`, `notifications`, `member-activity`, `share-link`, `profile`, `billing`.
- 🔴 Un baril importé pour un TYPE s'importe en `import type` (`npm run check:cycles`, C-103).
- ✅ Import par zone : Tâches `tasks` `categories` `lists` · Agenda `events` `tasks` · Habitudes `habits` `categories` · OKR `okrs` `kr-completions` · Amis `friends` · Entreprise `organizations` `org-teams` `org-config` `org-reports` `team-projects` `team-okrs` `team-categories` `team-lists` · UI `ui-states` · Dashboard `tasks` `habits` `events` `kr-completions` `okrs` `auth`.

## Auth

- ✅ `import { useAuth } from '@/modules/auth/AuthContext'` (`user, isAuthenticated, isDemo, isLoading, login, logout, register, loginWithGoogle, updateDemoProfile`). ❌ Depuis `@/modules/user`.
- ✅ `updateDemoProfile(patch)` est le SEUL chemin pour modifier le profil en démo (`name`, `email`, `avatar`, `autoValidation`, whitelistés) ; no-op hors démo (`supabase.auth.updateUser`). ❌ Écrire dans `localStorage` en espérant que l'écran suive (faille B7).

## Lecture : RPC, jamais la table

Les policies RLS de `tasks`, `team_tasks`, `team_projects`, `team_task_dependencies`, `events` sont des prédicats non indexables : lire la table force un `Seq Scan` dont le coût suit le volume de TOUTE la plateforme.

```typescript
supabase.from('tasks').select(...)                              // ❌
supabase.rpc('get_my_tasks')                                    // ✅ mig. 085
supabase.rpc('get_my_team_tasks',             { p_org: orgId }) // ✅ mig. 113
supabase.rpc('get_my_team_projects',          { p_org: orgId }) // ✅ mig. 113
supabase.rpc('get_my_team_task_dependencies', { p_org: orgId }) // ✅ mig. 117
```

- ✅ Le périmètre vient de `auth.uid()` seul ; `p_org` est un filtre (un `p_org` étranger rend 0 ligne).
- ❌ Un prédicat de policy qui dépend d'un argument pris dans la ligne (helper sans argument : une fois par requête ; sur colonne : par ligne).
- ❌ Une table entreprise sur le modèle prédicat-fonction : l'appartenance en jointure indexable dans une RPC.
- ✅ Le mode `SECURITY` d'une RPC se lit dans [`supabase/rpc-inventory.md`](../../supabase/rpc-inventory.md) (généré), jamais ici. Règle : agrégats de lecture en `INVOKER` (la RLS filtre) ; lectures indexables `get_my_tasks` et `get_my_team_*` en `DEFINER`, périmètre tiré de `auth.uid()` ou `my_team_project_ids()` seuls (mig. `243`).
- ❌ Un prédicat de visibilité réécrit dans une RPC. ❌ Un agrégat d'**autorisations** en `DEFINER`. Témoin : `e2e/rls/regle-unique-projet.test.ts`.
- ✅ Exceptions : `getById` (clé primaire) ; `task_dependencies` (mig. 132, colonne dénormalisée, indexable).
- Mesures et plans : [`docs/PERFORMANCE.md`](../../docs/PERFORMANCE.md) § « Chemins de lecture indexables » ; [`docs/SCALABILITY.md`](../../docs/SCALABILITY.md).

## Synchronisation : Realtime, pas sondage

- 🔴 Trois canaux, montés UNE fois dans `App.tsx` : `useSharedTasksRealtime` (`shared_tasks`), `useOrgInboxRealtime` (mig. 118), `useFriendsInboxRealtime` (mig. 120). ❌ Un canal dans un composant de page (un WebSocket par écran).
- ❌ Un `refetchInterval` « pour être sûr » : chaque tick est une requête pour tout le monde. Une donnée qui doit se rafraîchir passe par Realtime ; sinon `refetchOnWindowFocus`. ❌ Remonter la cadence d'un sondage (chaque tick = `getAll()` complet).
- ✅ Les seuls `refetchInterval` autorisés, tous non permanents : `organizations/hooks.ts` `useOrgMembers` (`live`) · `team-projects/hooks.ts` `useTeamTasks` (`live`) · `team-okrs/hooks.ts` `useTeamOKRs` (`live`) · `tasks/hooks.ts` `useTasks` (filet 5 min, seulement si collaboration active) · `billing/org-billing.hooks.ts` `useOrgSubscription` (1,5 s pendant 20 s au plus, retour de Stripe). Garde : `src/modules/polling.guard.test.ts`. ⚠️ Compter ne suffit pas : qualifier chacun.
- ⚠️ Une nouvelle table écoutée en Realtime entre dans la publication `supabase_realtime` ET passe en `REPLICA IDENTITY FULL` (sinon les DELETE ne portent que la clé primaire, les filtres client ne matchent jamais), cf. mig. 087.
- 🔴 `connect-src` doit porter `wss:` : sans lui les canaux sont coupés en prod sans signal, et plus aucun sondage ne rattrape.

## « Annuler » restaure l'identifiant (R-08)

```typescript
const { id: _id, ...rest } = snapshot;   // ❌ revient sous un NOUVEL id
restoreCategoryMutation.mutate(snapshot); // ✅ useRestoreX, id d'origine conservé
```

- ✅ `useRestoreX` existe pour `tasks`, `categories`, `events`, `lists`, `okrs`, `habits` (`habits/restore.hooks.ts`), commentaires de tâche d'équipe (`team-projects/restore-comment.hooks.ts`). Il passe l'id en SECOND argument de `create()`. Liste à recompter : `grep -rn "export const useRestore" src/`.
- 🔴 ❌ Un champ `id` dans l'input : un `id` forgé ouvre un oracle d'existence (23505 au lieu d'un succès). Contrat : `src/lib/restore-id.ts` ; garde `categories/supabase.repository.test.ts`.
- ✅ Restaurer un OKR ramène aussi son journal `kr_completions` → [`okrs/CLAUDE.md`](okrs/CLAUDE.md).

## Champs canoniques

- ❌ `habit.completedDates` : `habit.completions: Record<string, boolean>` (B5).
- ❌ `task.title` / `task.dueDate` / `task.isBookmarked` : `name` / `deadline` / `bookmarked` (B6). `task.status` n'est pas « terminée » : `completed` → [`tasks/CLAUDE.md`](tasks/CLAUDE.md).
- ❌ Un état d'abonnement sur `User` : il vient de `useBilling()` (ex-N5).
- ❌ Un collaborateur stocké par `friend.name` : `friend.id` (B6, B22).
