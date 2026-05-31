# Remove `tasks.collaborators[]` — Single Source of Truth via `shared_tasks`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the denormalized `tasks.collaborators[]` array so that `shared_tasks` becomes the single source of truth for who a task is shared with, removing the structural desync that caused shared tasks to be invisible to recipients.

**Architecture:** The owner side currently reads collaborators from `tasks.collaborators[]` (a `TEXT[]` column) while RLS and the recipient side already rely on the `shared_tasks` table. We drop the column, expose the grant rows through two new repository reads (`getTaskShares(taskId)` for a single task's collaborator manager, `getMyTaskShares()` for list-view avatar badges), surface them via React Query hooks, and rewrite every owner-side consumer to derive collaborators from those hooks. The denormalized boolean `tasks.is_collaborative` is **kept** as a cheap owner-maintained hint, and `tasks.pending_invites` / `tasks.collaborator_validations` are **kept** (they carry independent meaning — pending email invites that have no `auth.users` row yet, and per-collaborator validation state). Demo mode already persists `shared_tasks` in localStorage, so parity costs only the two new read methods.

**Tech Stack:** React 18 + TypeScript 5.5 (strict) · Vite 5 · TanStack Query 5 · Supabase (Postgres + RLS) · localStorage demo repos · Sonner.

**Testing reality for this repo:** There is **no active unit-test runner** (Vitest is dormant, ESLint-ignored; only Playwright E2E + axe run). So the "write a failing unit test first" ritual does not apply. The equivalent fast feedback loop here is the **TypeScript strict compiler** (`npx tsc --noEmit`) — dropping `collaborators` from the `Task` type makes every stale reader a compile error, which is exactly the safety net we want. Each task therefore uses: (1) make the change, (2) `npx tsc --noEmit` to surface/confirm breakage, (3) `npm run lint`, (4) commit. End-to-end behavior is verified manually (cross-account + demo) and via Playwright in the final task.

**Pre-flight (run once before Task 1):**
- `git status` must be clean or contain only the already-reviewed sharing fixes. This plan assumes migration `027_shared_tasks_friendship_check.sql` and the `enrichSharedBy` fix are already applied.
- Confirm you are on a dedicated branch: `git checkout -b chore/remove-collaborators-column`.

---

## File Map

| File | Change |
|---|---|
| `supabase/migration/028_drop_tasks_collaborators.sql` | **Create** — backfill `shared_tasks` from `collaborators`, drop the `ANY(collaborators)` policy, drop the column |
| `src/modules/friends/types.ts` | **Modify** — add `TaskShare` interface |
| `src/modules/friends/repository.ts` | **Modify** — add `getTaskShares` / `getMyTaskShares` to interface + LocalStorage impl |
| `src/modules/friends/supabase.repository.ts` | **Modify** — implement `getTaskShares` / `getMyTaskShares` |
| `src/modules/friends/constants.ts` | **Modify** — add `taskShares(taskId)` and `myTaskShares()` query keys |
| `src/modules/friends/hooks.ts` | **Modify** — add `useTaskShares`, `useMyTaskShares`, `useSharesByTask`; invalidate on share/unshare |
| `src/modules/friends/index.ts` | **Modify** — export the new hooks + `TaskShare` type |
| `src/modules/tasks/types.ts` | **Modify** — remove `collaborators` from `Task` |
| `src/modules/tasks/supabase.repository.ts` | **Modify** — drop `collaborators` from `TaskRow`/`TaskDbInput`/`mapFromDb`/`mapToDb` |
| `src/modules/tasks/local.repository.ts` | **Modify** — drop `collaborators` from mapping/seed |
| `src/components/CollaboratorAvatars.tsx` | **Modify** — prop rename `collaborators` → `collaboratorIds` (semantic clarity); logic unchanged |
| `src/components/TodayTasks.tsx` | **Modify** — feed avatars from `useSharesByTask` |
| `src/components/TaskSidebar.tsx` | **Modify** — feed avatars from `useSharesByTask` |
| `src/components/TaskTable.tsx` | **Modify** — owner "Collaboratif" badge keyed on `isCollaborative` only |
| `src/components/CollaboratorModal.tsx` | **Modify** — derive assigned list from `useTaskShares`; add/remove via share/unshare |
| `src/components/TaskModal.tsx` | **Modify** — init collaborator selection from `useTaskShares`; save via share/unshare diff |
| `src/components/AddTaskForm.tsx` | **Modify** — stop writing `collaborators` to the task; keep post-create `shareTask` loop |
| `src/components/CollaborativeTasks.tsx` | **Modify** — display counts/avatars from `useMyTaskShares`; delegate management to `CollaboratorModal`; delete by-name handlers |

---

## Task 1: DB migration — backfill, drop policy, drop column

**Files:**
- Create: `supabase/migration/028_drop_tasks_collaborators.sql`

**Context:** Postgres refuses `DROP COLUMN` while a policy references it. The legacy SELECT policy `"Collaborators can read collaborative tasks"` (migration `001_tasks.sql:46-48`) uses `auth.uid()::text = ANY(collaborators)`; it is fully superseded by `"Collaborators can read shared tasks"` (migration `019`, via `shared_tasks`), so dropping it is safe. We backfill any collaborator id that is a real `auth.users.id` into `shared_tasks` first, so no existing share is lost.

- [ ] **Step 1: Write the migration**

```sql
-- ═══════════════════════════════════════════════════════════════════
-- 028 — Retire la colonne redondante tasks.collaborators
-- ═══════════════════════════════════════════════════════════════════
--
-- `shared_tasks` est désormais l'UNIQUE source de vérité du partage de
-- tâches. La colonne `tasks.collaborators` (TEXT[]) la dupliquait côté
-- propriétaire et se désynchronisait (cause racine du bug « tâche partagée
-- invisible » : collaborators rempli mais aucune ligne shared_tasks).
--
-- On garde `tasks.is_collaborative` (hint dénormalisé maintenu côté owner),
-- `tasks.pending_invites` (invitations email sans auth.users encore) et
-- `tasks.collaborator_validations` (état de validation par collaborateur).
-- ═══════════════════════════════════════════════════════════════════

-- 0) Garantit l'index unique requis par l'upsert applicatif ET le ON CONFLICT
--    ci-dessous (shareTask() utilise onConflict: 'task_id,friend_id').
CREATE UNIQUE INDEX IF NOT EXISTS ux_shared_tasks_task_friend
  ON public.shared_tasks (task_id, friend_id);

-- 1) Backfill défensif : matérialise dans shared_tasks toute entrée
--    `collaborators` qui est un vrai auth.users.id (UUID existant) et qui
--    n'a pas encore de ligne. Les emails non résolus restent dans
--    pending_invites (intentionnellement non migrés — pas de FK possible).
INSERT INTO public.shared_tasks (task_id, friend_id, shared_by, role)
SELECT t.id, c.collab::uuid, t.user_id, 'editor'
FROM public.tasks t
CROSS JOIN LATERAL unnest(t.collaborators) AS c(collab)
WHERE c.collab ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.collab::uuid)
ON CONFLICT (task_id, friend_id) DO NOTHING;

-- 2) Drop la policy legacy qui référence la colonne (sinon DROP COLUMN échoue).
--    La lecture destinataire passe déjà par « Collaborators can read shared
--    tasks » (migration 019, basée sur shared_tasks).
DROP POLICY IF EXISTS "Collaborators can read collaborative tasks" ON public.tasks;

-- 3) Drop la colonne redondante.
ALTER TABLE public.tasks DROP COLUMN IF EXISTS collaborators;
```

- [ ] **Step 2: Apply to a Supabase preview branch first (not prod)**

Use the MCP Supabase tooling to create a dev branch and apply the migration there, OR run against a throwaway branch. Apply with `mcp__supabase__apply_migration` (name `028_drop_tasks_collaborators`).
Expected: success, no error about a policy depending on the column.

- [ ] **Step 3: Verify the column is gone and shares survived**

Run (via `mcp__supabase__execute_sql`, one statement at a time):
```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='tasks' AND column_name='collaborators';
```
Expected: **0 rows**.
```sql
SELECT count(*) FROM public.shared_tasks;
```
Expected: ≥ the pre-migration count (backfill only adds, never removes).

- [ ] **Step 4: Confirm no new security advisors**

Run `mcp__supabase__get_advisors` (type `security`).
Expected: no **new** warnings versus the baseline from migration 027.

- [ ] **Step 5: Commit**

```bash
git add supabase/migration/028_drop_tasks_collaborators.sql
git commit -m "feat(db): drop redundant tasks.collaborators column (028)

shared_tasks is now the single source of truth for task sharing.
Backfills shared_tasks from collaborators, drops the legacy
ANY(collaborators) SELECT policy, then drops the column."
```

> **Do NOT apply to production yet.** Production apply happens in Task 11 after the client no longer reads the column, to avoid a window where the deployed client queries a dropped column.

---

## Task 2: Add the `TaskShare` type

**Files:**
- Modify: `src/modules/friends/types.ts`

- [ ] **Step 1: Add the interface** after the `ShareTaskInput` interface (end of file, before nothing else depends on order):

```ts
/**
 * A single sharing grant, as stored in `shared_tasks` (Supabase) or the
 * `cosmo_shared_tasks` localStorage map (demo). This is the owner-side
 * read model that replaces the removed `tasks.collaborators[]` array.
 */
export interface TaskShare {
  taskId: string;
  /** Recipient's auth.users.id (Supabase) or friend.id (demo). */
  friendId: string;
  role: 'viewer' | 'editor';
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors).

- [ ] **Step 3: Commit**

```bash
git add src/modules/friends/types.ts
git commit -m "feat(friends): add TaskShare read-model type"
```

---

## Task 3: Repository — read methods for shares

**Files:**
- Modify: `src/modules/friends/repository.ts` (interface + LocalStorage impl)
- Modify: `src/modules/friends/supabase.repository.ts` (Supabase impl)

- [ ] **Step 1: Extend the interface** in `repository.ts`. Add to `interface IFriendsRepository`, in the `// Task sharing operations` block, after `unshareTask(...)`:

```ts
  // Task sharing — read model (owner side)
  getTaskShares(taskId: string): Promise<TaskShare[]>;
  getMyTaskShares(): Promise<TaskShare[]>;
```

- [ ] **Step 2: Import the type** at the top of `repository.ts` — extend the existing import:

```ts
import { Friend, FriendRequestInput, ShareTaskInput, PendingFriendRequest, TaskShare } from './types';
```

- [ ] **Step 3: Implement in `LocalStorageFriendsRepository`** — add after `unshareTask(...)` (the localStorage map is `{ [taskId]: { friendId, role }[] }`):

```ts
  async getTaskShares(taskId: string): Promise<TaskShare[]> {
    const map = JSON.parse(localStorage.getItem(SHARED_TASKS_STORAGE_KEY) || '{}');
    const entries: { friendId: string; role?: 'viewer' | 'editor' }[] = map[taskId] || [];
    return entries.map((s) => ({ taskId, friendId: s.friendId, role: s.role || 'viewer' }));
  }

  async getMyTaskShares(): Promise<TaskShare[]> {
    const map = JSON.parse(localStorage.getItem(SHARED_TASKS_STORAGE_KEY) || '{}');
    const out: TaskShare[] = [];
    for (const taskId of Object.keys(map)) {
      const entries: { friendId: string; role?: 'viewer' | 'editor' }[] = map[taskId] || [];
      for (const s of entries) {
        out.push({ taskId, friendId: s.friendId, role: s.role || 'viewer' });
      }
    }
    return out;
  }
```

- [ ] **Step 4: Implement in `SupabaseFriendsRepository`** — add after `unshareTask(...)`. Import `TaskShare`: extend the existing `import { Friend, ... } from './types';` line to include `TaskShare`. Then:

```ts
  async getTaskShares(taskId: string): Promise<TaskShare[]> {
    if (!supabase) throw new Error('Supabase not configured');
    // RLS `shared_tasks_select` lets the owner (shared_by) read these rows.
    const { data, error } = await supabase
      .from('shared_tasks')
      .select('task_id, friend_id, role')
      .eq('task_id', taskId);
    if (error) throw normalizeApiError(error);
    return (data || []).map((r) => ({
      taskId: r.task_id as string,
      friendId: r.friend_id as string,
      role: ((r.role as string) === 'editor' ? 'editor' : 'viewer'),
    }));
  }

  async getMyTaskShares(): Promise<TaskShare[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('shared_tasks')
      .select('task_id, friend_id, role')
      .eq('shared_by', user.id)
      .limit(500);
    if (error) throw normalizeApiError(error);
    return (data || []).map((r) => ({
      taskId: r.task_id as string,
      friendId: r.friend_id as string,
      role: ((r.role as string) === 'editor' ? 'editor' : 'viewer'),
    }));
  }
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/friends/repository.ts src/modules/friends/supabase.repository.ts
git commit -m "feat(friends): repository reads for task shares (single + mine)"
```

---

## Task 4: Query keys + hooks for shares

**Files:**
- Modify: `src/modules/friends/constants.ts`
- Modify: `src/modules/friends/hooks.ts`
- Modify: `src/modules/friends/index.ts`

- [ ] **Step 1: Add query keys** in `constants.ts`. Replace the `sharedTasks` line in the `friendKeys` object with these three (keeping `sharedTasks` as the invalidation prefix):

```ts
  sharedTasks: () => [...friendKeys.all, 'sharedTasks'] as const,
  taskShares: (taskId: string) => [...friendKeys.all, 'sharedTasks', 'task', taskId] as const,
  myTaskShares: () => [...friendKeys.all, 'sharedTasks', 'mine'] as const,
```

> Both nested keys start with `[...all, 'sharedTasks']`, so invalidating `friendKeys.sharedTasks()` (a prefix) refreshes them all.

- [ ] **Step 2: Add read hooks** in `hooks.ts`. Add to the READ HOOKS section (after `useSentFriendRequests`):

```ts
export const useTaskShares = (taskId: string | undefined) => {
  const repository = useFriendsRepository();
  return useQuery({
    queryKey: friendKeys.taskShares(taskId ?? ''),
    queryFn: () => repository.getTaskShares(taskId as string),
    enabled: !!taskId,
  });
};

export const useMyTaskShares = () => {
  const repository = useFriendsRepository();
  return useQuery({
    queryKey: friendKeys.myTaskShares(),
    queryFn: () => repository.getMyTaskShares(),
  });
};
```

- [ ] **Step 3: Add the derived grouping hook** in `hooks.ts`. Add to the DERIVED HOOKS section (after `usePendingRequestCount`). Import `TaskShare` — extend the existing `import type { Friend, FriendRequestInput, ShareTaskInput, PendingFriendRequest } from './types';` to include `TaskShare`:

```ts
/** Map of taskId -> friendIds shared with, for list-view avatar badges. */
export const useSharesByTask = (): Map<string, string[]> => {
  const { data: shares = [] } = useMyTaskShares();
  return useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of shares as TaskShare[]) {
      const arr = m.get(s.taskId) ?? [];
      arr.push(s.friendId);
      m.set(s.taskId, arr);
    }
    return m;
  }, [shares]);
};
```

- [ ] **Step 4: Invalidate `myTaskShares` on share/unshare.** In `useShareTask` and `useUnshareTask`, the `onSuccess` already calls `queryClient.invalidateQueries({ queryKey: friendKeys.sharedTasks() })`. Because `taskShares`/`myTaskShares` keys are nested under `sharedTasks`, this prefix-invalidation already covers them. **No change needed** — verify by reading the two hooks and confirming the `friendKeys.sharedTasks()` invalidation is present.

- [ ] **Step 5: Export the hooks + type** in `index.ts`. Add to the READ HOOKS export block:

```ts
  useTaskShares,
  useMyTaskShares,
  useSharesByTask,
```
And add `TaskShare` to the `export type { ... } from './types';` block at the top.

- [ ] **Step 6: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS, 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/modules/friends/constants.ts src/modules/friends/hooks.ts src/modules/friends/index.ts
git commit -m "feat(friends): hooks for task shares (useTaskShares/useMyTaskShares/useSharesByTask)"
```

---

## Task 5: Remove `collaborators` from the Task model + repos

> This is the breaking step. After it, `npx tsc --noEmit` lists **every** stale reader — Tasks 6–10 fix them one by one. Expect compile errors after this task; that is the intended signal, not a failure.

**Files:**
- Modify: `src/modules/tasks/types.ts`
- Modify: `src/modules/tasks/supabase.repository.ts`
- Modify: `src/modules/tasks/local.repository.ts`

- [ ] **Step 1: Remove the field** in `types.ts`. Delete line:

```ts
  collaborators?: string[];
```
from the `Task` interface. Leave `isCollaborative?`, `pendingInvites?`, `collaboratorValidations?` intact.

- [ ] **Step 2: Update `supabase.repository.ts`.** Remove `collaborators` from:
  - `interface TaskRow` — delete `collaborators?: string[];`
  - `interface TaskDbInput` — delete `collaborators?: string[];`
  - `mapFromDb` — delete the line `collaborators: row.collaborators || [],`
  - `mapToDb` — delete the line `if (input.collaborators !== undefined) result.collaborators = input.collaborators;`
  - In `getAll()`'s explicit `.select(...)` string, remove `collaborators,` from the column list.

- [ ] **Step 3: Update `local.repository.ts`.** Open the file and remove every `collaborators` reference: the seed/default (`collaborators: []` or similar in `mapFromDb`/seed task factory `t(...)`) and any `collaborators` key in its DB-shape mapping. Keep `pendingInvites` / `collaboratorValidations`. (Use the editor's find for `collaborators` within this file; there are no other array semantics to preserve.)

- [ ] **Step 4: Type-check to enumerate breakage**

Run: `npx tsc --noEmit`
Expected: **FAIL** with errors in `CollaboratorModal.tsx`, `TaskModal.tsx`, `AddTaskForm.tsx`, `CollaborativeTasks.tsx`, `TodayTasks.tsx`, `TaskSidebar.tsx`, `TaskTable.tsx`. Record the list — it is the worklist for Tasks 6–10.

- [ ] **Step 5: Commit (repos only; UI fixed next)**

```bash
git add src/modules/tasks/types.ts src/modules/tasks/supabase.repository.ts src/modules/tasks/local.repository.ts
git commit -m "refactor(tasks): drop collaborators from Task type and repos

Breaking change: collaborators is no longer on the task. Owner UI
must derive collaborators from shared_tasks (next commits)."
```

---

## Task 6: List-view avatars from shares (`CollaboratorAvatars`, `TodayTasks`, `TaskSidebar`)

**Files:**
- Modify: `src/components/CollaboratorAvatars.tsx`
- Modify: `src/components/TodayTasks.tsx`
- Modify: `src/components/TaskSidebar.tsx`

- [ ] **Step 1: Rename the prop for clarity** in `CollaboratorAvatars.tsx`. Change the prop `collaborators?: string[]` to `collaboratorIds?: string[]` in `CollaboratorAvatarsProps`, the destructure, and the three internal references (`if (!collaboratorIds ...`, `collaboratorIds.slice`, `collaboratorIds.length`). The matching-by-id logic (`f.userId === name || f.id === name || f.name === name`) is unchanged.

- [ ] **Step 2: Feed `TodayTasks`.** Add near the other hooks at the top of the `TodayTasks` component:

```tsx
import { useSharesByTask } from '@/modules/friends';
// ...
const sharesByTask = useSharesByTask();
```
Replace the usage (line ~195):
```tsx
<CollaboratorAvatars collaboratorIds={sharesByTask.get(task.id) ?? []} friends={friends} size="sm" />
```

- [ ] **Step 3: Feed `TaskSidebar`.** Same pattern. Add:
```tsx
import { useSharesByTask } from '@/modules/friends';
// ...
const sharesByTask = useSharesByTask();
```
Replace the usage (line ~230):
```tsx
<CollaboratorAvatars collaboratorIds={sharesByTask.get(task.id) ?? []} friends={friends} size="sm" />
```

> `CollaboratorAvatars` returns `null` when the array is empty, so tasks with no shares render nothing — same as before.

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: these three files no longer error (others may still error until Tasks 7–9).

- [ ] **Step 5: Commit**

```bash
git add src/components/CollaboratorAvatars.tsx src/components/TodayTasks.tsx src/components/TaskSidebar.tsx
git commit -m "refactor(ui): list-view collaborator avatars from shared_tasks"
```

---

## Task 7: `TaskTable` owner badge

**Files:**
- Modify: `src/components/TaskTable.tsx:308` and `:927`

**Context:** Two branches gate the owner "Collaboratif" indicator on `task.isCollaborative && (task.collaborators?.length ?? 0) > 0`. With `is_collaborative` now maintained as the authoritative owner flag (set true on first share, false when the last share is removed — Tasks 8/10), the array clause is redundant.

- [ ] **Step 1: Simplify both conditions.** At both `:308` (mobile card) and `:927` (desktop row), replace:
```tsx
) : task.isCollaborative && (task.collaborators?.length ?? 0) > 0 ? (
```
with:
```tsx
) : task.isCollaborative ? (
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: `TaskTable.tsx` clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/TaskTable.tsx
git commit -m "refactor(ui): TaskTable collaborative badge keyed on isCollaborative"
```

---

## Task 8: `CollaboratorModal` — manage via shares

**Files:**
- Modify: `src/components/CollaboratorModal.tsx`

**Context:** This is the canonical collaborator manager. It must now (a) read assigned collaborators from `useTaskShares(taskId)` instead of `task.collaborators`, (b) add by calling `shareTaskMutation` then setting `isCollaborative`, (c) remove by calling `useUnshareTask` then recomputing `isCollaborative`. `pendingInvites` (non-registered email invites) stays on the task. `collaboratorValidations` stays, keyed by `friendId`.

- [ ] **Step 1: Update imports/hooks.** Replace the friends import to add `useTaskShares` and `useUnshareTask`:
```ts
import { useFriends, useSendFriendRequest, useShareTask, useUnshareTask, useTaskShares } from '@/modules/friends';
```
Add inside the component, after `const shareTaskMutation = useShareTask();`:
```ts
const unshareTaskMutation = useUnshareTask();
const { data: shares = [] } = useTaskShares(taskId);
```

- [ ] **Step 2: Derive the assigned list from shares.** Replace:
```ts
const assignedCollaborators = task?.collaborators || [];
```
with:
```ts
// Registered collaborators come from shared_tasks; pending email invites
// (no auth.users row yet) still live on the task.
const assignedCollaborators = useMemo(
  () => [...shares.map((s) => s.friendId), ...(task?.pendingInvites || [])],
  [shares, task?.pendingInvites]
);
```

- [ ] **Step 3: Rewrite `handleAdd`** (friend branch) to share + flag, and the email branch to keep `pendingInvites` only (no `collaborators` write):
```ts
const handleAdd = () => {
  if (!task) return;
  if (!isPremium()) {
    toast.error('Le partage de tâches est réservé aux membres Premium.');
    return;
  }
  const value = input.trim().toLowerCase();
  if (!value) return;

  const friend = friends.find(f => f.email.toLowerCase() === value);

  if (friend) {
    const collabId = collabIdOf(friend);
    if (!assignedCollaborators.includes(collabId)) {
      shareTaskMutation.mutate({ taskId: task.id, friendId: collabId, friendEmail: friend.email, role: 'editor' });
      if (!task.isCollaborative) {
        updateTaskMutation.mutate({ id: task.id, updates: { isCollaborative: true } });
      }
    }
  } else {
    if (!emailRegex.test(value)) { setInput(''); return; }
    if (assignedCollaborators.includes(value)) { setInput(''); return; }
    const pendingInvites = task.pendingInvites || [];
    if (!pendingInvites.includes(value)) {
      sendFriendRequestMutation.mutate({ email: value });
      updateTaskMutation.mutate({
        id: task.id,
        updates: { isCollaborative: true, pendingInvites: [...pendingInvites, value] },
      });
    }
  }
  setInput('');
};
```

- [ ] **Step 4: Rewrite `handleToggleFriend`** to share/unshare:
```ts
const handleToggleFriend = (collabId: string) => {
  if (!task) return;
  if (assignedCollaborators.includes(collabId)) {
    unshareTaskMutation.mutate({ taskId: task.id, friendId: collabId });
    const remaining = shares.filter((s) => s.friendId !== collabId).length + (task.pendingInvites?.length || 0);
    updateTaskMutation.mutate({ id: task.id, updates: { isCollaborative: remaining > 0 } });
  } else {
    if (!isPremium()) {
      toast.error('Le partage de tâches est réservé aux membres Premium.');
      return;
    }
    const friend = friends.find((f) => collabIdOf(f) === collabId);
    shareTaskMutation.mutate({ taskId: task.id, friendId: collabId, friendEmail: friend?.email, role: 'editor' });
    if (!task.isCollaborative) {
      updateTaskMutation.mutate({ id: task.id, updates: { isCollaborative: true } });
    }
  }
};
```

- [ ] **Step 5: Rewrite `handleRemove`** (used by the "assigned" list's remove button). A removed id is either a registered share (unshare) or a pending email invite (strip from `pendingInvites`):
```ts
const handleRemove = (collaboratorId: string) => {
  if (!task) return;
  const isPendingInvite = (task.pendingInvites || []).includes(collaboratorId);
  if (isPendingInvite) {
    const newPendingInvites = (task.pendingInvites || []).filter((e) => e !== collaboratorId);
    const remaining = shares.length + newPendingInvites.length;
    updateTaskMutation.mutate({
      id: task.id,
      updates: { pendingInvites: newPendingInvites, isCollaborative: remaining > 0 },
    });
  } else {
    unshareTaskMutation.mutate({ taskId: task.id, friendId: collaboratorId });
    const remaining = shares.filter((s) => s.friendId !== collaboratorId).length + (task.pendingInvites?.length || 0);
    updateTaskMutation.mutate({ id: task.id, updates: { isCollaborative: remaining > 0 } });
  }
};
```

> `collaboratorValidations` is no longer touched here (it was only ever a side-write). Leaving stale keys is harmless; they are ignored when their collaborator is absent. If you prefer cleanliness, you may also strip the key in the unshare branch — optional, not required.

- [ ] **Step 6: Ensure `useMemo` is imported.** It already is (`import React, { useEffect, useMemo, useState } from 'react';`). Confirm `availableFriends`'s `useMemo` still compiles with the new `assignedCollaborators` dependency.

- [ ] **Step 7: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: `CollaboratorModal.tsx` clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/CollaboratorModal.tsx
git commit -m "refactor(ui): CollaboratorModal manages collaborators via shared_tasks"
```

---

## Task 9: `TaskModal` — selection from shares, save via diff

**Files:**
- Modify: `src/components/TaskModal.tsx`

**Context:** `TaskModal` keeps a local `collaborators: string[]` state used by its collaborator-picker UI. Previously it seeded from `task.collaborators` and on save wrote `collaborators` back to the task plus ran a `shareTask` loop. Now: seed local state from `useTaskShares(task.id)`, and on save compute the add/remove diff against the existing shares — calling `shareTask` for added ids and `unshareTask` for removed ids — and set `isCollaborative` from the resulting count. Stop writing `collaborators` to the task payload.

- [ ] **Step 1: Add hooks.** Add to the friends imports used by `TaskModal`:
```ts
import { useShareTask, useUnshareTask, useTaskShares } from '@/modules/friends';
```
(If `useShareTask` is already imported, just add `useUnshareTask, useTaskShares`.) Inside the component that owns the local `collaborators` state (the one with `const [collaborators, setCollaborators] = useState<string[]>([]);` at ~line 737), add:
```ts
const shareTaskMutation = useShareTask();
const unshareTaskMutation = useUnshareTask();
const { data: existingShares = [] } = useTaskShares(task?.id);
```

- [ ] **Step 2: Seed selection from shares.** Replace the seeding (line ~846):
```ts
setCollaborators(task.collaborators || []);
```
with:
```ts
setCollaborators([...existingShares.map((s) => s.friendId), ...(task.pendingInvites || [])]);
```
and add `existingShares` to that effect's dependency array.

- [ ] **Step 3: Fix the `showCollaboratorSection` seed** (line ~854) which reads `task.collaborators`:
```ts
setShowCollaboratorSection(showCollaborators || existingShares.length > 0 || (task.pendingInvites?.length ?? 0) > 0 || false);
```

- [ ] **Step 4: Fix the dirty-check** (line ~924) that compares `collaborators` to `task.collaborators`:
```ts
const collaboratorsChanged =
  JSON.stringify([...collaborators].sort()) !==
  JSON.stringify([...existingShares.map((s) => s.friendId), ...(task.collaborators_pending = task.pendingInvites || [])].sort());
```
> Simpler and safer — replace the whole comparison with:
```ts
const baseline = [...existingShares.map((s) => s.friendId), ...(task.pendingInvites || [])];
const collaboratorsChanged =
  JSON.stringify([...collaborators].sort()) !== JSON.stringify([...baseline].sort());
```
Use the simpler form; delete the first variant.

- [ ] **Step 5: Rewrite the save handler.** In both save branches (lines ~1031 and ~1054) remove `collaborators: collaborators,` and `pendingInvites: pendingInvitesLocal,` from the task `updates` payload **only for the `collaborators` key**; keep `pendingInvites: pendingInvitesLocal` (still a task column) and set `isCollaborative: collaborators.length > 0`. So each payload keeps:
```ts
isCollaborative: collaborators.length > 0,
pendingInvites: pendingInvitesLocal,
```
and drops the `collaborators: collaborators,` line.

- [ ] **Step 6: Replace the post-save `shareTask` loop** (line ~1081, currently `collaborators.forEach(userId => { if (!task.collaborators?.includes(userId)) {...} })`) with a full add/remove diff against `existingShares`. Place it where the old loop was, guarded by `isPremium()`:
```ts
if (isPremium()) {
  const existingIds = existingShares.map((s) => s.friendId);
  // Added registered friends (skip pending email invites — they have no auth.uid yet)
  const friendIds = new Set(friends.map((f) => f.userId ?? f.id));
  for (const id of collaborators) {
    if (!existingIds.includes(id) && friendIds.has(id)) {
      const friend = friends.find((f) => (f.userId ?? f.id) === id);
      shareTaskMutation.mutate({ taskId: task.id, friendId: id, friendEmail: friend?.email, role: 'editor' });
    }
  }
  // Removed
  for (const id of existingIds) {
    if (!collaborators.includes(id)) {
      unshareTaskMutation.mutate({ taskId: task.id, friendId: id });
    }
  }
}
```

- [ ] **Step 7: Fix `handleSaveCollaborators`** (~line 884–905) which writes `task.collaborators`. If this helper exists and writes `collaborators: [...]`, drop the `collaborators` key from its `updates` payload (keep `pendingInvites`). The actual share writes are handled by the diff in Step 6, so this helper should only persist `pendingInvites` + `isCollaborative`.

- [ ] **Step 8: Search for remaining `task.collaborators` / `.collaborators` in this file.** Run a project search within `TaskModal.tsx` for `collaborators` and confirm only the local `collaborators` state variable and `collaboratorValidations` remain — no `task.collaborators` reads.

- [ ] **Step 9: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: `TaskModal.tsx` clean.

- [ ] **Step 10: Commit**

```bash
git add src/components/TaskModal.tsx
git commit -m "refactor(ui): TaskModal collaborator picker syncs shared_tasks via diff"
```

---

## Task 10: `AddTaskForm` + `CollaborativeTasks`

**Files:**
- Modify: `src/components/AddTaskForm.tsx`
- Modify: `src/components/CollaborativeTasks.tsx`

### 10a — AddTaskForm

**Context:** `AddTaskForm` keeps a local `collaborators` selection and, on submit, wrote `collaborators` to the new task then ran a `shareTask` loop (line ~261). Just stop writing `collaborators` to the task; keep the loop.

- [ ] **Step 1: Drop `collaborators` from the create payload** (lines ~246-248). Change:
```ts
isCollaborative: collaborators.length > 0,
collaborators: collaborators,
pendingInvites: [],
```
to:
```ts
isCollaborative: collaborators.length > 0,
pendingInvites: [],
```

- [ ] **Step 2: Confirm the post-create loop is unchanged** (line ~261): `if (collaborators.length > 0 && isPremium()) { collaborators.forEach((userId) => { ...shareTask... }) }`. The local `collaborators` state and friend-picker (lines ~675-686) stay as-is — they drive selection, not task storage.

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: `AddTaskForm.tsx` clean.

### 10b — CollaborativeTasks (Dashboard widget)

**Context:** Mounted in `DashboardPage`. Its premium preview uses local dummy data (fine, untouched). Its real path reads `task.collaborators` for counts + an `AvatarGroup`, and its internal "Gérer" popup mutates collaborators **by name** (already a B6 violation). We make the widget read-only for collaborators (counts + avatars from `useMyTaskShares`) and delegate all management to the canonical `CollaboratorModal` (already wired per-row via the `UserPlus` button at line ~367). The broken by-name popup and its handlers are deleted.

- [ ] **Step 1: Add the shares hook.** In imports add `useMyTaskShares`:
```ts
import { useFriends, useSendFriendRequest, useMyTaskShares } from '@/modules/friends';
```
After the other hooks, add:
```ts
const { data: myShares = [] } = useMyTaskShares();
const sharesByTask = useMemo(() => {
  const m = new Map<string, string[]>();
  for (const s of myShares) {
    const arr = m.get(s.taskId) ?? [];
    arr.push(s.friendId);
    m.set(s.taskId, arr);
  }
  return m;
}, [myShares]);
```

- [ ] **Step 2: Replace collaborator count reads.**
  - Line ~337 `<span>{task.collaborators?.length} collaborateurs</span>` →
    ```tsx
    <span>{(sharesByTask.get(task.id)?.length ?? 0)} collaborateurs</span>
    ```
  - Line ~504 `{task.collaborators?.length || 0} collab.` →
    ```tsx
    {(sharesByTask.get(task.id)?.length ?? 0)} collab.
    ```

- [ ] **Step 3: Replace the AvatarGroup map** (lines ~382-411) to iterate share ids instead of `task.collaborators`:
```tsx
<AvatarGroup>
{(sharesByTask.get(task.id) ?? []).map((collaborator, index) => {
  const hasValidated = task.collaboratorValidations?.[collaborator] ?? false;
  const friend = friends.find(f => f.userId === collaborator || f.id === collaborator || f.name === collaborator);
  const label = friend?.name ?? collaborator;
  const initials = label.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const isEmoji = friend?.avatar && friend.avatar.length <= 2;
  return (
    <div key={index} className="relative" title={`${label} - ${hasValidated ? 'Validé' : 'Non validé'}`}>
      <Avatar className="size-9">
        {friend?.avatar && !isEmoji && friend.avatar.startsWith('http') && (
          <AvatarImage src={friend.avatar} alt={label} />
        )}
        <AvatarFallback className={
          hasValidated
            ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white text-xs font-bold shadow-lg shadow-green-500/30'
            : 'bg-[rgb(var(--color-active))] text-[rgb(var(--color-text-secondary))] text-xs font-bold'
        }>
          {isEmoji ? <span className="text-base">{friend?.avatar}</span> : initials}
        </AvatarFallback>
      </Avatar>
      {hasValidated && (
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[rgb(var(--color-surface))] rounded-full flex items-center justify-center shadow-md z-10">
          <Check size={10} className="text-green-500" />
        </div>
      )}
    </div>
  );
})}
</AvatarGroup>
```

- [ ] **Step 4: Delete the broken by-name management popup and handlers.** Remove:
  - `handleAddCollaborator`, `handleRemoveCollaborator`, `handleAddCollaboratorByEmail`, `displayInfo` (lines ~127-205)
  - the `showPopup` state, `handleOpenPopup`, `selectedTaskId`/`selectedTask`, `searchQuery`, `showOverdueOnly`, `collaboratorSearchQuery`, `emailInput`, `filteredTasks` **only if** they become unused after removing the popup JSX. (Type-check will tell you — `noUnusedLocals` is on.)
  - the entire `{showPopup && ( ... )}` JSX block (lines ~429-626).
  - the header "Gérer" button (lines ~295-304) — its only purpose was opening that popup. Collaborator management remains available per-row via the existing `UserPlus` action button (line ~367) which opens `CollaboratorModal` (the canonical manager). Keep that button and the `collaboratorModalTaskId` state + `<CollaboratorModal .../>` render (lines ~644-646).

- [ ] **Step 5: Remove now-unused imports** flagged by the compiler (e.g. `Search`, `Mail`, `AlertTriangle`, `CollaboratorItem`, `useSendFriendRequest` if no longer referenced). Let `npx tsc --noEmit` + `npm run lint` drive this.

- [ ] **Step 6: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS, **0 errors across the whole project** (this is the last code task).

- [ ] **Step 7: Commit**

```bash
git add src/components/AddTaskForm.tsx src/components/CollaborativeTasks.tsx
git commit -m "refactor(ui): AddTaskForm + CollaborativeTasks derive collaborators from shared_tasks"
```

---

## Task 11: Build, demo + cross-account verification, prod migration

**Files:** none (verification + deploy)

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: success; no chunk regression warnings beyond the known `vendor-charts`.

- [ ] **Step 2: Demo-mode smoke (no Supabase).** `npm start`, `loginDemo()`, then:
  - Open a task → CollaboratorModal → add a demo friend → the friend appears in "assigned"; close and reopen → still there (persisted in `cosmo_shared_tasks`).
  - Remove the friend → disappears; the task's collaborative badge clears when the last one is removed.
  - Dashboard `CollaborativeTasks` widget shows the correct count + avatars.
  - TodayTasks / TaskSidebar show the avatar group for the shared task.

- [ ] **Step 3: Cross-account (production Supabase, two browsers).**
  - Account A (Premium) shares a task with confirmed friend B.
  - A's CollaboratorModal lists B; A's dashboard widget count = 1.
  - B sees the task in their list marked "Reçu de {A}" (via `enrichSharedBy` — unchanged).
  - A removes B → B no longer sees the task; A's badge clears.

- [ ] **Step 4: Apply migration 028 to production.**

```bash
supabase db push
```
(or `mcp__supabase__apply_migration` against the prod project). Then re-run Step 1's two verification queries against prod and `get_advisors`.

> Order matters: deploy the new client (which no longer selects `collaborators`) **before or together with** the prod migration. Since `mapFromDb` and the `getAll` select no longer reference the column after Task 5, an already-deployed old client is the only risk — coordinate so the Vercel deploy of this branch lands first or simultaneously.

- [ ] **Step 5: Playwright regression**

Run: `npm run test:e2e`
Expected: 9/9 pass (3 smoke + 6 a11y).

- [ ] **Step 6: Final commit (if any verification tweak was needed) + push**

```bash
git push -u origin chore/remove-collaborators-column
```

---

## Self-Review

**Spec coverage** (point 3 = "supprimer `collaborators[]` de tasks et dériver l'UI propriétaire depuis `shared_tasks`"):
- Drop column → Task 1 (+ prod apply Task 11).
- Remove from type/repos → Task 5.
- Owner UI derives from `shared_tasks` → Tasks 6 (lists), 7 (badge), 8 (CollaboratorModal), 9 (TaskModal), 10 (AddTaskForm + CollaborativeTasks).
- Demo parity → Task 3 (LocalStorage impl) + Task 11 Step 2.
- No data loss → Task 1 backfill.

**Kept intentionally (documented, not in scope):** `tasks.is_collaborative` (owner-maintained hint), `tasks.pending_invites` (email invites without an `auth.users` row — cannot live in `shared_tasks` due to its FK to `auth.users`), `tasks.collaborator_validations` (per-collaborator validation state, keyed by `friendId`).

**Type consistency:** `TaskShare { taskId; friendId; role }` is defined in Task 2 and used identically in Tasks 3, 4, 6, 8, 9, 10. Hook names are stable: `useTaskShares(taskId)`, `useMyTaskShares()`, `useSharesByTask()`. Prop rename `collaborators → collaboratorIds` on `CollaboratorAvatars` is applied at the definition (Task 6 Step 1) and both call sites (Task 6 Steps 2-3).

**Risk notes:**
- `CollaboratorModal`/`TaskModal` issue a `shareTask` and a separate `updateTask({isCollaborative})` — two writes, not atomic. Acceptable: `is_collaborative` is a non-authoritative display hint; worst case is a stale badge corrected on the next share/unshare. If this proves flaky, a follow-up can derive the badge from a `shared_tasks` count instead of the boolean.
- Prod migration ordering (Task 11 Step 4) is the one operational hazard — call it out in the PR description.
