# Statut, État, vue Tableau perso, conversion de sous-tâche, import · plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** donner aux tâches perso un Statut (À faire, En cours, Bloquée, Terminée) et un État
(Dans les temps, À risque, En difficulté), une vue Tableau, la conversion d'une sous-tâche en tâche,
et un import Todoist / TickTick / Notion.

**Architecture :** deux colonnes sur `tasks` (mig. `214`) tenues d'accord avec `completed` par un
trigger `SECURITY INVOKER` ; la même règle existe en TypeScript pur (`status-sync.ts`) pour le
repository local et les mises à jour optimistes. La vue Tableau vit dans `src/components/task-board/`
et reçoit les tâches DÉJÀ filtrées par la page. L'import est un pipeline pur
(`src/lib/task-import/` : CSV → forme intermédiaire → plan → exécution) branché sur une fenêtre
dans Réglages › Données.

**Tech Stack :** React 18, TypeScript strict, TanStack Query 5, Supabase (Postgres 17), Vitest,
Framer Motion, Tailwind, catalogues i18n maison.

**Spec :** [`docs/superpowers/specs/2026-10-08-kanban-perso-import-design.md`](../specs/2026-10-08-kanban-perso-import-design.md)

**Faits relevés au catalogue de prod le 2026-10-08** (projet `ykeugqfgklejcdbrmawy`) :
- dernier numéro au ledger : `213_admin_onboarding_funnel` → la migration est **`214`** ;
- `tasks` : droits `INSERT` / `UPDATE` au niveau TABLE pour `authenticated`, aucune contrainte sur
  `priority` (0 = « non définie » passe), une seule contrainte `CHECK` (`tasks_recurrence_check`) ;
- triggers existants : `trg_prevent_user_id_change`, `trg_tasks_updated_at` (BEFORE, ordre
  alphabétique : le nôtre s'appellera `trg_tasks_status_sync`) ;
- `toggle_task_complete_v2(uuid, timestamptz)` : ne bascule que pour le PROPRIÉTAIRE
  (`user_id = auth.uid()`), pose `completed_at = NOW()` / `NULL`, et insère l'occurrence avec une
  liste de colonnes EXPLICITE (donc `status` par défaut `todo`, `health` NULL).

**Écart assumé avec la spec, décidé ici :** Statut et État se règlent dans la fiche **en
édition** (persistance immédiate, comme la checklist), pas à la création. Une tâche naît `todo`,
sauf depuis le « + » d'une colonne du Tableau, qui crée par une saisie rapide dans la colonne.
Raison : `useTaskModal.ts` est à 577 lignes pour un plafond de 600.

**Règles du dépôt qui s'appliquent partout :** imports `@/` ; `toast` depuis `@/lib/toast` ; pas de
`as any` ; tout libellé dans `src/locales/{fr,en}/*.json` (valeurs `en` différentes du `fr`) ;
aucun fichier au-delà de 600 lignes ; jamais `--maxWorkers` en ligne de commande ; lire `$?`
après chaque commande de test, jamais la seule ligne de résumé ; aucun tiret cadratin dans un
texte livré.

---

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migration/214_task_status_health.sql` | colonnes, reprise, trigger, droits |
| `supabase/proofs/214.proof.sql` | preuve acteur par acteur, bloc `DO` terminé par `RAISE EXCEPTION` |
| `src/modules/tasks/status-sync.ts` (+ test) | règle pure statut ↔ terminé, miroir du trigger |
| `src/modules/tasks/types.ts` | `TaskStatus`, `TaskHealth`, champs `status` / `health` |
| `src/modules/tasks/mappers.ts` (+ test) | lecture / whitelist d'écriture des deux colonnes |
| `src/modules/tasks/task.schema.ts` | zod |
| `src/modules/tasks/local.repository.ts` (+ test) | synchronisation en démo, occurrence née `todo` |
| `src/modules/tasks/hooks.ts` | mises à jour optimistes synchronisées |
| `src/components/task-board/board.helpers.ts` (+ test) | colonnes, tri, « Terminée » sur 7 jours, décision de déplacement |
| `src/components/task-board/view-mode.store.ts` (+ test) | Liste / Tableau mémorisé par appareil |
| `src/components/task-board/TaskBoard.tsx` | orchestration : colonnes, glisser, fiche, déplacer |
| `src/components/task-board/TaskBoardColumn.tsx` | une colonne, zone de dépôt, saisie rapide |
| `src/components/task-board/TaskBoardCard.tsx` | une carte |
| `src/components/task-board/TaskHealthMenu.tsx` | menu d'État perso (catalogue `tasks`) |
| `src/components/task-board/MoveTaskSheet.tsx` | « Déplacer vers… » (mobile et clavier) |
| `src/components/task-board/ViewModeToggle.tsx` | bascule Liste / Tableau |
| `src/components/task-board/use-move-task.ts` | déplacement : bascule RPC vers `done`, sinon `update` |
| `src/components/task-modal/TaskStateFields.tsx` | Statut + État dans la fiche (édition) |
| `src/components/task-table/TaskStateBadges.tsx` | étiquette de statut + pastille d'État en vue Liste |
| `src/components/task-modal/use-promote-subtask.ts` (+ test) | conversion de sous-tâche et annulation |
| `src/lib/task-import/csv.ts` (+ test) | analyseur CSV |
| `src/lib/task-import/types.ts` | forme intermédiaire |
| `src/lib/task-import/dates.ts` (+ test) | dates et récurrences |
| `src/lib/task-import/todoist.ts` (+ test) | adaptateur Todoist |
| `src/lib/task-import/ticktick.ts` (+ test) | adaptateur TickTick |
| `src/lib/task-import/generic.ts` (+ test) | Notion / CSV quelconque + devinette de colonnes |
| `src/lib/task-import/detect.ts` (+ test) | reconnaissance du format |
| `src/lib/task-import/plan.ts` (+ test) | catégories à créer, lignes ignorées, plafond |
| `src/lib/task-import/execute.ts` (+ test) | exécution par lots, progression, annulation |
| `src/pages/settings/ImportTasksDialog.tsx` | fenêtre d'import (étapes) |
| `src/pages/settings/ImportColumnMapping.tsx` | écran de correspondance des colonnes |
| `src/pages/settings/DataTab.tsx` | bouton « Importer » à la place de la mention |
| `src/locales/{fr,en}/tasks.json`, `settings.json` | libellés |

---

## Partie A · Statut et État (base + modèle)

### Task A1 : règle pure `status-sync`

**Files :** Create `src/modules/tasks/status-sync.ts`, `src/modules/tasks/status-sync.test.ts`

- [ ] **Step 1 : test qui échoue**

```ts
import { describe, it, expect } from 'vitest';
import { applyStatusSync } from './status-sync';

const base = { completed: false, completedAt: undefined as string | undefined, status: 'todo' as const };
const NOW = '2026-10-08T10:00:00.000Z';

describe('applyStatusSync', () => {
  it('completed true → status done', () => {
    expect(applyStatusSync(base, { completed: true, completedAt: NOW }, NOW))
      .toMatchObject({ completed: true, status: 'done', completedAt: NOW });
  });
  it('completed false depuis done → status todo', () => {
    const prev = { completed: true, completedAt: NOW, status: 'done' as const };
    expect(applyStatusSync(prev, { completed: false }, NOW)).toMatchObject({ completed: false, status: 'todo', completedAt: undefined });
  });
  it('status done → completed true et completedAt posé', () => {
    expect(applyStatusSync(base, { status: 'done' }, NOW)).toMatchObject({ completed: true, completedAt: NOW, status: 'done' });
  });
  it('status quitte done → completed false', () => {
    const prev = { completed: true, completedAt: NOW, status: 'done' as const };
    expect(applyStatusSync(prev, { status: 'in_progress' }, NOW)).toMatchObject({ completed: false, completedAt: undefined, status: 'in_progress' });
  });
  it('statut intermédiaire sans toucher completed', () => {
    expect(applyStatusSync(base, { status: 'blocked' }, NOW)).toEqual({ status: 'blocked' });
  });
  it('patch sans statut ni completed : inchangé', () => {
    expect(applyStatusSync(base, { name: 'x' }, NOW)).toEqual({ name: 'x' });
  });
  it('état absent (ancienne ligne) lu comme todo / done selon completed', () => {
    expect(applyStatusSync({ completed: true }, { status: 'todo' }, NOW)).toMatchObject({ completed: false, status: 'todo' });
  });
});
```

- [ ] **Step 2 :** `npx vitest run src/modules/tasks/status-sync.test.ts` → FAIL (module absent).
- [ ] **Step 3 : implémentation**

```ts
// Miroir TypeScript du trigger `sync_task_status` (mig. 214). Le serveur fait foi
// en production ; ce module sert le repository local (démo) et les mises à jour
// optimistes, pour qu'une carte ne saute pas de colonne avant la réponse.
import type { Task, TaskStatus } from './types';

type SyncFields = Pick<Task, 'completed' | 'completedAt' | 'status'>;

/** Statut effectif d'une tâche, y compris une ligne antérieure à la mig. 214. */
export function effectiveStatus(task: Partial<SyncFields>): TaskStatus {
  return task.status ?? (task.completed ? 'done' : 'todo');
}

/**
 * Complète un patch pour que `status` et `completed` restent d'accord.
 * `completed` l'emporte s'il est explicitement dans le patch (c'est le chemin de
 * la case à cocher et de la RPC) ; sinon `status` décide.
 */
export function applyStatusSync<P extends Partial<Task>>(prev: Partial<SyncFields>, patch: P, nowIso: string = new Date().toISOString()): P {
  if (patch.completed !== undefined) {
    if (patch.completed) return { ...patch, status: 'done' };
    if (effectiveStatus(prev) === 'done' && patch.status === undefined) return { ...patch, status: 'todo', completedAt: undefined };
    return { ...patch, completedAt: undefined };
  }
  if (patch.status === undefined) return patch;
  const wasDone = effectiveStatus(prev) === 'done';
  if (patch.status === 'done' && !wasDone) return { ...patch, completed: true, completedAt: prev.completedAt ?? nowIso };
  if (patch.status !== 'done' && (wasDone || prev.completed)) return { ...patch, completed: false, completedAt: undefined };
  return patch;
}
```

- [ ] **Step 4 :** relancer → PASS (lire `$?`).
- [ ] **Step 5 :** commit `feat(taches): regle pure statut <-> terminee (miroir du trigger 214)`.

### Task A2 : types, mappers, schéma

**Files :** Modify `src/modules/tasks/types.ts`, `mappers.ts`, `mappers.test.ts`, `task.schema.ts`, `index.ts`

- [ ] **Step 1 : test qui échoue** (ajouter à `mappers.test.ts`)

```ts
it('lit status et health, et retombe sur todo / done pour une ligne ancienne', () => {
  const row = { id: '1', name: 'n', priority: 3, category: null, deadline: null, estimated_time: 0 };
  expect(mapTaskFromDb({ ...row, completed: true }).status).toBe('done');
  expect(mapTaskFromDb({ ...row, status: 'blocked', health: 'at_risk' })).toMatchObject({ status: 'blocked', health: 'at_risk' });
  expect(mapTaskFromDb({ ...row, health: null }).health).toBeUndefined();
});
it('whitelist : status et health partent, health vide devient NULL', () => {
  expect(mapTaskToDb({ status: 'in_progress', health: 'on_track' })).toEqual({ status: 'in_progress', health: 'on_track' });
  expect(mapTaskToDb({ health: null })).toEqual({ health: null });
});
```

- [ ] **Step 2 :** lancer le fichier de test → FAIL.
- [ ] **Step 3 : implémentation**
  - `types.ts` : remplacer le type dérivé inutilisé `TaskStatus = 'todo' | 'completed'` (B6, aucun
    lecteur hors `index.ts`) par `export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';`
    et ajouter `export type TaskHealth = 'on_track' | 'at_risk' | 'off_track';`.
    Dans `Task` : `status?: TaskStatus;` et `health?: TaskHealth | null;` (commentés : mig. 214,
    synchronisé avec `completed` par trigger ; `null` = pas d'état déclaré).
  - `index.ts` : exporter aussi `TaskHealth`, et `applyStatusSync`, `effectiveStatus` depuis `./status-sync`.
  - `mappers.ts` : `TaskRow` gagne `status?: string | null; health?: string | null;`,
    `TaskDbInput` gagne `status?: string; health?: string | null;`.
    `mapTaskFromDb` : `status: (row.status as TaskStatus | null) ?? (row.completed ? 'done' : 'todo')`,
    `health: (row.health as TaskHealth | null) ?? undefined`.
    `mapTaskToDb` : `if (input.status !== undefined) result.status = input.status;`
    `if (input.health !== undefined) result.health = input.health ?? null;`
  - `task.schema.ts` : `status: z.enum(['todo', 'in_progress', 'blocked', 'done']).optional(),`
    `health: z.enum(['on_track', 'at_risk', 'off_track']).nullable().optional(),`
- [ ] **Step 4 :** `npx vitest run src/modules/tasks` puis `npm run typecheck` → 0 erreur.
- [ ] **Step 5 :** commit `feat(taches): status et health au modele, mappers et zod`.

### Task A3 : repository local et mises à jour optimistes

**Files :** Modify `src/modules/tasks/local.repository.ts`, `local.repository.test.ts`, `hooks.ts`

- [ ] **Step 1 : tests qui échouent** (`local.repository.test.ts`)

```ts
it('update({ status: done }) coche la tâche, en sortir la décoche', async () => {
  const repo = new LocalTasksRepository();
  const t = await repo.create({ name: 'a', priority: 3, category: '', deadline: '', estimatedTime: 0, bookmarked: false, completed: false });
  expect((await repo.update(t.id, { status: 'done' })).completed).toBe(true);
  const back = await repo.update(t.id, { status: 'in_progress' });
  expect(back).toMatchObject({ completed: false, status: 'in_progress' });
});
it('toggleComplete passe le statut à done, et l’occurrence générée naît todo sans état', async () => {
  const repo = new LocalTasksRepository();
  const t = await repo.create({ name: 'r', priority: 3, category: '', deadline: '2026-10-08T00:00:00.000Z', estimatedTime: 0, bookmarked: false, completed: false, recurrence: 'daily', status: 'blocked', health: 'off_track' });
  const { task, spawned } = await repo.toggleComplete(t.id, '2026-10-09T00:00:00.000Z');
  expect(task.status).toBe('done');
  expect(spawned).toMatchObject({ status: 'todo', health: undefined, completed: false });
});
```

  (Reprendre le nom de classe et la forme de `create` exacts du fichier de test existant.)
- [ ] **Step 2 :** lancer → FAIL.
- [ ] **Step 3 : implémentation**
  - `create` : `const synced = applyStatusSync({}, { ...input, status: input.status ?? (input.completed ? 'done' : 'todo') });` puis construire `newTask` depuis `synced`.
  - `update` : `const updatedTask = { ...tasks[index], ...applyStatusSync(tasks[index], updates) };`
  - `toggleComplete` : `updatedTask` reçoit `status: !task.completed ? 'done' : 'todo'` ; `spawned` reçoit `status: 'todo', health: undefined`.
  - `hooks.ts` : dans `useUpdateTask.onMutate`, remplacer `{ ...task, ...updates }` par
    `{ ...task, ...applyStatusSync(task, updates) }` ; dans `useToggleTaskComplete.onMutate` et dans
    le rappel « Annuler », ajouter `status: completed ? 'done' : 'todo'` à l'objet optimiste.
- [ ] **Step 4 :** `npx vitest run src/modules/tasks` → PASS ; `npm run typecheck`.
- [ ] **Step 5 :** commit `feat(taches): statut synchronise en demo et en optimiste`.

### Task A4 : migration 214 et sa preuve

**Files :** Create `supabase/migration/214_task_status_health.sql`, `supabase/proofs/214.proof.sql`

- [ ] **Step 1 : écrire la migration**

```sql
-- 214 · Statut et État des tâches PERSONNELLES (2026-10-08)
--
-- Le mode entreprise a le Statut (mig. 091) et l'État (mig. 204). Les tâches
-- perso n'avaient que `completed`. Même construction que la 091 : la colonne
-- s'ajoute À CÔTÉ de `completed`, un trigger les garde d'accord dans les deux
-- sens, et le front actuel qui n'écrit que `completed` continue de marcher.
--
-- Quatre statuts, pas cinq : `review` est volontairement absent (décision
-- d'Axel, 2026-10-08), la relecture n'a pas de sens pour une personne seule.
--
-- RLS : aucune policy nouvelle. Les deux colonnes relèvent de
-- `tasks_update_own_or_editor` ; `get_my_tasks` / `get_pending_shared_tasks`
-- sont `SETOF public.tasks` et les rendent d'office. Droits relus au catalogue
-- le 2026-10-08 : INSERT / UPDATE au niveau TABLE pour `authenticated`.
--
-- `toggle_task_complete_v2` n'est pas touchée : elle écrit `completed`, le
-- trigger suit, et son INSERT d'occurrence a une liste de colonnes explicite,
-- donc l'occurrence naît `todo` sans état.

BEGIN;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo',
  ADD COLUMN IF NOT EXISTS health TEXT;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check,
  ADD CONSTRAINT tasks_status_check CHECK (status IN ('todo', 'in_progress', 'blocked', 'done')),
  DROP CONSTRAINT IF EXISTS tasks_health_check,
  ADD CONSTRAINT tasks_health_check CHECK (health IS NULL OR health IN ('on_track', 'at_risk', 'off_track'));

-- Reprise : ce qui est terminé devient `done`. On ne devine jamais `in_progress`.
UPDATE public.tasks SET status = 'done' WHERE completed = true AND status <> 'done';

-- Cohérence bidirectionnelle. SECURITY INVOKER (défaut) : un trigger ne doit
-- rien pouvoir faire que l'appelant ne puisse déjà faire (mig. 108).
CREATE OR REPLACE FUNCTION public.sync_task_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.completed THEN
      NEW.status := 'done';
    ELSIF NEW.status = 'done' THEN
      NEW.completed := true;
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.completed IS DISTINCT FROM OLD.completed THEN
    -- `completed` a bougé (case à cocher, RPC) : il décide.
    IF NEW.completed THEN
      NEW.status := 'done';
    ELSIF NEW.status = 'done' THEN
      NEW.status := 'todo';
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Seul le statut a bougé (Tableau, fiche) : il décide.
    IF NEW.status = 'done' THEN
      NEW.completed := true;
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    ELSIF OLD.status = 'done' THEN
      NEW.completed := false;
      NEW.completed_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_task_status() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_tasks_status_sync ON public.tasks;
CREATE TRIGGER trg_tasks_status_sync
  BEFORE INSERT OR UPDATE OF completed, status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.sync_task_status();

COMMENT ON COLUMN public.tasks.status IS
  'Statut perso (mig. 214) : todo, in_progress, blocked, done. Tenu d''accord avec completed par trg_tasks_status_sync.';
COMMENT ON COLUMN public.tasks.health IS
  'État déclaré (mig. 214) : on_track, at_risk, off_track, NULL. Même vocabulaire que team_tasks.health (204).';

COMMIT;
```

  ⚠️ Avant d'écrire `REVOKE`, relire la forme exacte utilisée par `064b` / `094b` dans le dépôt et
  l'aligner. Vérifier aussi que `validate:migrations` accepte `BEGIN; … COMMIT;` (forme de la 152).
- [ ] **Step 2 : écrire la preuve** `supabase/proofs/214.proof.sql` : un seul bloc `DO` qui applique
  le contenu de la migration (sans `BEGIN/COMMIT`), puis, en se faisant passer pour deux comptes
  réels (`set_config('request.jwt.claims', …)` et `SET LOCAL ROLE authenticated`, sur le modèle de
  `proofs/208-210.proof.sql`) :
  1. propriétaire : `UPDATE status = 'in_progress'` → `completed` reste false ;
  2. propriétaire : `UPDATE status = 'done'` → `completed = true`, `completed_at` non NULL ;
  3. propriétaire : `UPDATE status = 'todo'` → `completed = false`, `completed_at` NULL ;
  4. propriétaire : `toggle_task_complete_v2` → `status = 'done'` ; tâche récurrente → occurrence `todo`, `health` NULL ;
  5. propriétaire : `UPDATE status = 'review'` → `23514` ;
  6. collaborateur `editor` accepté : `UPDATE health = 'at_risk'` → 1 ligne ;
  7. inconnu : `UPDATE status = 'blocked'` → 0 ligne ;
  8. reprise : aucune ligne `completed = true` avec `status <> 'done'`.
  Le bloc se termine par `RAISE EXCEPTION 'PREUVE 214 : % cas sur 8', ok;`.
  Plus une passe témoin SANS le trigger, qui doit faire échouer le cas 2.
- [ ] **Step 3 :** `npm run validate:migrations` et `npm run check:rls` → `$?` = 0.
- [ ] **Step 4 :** commit `feat(db): mig. 214, statut et etat des taches perso (non appliquee)`.

### Task A5 : jouer la preuve en prod, puis appliquer (GESTE SOUMIS À AXEL)

- [ ] **Step 1 :** relire le ledger (`list_migrations`) : `213` doit rester la dernière entrée.
- [ ] **Step 2 :** jouer `214.proof.sql` par `execute_sql` : verdict attendu `PREUVE 214 : 8 cas sur 8`,
  puis la passe témoin (échec attendu au cas 2). Vérifier ensuite que rien n'est resté
  (`information_schema.columns` : pas de colonne `status` sur `tasks`).
- [ ] **Step 3 : demander le feu vert d'Axel**, avec le verdict sous les yeux.
- [ ] **Step 4 :** `apply_migration` (nom `214_task_status_health`), puis relire au catalogue :
  colonnes, deux `CHECK`, trigger, `pg_get_functiondef('public.sync_task_status()')` comparé au
  fichier, droits (`anon` sans `EXECUTE`), et `SELECT count(*) FROM tasks WHERE completed AND status <> 'done'` = 0.
- [ ] **Step 5 :** noter l'entrée de ledger et la relecture dans `supabase/migration/CLAUDE.md`
  (une ligne), commit `docs(db): mig. 214 appliquee, ledger …`.

---

## Partie B · Vue Tableau

### Task B1 : helpers du tableau

**Files :** Create `src/components/task-board/board.helpers.ts`, `board.helpers.test.ts`

- [ ] **Step 1 : tests qui échouent**

```ts
import { describe, it, expect } from 'vitest';
import { BOARD_COLUMNS, groupTasksByStatus, moveIntent } from './board.helpers';
import type { Task } from '@/modules/tasks';

const t = (p: Partial<Task>): Task => ({ id: p.id ?? Math.random().toString(), name: 'x', priority: 3, category: '', deadline: '', estimatedTime: 0, bookmarked: false, completed: false, ...p });
const NOW = new Date('2026-10-08T12:00:00Z');

describe('groupTasksByStatus', () => {
  it('quatre colonnes, vides comprises, dans l’ordre', () => {
    expect(BOARD_COLUMNS).toEqual(['todo', 'in_progress', 'blocked', 'done']);
    const g = groupTasksByStatus([], NOW);
    expect(Object.keys(g)).toEqual(BOARD_COLUMNS);
  });
  it('ligne ancienne sans statut : todo ou done selon completed', () => {
    const g = groupTasksByStatus([t({ id: 'a' }), t({ id: 'b', completed: true, completedAt: '2026-10-07T10:00:00Z' })], NOW);
    expect(g.todo.map(x => x.id)).toEqual(['a']);
    expect(g.done.map(x => x.id)).toEqual(['b']);
  });
  it('Terminée : 7 derniers jours seulement, plus récente d’abord', () => {
    const g = groupTasksByStatus([
      t({ id: 'old', completed: true, status: 'done', completedAt: '2026-09-20T10:00:00Z' }),
      t({ id: 'd1', completed: true, status: 'done', completedAt: '2026-10-02T10:00:00Z' }),
      t({ id: 'd2', completed: true, status: 'done', completedAt: '2026-10-08T09:00:00Z' }),
    ], NOW);
    expect(g.done.map(x => x.id)).toEqual(['d2', 'd1']);
  });
  it('colonnes ouvertes : en retard d’abord, puis échéance, puis priorité', () => {
    const g = groupTasksByStatus([
      t({ id: 'nodate', priority: 1 }),
      t({ id: 'late', deadline: '2026-10-01T00:00:00Z' }),
      t({ id: 'soon', deadline: '2026-10-10T00:00:00Z' }),
    ], NOW);
    expect(g.todo.map(x => x.id)).toEqual(['late', 'soon', 'nodate']);
  });
});

describe('moveIntent', () => {
  it('vers done : bascule', () => expect(moveIntent('todo', 'done')).toBe('toggle'));
  it('hors de done : statut', () => expect(moveIntent('done', 'in_progress')).toBe('status'));
  it('même colonne : rien', () => expect(moveIntent('blocked', 'blocked')).toBe('none'));
  it('entre colonnes ouvertes : statut', () => expect(moveIntent('todo', 'blocked')).toBe('status'));
});
```

- [ ] **Step 2 :** lancer → FAIL.
- [ ] **Step 3 : implémentation**

```ts
// Logique pure du Tableau perso : colonnes, tri, et ce qu'implique un déplacement.
import { effectiveStatus, type Task, type TaskStatus } from '@/modules/tasks';
import { isOverdue } from '@/lib/deadline';

export const BOARD_COLUMNS: readonly TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];
export const DONE_WINDOW_DAYS = 7;

const time = (iso?: string) => (iso ? Date.parse(iso) : Number.NaN);

function compareOpen(a: Task, b: Task, now: Date): number {
  const lateA = isOverdue(a.deadline, false, undefined, now) ? 0 : 1;
  const lateB = isOverdue(b.deadline, false, undefined, now) ? 0 : 1;
  if (lateA !== lateB) return lateA - lateB;
  const da = time(a.deadline || undefined), db = time(b.deadline || undefined);
  if (Number.isFinite(da) !== Number.isFinite(db)) return Number.isFinite(da) ? -1 : 1;
  if (Number.isFinite(da) && da !== db) return da - db;
  const pa = a.priority || 6, pb = b.priority || 6;
  return pa - pb;
}

export function groupTasksByStatus(tasks: readonly Task[], now: Date = new Date()): Record<TaskStatus, Task[]> {
  const out = Object.fromEntries(BOARD_COLUMNS.map((c) => [c, [] as Task[]])) as Record<TaskStatus, Task[]>;
  const doneFloor = now.getTime() - DONE_WINDOW_DAYS * 86_400_000;
  for (const task of tasks) {
    const status = effectiveStatus(task);
    if (status === 'done') {
      const at = time(task.completedAt);
      if (Number.isFinite(at) && at >= doneFloor) out.done.push(task);
    } else {
      out[status].push(task);
    }
  }
  for (const col of BOARD_COLUMNS) {
    if (col === 'done') out.done.sort((a, b) => time(b.completedAt) - time(a.completedAt));
    else out[col].sort((a, b) => compareOpen(a, b, now));
  }
  return out;
}

/** `toggle` : passer par la bascule (seule à générer l'occurrence récurrente). */
export function moveIntent(from: TaskStatus, to: TaskStatus): 'none' | 'toggle' | 'status' {
  if (from === to) return 'none';
  return to === 'done' ? 'toggle' : 'status';
}
```

  ⚠️ Vérifier la signature réelle de `isOverdue(deadline, completed, pref, now)` : passer
  `getTimezonePref()` plutôt que `undefined` si le paramètre n'est pas optionnel.
- [ ] **Step 4 :** relancer → PASS.
- [ ] **Step 5 :** commit `feat(tableau): colonnes, tri et intention de deplacement`.

### Task B2 : mémoire de la vue

**Files :** Create `src/components/task-board/view-mode.store.ts` (+ test)

- [ ] **Step 1 : test** : `readTasksView()` rend `'list'` sans valeur, `'board'` après
  `writeTasksView('board')`, `'list'` si la valeur stockée est `'xyz'`, et ne lève pas si
  `localStorage` lève (stub qui jette).
- [ ] **Step 2 :** FAIL. **Step 3 :** implémentation par `safeGetItem` / `safeSetItem`
  (`@/lib/safe-json`), clé `cosmo_tasks_view`, valeurs `'list' | 'board'`, plus un hook
  `useTasksView()` → `[view, setView]` (`useState` initialisé par `readTasksView`, écriture à chaque
  changement). **Step 4 :** PASS. **Step 5 :** commit.

### Task B3 : déplacement d'une tâche

**Files :** Create `src/components/task-board/use-move-task.ts`

- [ ] **Step 1 :** hook `useMoveTask()` qui rend `move(task: Task, to: TaskStatus)` :
  `moveIntent(effectiveStatus(task), to)` ; `'toggle'` → `useToggleTaskComplete().mutate(task.id)` ;
  `'status'` → `useUpdateTask().mutate({ id: task.id, updates: { status: to } })`. Les erreurs
  sont déjà affichées par les hooks (`onError`) : ne rien ajouter.
- [ ] **Step 2 :** `npm run typecheck`. Commit avec B4.

### Task B4 : composants du Tableau

**Files :** Create `TaskBoard.tsx`, `TaskBoardColumn.tsx`, `TaskBoardCard.tsx`, `TaskHealthMenu.tsx`,
`MoveTaskSheet.tsx`, `ViewModeToggle.tsx` dans `src/components/task-board/`

- [ ] **Step 1 : `TaskHealthMenu`** : même rendu que `components/organization/HealthStateMenu`
  (déclencheur 32 px, pastille `HEALTH_DOT` importée de `components/organization/health-state.helpers`,
  sinon icône `Activity`), mais libellés du catalogue `tasks` (`board.health.*`) et une entrée
  « Effacer l'état » qui écrit `health: null`. Écriture par `useUpdateTask`. Désactivé avec la
  raison en `title` si la tâche est partagée en lecture seule.
- [ ] **Step 2 : `TaskBoardCard`** : `<article>` focalisable (`tabIndex=0`), `draggable` sur desktop
  quand la tâche est modifiable, `onDragStart` pose `{ taskId }` en `application/x-cosmo-task`.
  Contenu : nom (barré si terminée), pastille de catégorie (`useCategoryColor`), échéance
  (`deadlineDayKey`, rouge si `isOverdue`), priorité (`priorityColor`), `TaskHealthMenu`, et un
  bouton « Déplacer vers… » (icône `ArrowRightLeft`, 44 px sur mobile, visible au focus sur
  desktop). Clic ou Entrée : `onOpen(task)`. `onContextMenu` : ouvre « Déplacer vers… »
  (C-111 : un geste n'est jamais le seul chemin), annoncé par `aria-keyshortcuts="Shift+F10"`.
- [ ] **Step 3 : `TaskBoardColumn`** : en-tête (pastille, libellé `board.columns.<status>`, compteur),
  zone de dépôt (`onDragOver` + `onDrop` qui lit `application/x-cosmo-task`), liste des cartes,
  pied « + Ajouter » qui ouvre une saisie rapide : Entrée crée par `useCreateTask` avec
  `parseQuickAdd` (`@/lib/quick-add-parser`) pour le nom, l'échéance, la priorité et la durée, et
  `status` de la colonne (`done` exclu : pas de « + » sur Terminée). Échap ferme la saisie. Le pied
  de « Terminée » dit « 7 derniers jours ».
- [ ] **Step 4 : `MoveTaskSheet`** : `BottomSheet` (`@/components/mobile`) sur mobile, petit menu
  ancré sur desktop ; quatre entrées, la colonne courante cochée et désactivée ; choisir appelle
  `move()` et ferme.
- [ ] **Step 5 : `TaskBoard`** : props `{ tasks: Task[] }` (déjà filtrées par la page).
  `groupTasksByStatus(tasks)` en `useMemo` ; grille `md:grid-cols-4` sur desktop, défilement
  horizontal aimanté sur mobile (`flex overflow-x-auto snap-x snap-mandatory`, colonnes
  `min-w-[85vw] snap-start`) ; état local `openTask` qui monte `TaskModal` (`isOpen`, `task`,
  `onClose`) ; état `moveTarget` pour `MoveTaskSheet`. Une tâche reçue en lecture seule
  (`sharedBy` défini et pas `editor`) n'est pas glissable : réutiliser le même critère que
  `TaskCard` pour décider si une tâche est modifiable.
- [ ] **Step 6 : `ViewModeToggle`** : deux boutons segmentés (`LayoutList`, `SquareKanban`),
  `aria-pressed`, libellés `board.view.list` / `board.view.board`.
- [ ] **Step 7 :** `npm run typecheck` et `npm run lint` → 0 erreur. Commit
  `feat(tableau): vue Tableau des taches perso`.

### Task B5 : branchement dans la page Tâches

**Files :** Modify `src/pages/TasksPage.tsx` (558 lignes : rester sous 600), `src/pages/tasks/TasksHeader.tsx`

- [ ] **Step 1 :** `const [tasksView, setTasksView] = useTasksView();`. Monter `ViewModeToggle` dans
  `TasksHeader` (nouvelle prop `view` / `onViewChange`), desktop et mobile.
- [ ] **Step 2 :** remplacer le rendu `<TaskTable …/>` par
  `tasksView === 'board' ? <TaskBoard tasks={filteredTasks} /> : <TaskTable …/>`, avec `TaskBoard`
  chargé en `lazy` (`lazyWithRetry` comme les autres chunks paresseux de la page), derrière
  `<Suspense fallback={<TaskListSkeleton count={6} />}>`.
- [ ] **Step 3 :** `wc -l src/pages/TasksPage.tsx` < 600 ; `npx vitest run src/architecture.guard.test.ts`.
- [ ] **Step 4 :** commit `feat(taches): bascule Liste / Tableau`.

### Task B6 : Statut et État dans la fiche, badges en vue Liste

**Files :** Create `src/components/task-modal/TaskStateFields.tsx`, `src/components/task-table/TaskStateBadges.tsx` ;
Modify `DesktopDetailsStep.tsx` (545), `TaskModalMobileBody.tsx` (575), `TaskCard.tsx` (549),
le rendu de ligne desktop (`list.tsx`, 537)

- [ ] **Step 1 : `TaskStateFields`** (`taskId`, `status`, `health`) : un groupe segmenté pour les quatre
  statuts (`role="radiogroup"`) et un sélecteur d'État (trois pastilles + « Aucun »). Chaque choix
  persiste tout de suite par `useMoveTask` (statut) et `useUpdateTask` (état), comme
  `SubtaskChecklist`. Rendu en édition seulement.
- [ ] **Step 2 :** l'insérer juste au-dessus de `SubtaskChecklist` en édition, dans les deux corps de fiche.
- [ ] **Step 3 : `TaskStateBadges`** (`task`) : étiquette `board.columns.in_progress` / `blocked`
  quand le statut est l'un des deux, pastille d'État si `health`. Rien sinon. L'insérer à côté du
  nom dans `TaskCard` (mobile) et dans la ligne desktop.
- [ ] **Step 4 :** vérifier les quatre plafonds de lignes ; typecheck ; lint. Commit
  `feat(taches): statut et etat dans la fiche et en liste`.

### Task B7 : libellés

**Files :** Modify `src/locales/fr/tasks.json`, `src/locales/en/tasks.json`

- [ ] Ajouter le bloc `board` : `view.{list,board}`, `columns.{todo,in_progress,blocked,done}`
  (À faire / En cours / Bloquée / Terminée · To do / In progress / Blocked / Done),
  `health.{label,on_track,at_risk,off_track,none,clear}` (Dans les temps / À risque / En difficulté),
  `doneWindow` (« 7 derniers jours »), `add`, `addPlaceholder`, `moveTo`, `moveToAria`, `readOnly`,
  `empty`, `statusLabel`.
- [ ] `npm run i18n:check`, `npm run i18n:scan`, `npm run i18n:identical` → `$?` = 0 chacun.
- [ ] Commit `i18n(tableau): libelles fr et en`.

### Task B8 : vérification navigateur (démo)

- [ ] `preview_start` sur la config de `.claude/launch.json` ; entrer en démo ; page Tâches.
- [ ] Basculer en Tableau ; glisser une carte de À faire à En cours (desktop) ; « Déplacer vers… »
  au clavier (`Shift+F10`) ; déposer dans Terminée : la tâche disparaît des ouvertes, toast
  « Annuler » ; une tâche récurrente déposée dans Terminée génère son occurrence en À faire.
- [ ] Poser un État depuis la carte, le relire dans la fiche ; filtres de la page appliqués au Tableau.
- [ ] Mobile 375 px : défilement aimanté, « Déplacer vers… » en feuille du bas.
- [ ] Console sans erreur ; capture.

---

## Partie C · Convertir une sous-tâche en tâche

### Task C1 : hook de conversion

**Files :** Create `src/components/task-modal/use-promote-subtask.ts`, `use-promote-subtask.test.ts`

- [ ] **Step 1 : tests** (logique pure extraite : `buildPromotion(parent, subtaskId)` rend
  `{ input, remaining, index }` ou `null`)

```ts
import { describe, it, expect } from 'vitest';
import { buildPromotion, restoreSubtask } from './use-promote-subtask';

const parent = { id: 'p', name: 'P', priority: 2, category: 'cat-1', deadline: '2026-10-09T00:00:00Z', estimatedTime: 30, bookmarked: true, completed: false,
  subtasks: [{ id: 's1', name: 'Un', completed: false }, { id: 's2', name: 'Deux', completed: false }, { id: 's3', name: 'Trois', completed: true }] };

describe('buildPromotion', () => {
  it('hérite catégorie et priorité, pas l’échéance ni le favori, retire la sous-tâche', () => {
    const r = buildPromotion(parent, 's2')!;
    expect(r.input).toMatchObject({ name: 'Deux', category: 'cat-1', priority: 2, deadline: '', bookmarked: false, completed: false, status: 'todo', estimatedTime: 0 });
    expect(r.remaining.map(s => s.id)).toEqual(['s1', 's3']);
    expect(r.index).toBe(1);
  });
  it('refuse une sous-tâche cochée ou inconnue', () => {
    expect(buildPromotion(parent, 's3')).toBeNull();
    expect(buildPromotion(parent, 'nope')).toBeNull();
  });
  it('restoreSubtask la remet à sa place', () => {
    const r = buildPromotion(parent, 's2')!;
    expect(restoreSubtask(r.remaining, parent.subtasks[1], r.index).map(s => s.id)).toEqual(['s1', 's2', 's3']);
  });
});
```

- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter `buildPromotion`, `restoreSubtask` (bornée à la
  longueur courante), et `usePromoteSubtask(taskId)` : lit le parent (`useTask`), `create` par
  `useCreateTask().mutateAsync(input)` D'ABORD, puis `useUpdateTask().mutate({ id: parentId, updates: { subtasks: remaining } })`,
  puis `showUndoToast(t('subtasks.promoted', { name }), undo)` où `undo` supprime la tâche créée
  (`useDeleteTask`) et réécrit `restoreSubtask(...)` sur le parent relu dans le cache.
  Si la création échoue, ne rien retirer. Le hook rend aussi `pending`.
- [ ] **Step 4 :** PASS. **Step 5 :** commit `feat(sous-taches): conversion en tache, annulable`.

### Task C2 : bouton dans la checklist

**Files :** Modify `src/components/task-modal/SubtaskChecklist.tsx`, locales `tasks.json`

- [ ] Sur chaque sous-tâche NON cochée en mode édition (`taskId` présent, pas en mode contrôlé) :
  bouton icône `ArrowUpRight`, `aria-label={t('subtasks.promote', { name })}`,
  `title` identique, visible sur mobile (`opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100`),
  placé avant la croix. Le clic appelle le hook puis retire l'élément de `localItems` (la
  liste locale est la source d'affichage).
- [ ] Libellés `subtasks.promote` (« Convertir « {{name}} » en tâche » / « Turn "{{name}}" into a task »)
  et `subtasks.promoted` (« Sous-tâche convertie en tâche » / « Subtask turned into a task »).
- [ ] i18n gardes ; typecheck ; vérification navigateur (démo : convertir, retrouver la tâche dans
  la liste, Annuler, la sous-tâche revient à sa place). Commit `feat(sous-taches): bouton Convertir en tache`.

---

## Partie D · Import

### Task D1 : analyseur CSV

**Files :** Create `src/lib/task-import/csv.ts`, `csv.test.ts`

- [ ] **Step 1 : tests**

```ts
import { describe, it, expect } from 'vitest';
import { parseCsv, detectDelimiter } from './csv';

describe('parseCsv', () => {
  it('guillemets, guillemet doublé, retour à la ligne dans un champ', () => {
    expect(parseCsv('a,b\n"x ""y""","1\n2"\n')).toEqual([['a', 'b'], ['x "y"', '1\n2']]);
  });
  it('BOM et CRLF', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('point-virgule et tabulation', () => {
    expect(parseCsv('a;b\n1;2', ';')).toEqual([['a', 'b'], ['1', '2']]);
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('"a,1";b;c')).toBe(';');
  });
  it('lignes vides ignorées', () => {
    expect(parseCsv('a\n\n1\n')).toEqual([['a'], ['1']]);
  });
});
```

- [ ] **Step 2 :** FAIL. **Step 3 :** machine à états caractère par caractère (champ, guillemets,
  fin de ligne), BOM retiré, `\r\n` et `\r` normalisés ; `detectDelimiter` compte `,` `;` `\t` hors
  guillemets sur la première ligne non vide et rend le plus fréquent (`,` par défaut).
  **Step 4 :** PASS. **Step 5 :** commit.

### Task D2 : forme intermédiaire, dates, priorités

**Files :** Create `src/lib/task-import/types.ts`, `dates.ts`, `dates.test.ts`

- [ ] `types.ts` :

```ts
import type { TaskRecurrence } from '@/modules/tasks';

export type ImportSource = 'todoist' | 'ticktick' | 'generic';

export interface ImportedTask {
  name: string;
  description?: string;
  /** Jour `YYYY-MM-DD`, jamais un instant (`deadlineFromDayKey` à l'écriture). */
  dueDay?: string;
  /** 0 = non définie, 1..5 comme COSMO. */
  priority: number;
  completed: boolean;
  /** Du parent vers l'enfant, ex. ['Travail', 'Clients']. Vide = sans catégorie. */
  categoryPath: string[];
  subtasks: string[];
  recurrence: TaskRecurrence;
  /** Numéro de ligne dans le fichier, pour les messages. */
  line: number;
}

export interface SkippedRow { line: number; reason: 'empty_title' | 'unsupported_type' | 'orphan_subtask' | 'over_limit' }

export interface ParsedImport { source: ImportSource; fileName: string; tasks: ImportedTask[]; skipped: SkippedRow[] }
```

- [ ] `dates.test.ts` : `parseDay('2026-10-09')` → `'2026-10-09'` ; `'2026-10-09T15:00:00+0000'` →
  `'2026-10-09'` ; `'2026-10-09 15:00:00'` → `'2026-10-09'` ; `'9 Oct 2026'`, `'Oct 9 2026'`,
  `'October 9, 2026'`, `'9 octobre 2026'`, `'09/10/2026'` (jour/mois) → `'2026-10-09'` ;
  `'next week'` → `undefined`. `parseRecurrence('every day')`, `'every! week'`, `'tous les jours'`,
  `'chaque semaine'`, `'every month'`, `'FREQ=DAILY;INTERVAL=1'`, `'RRULE:FREQ=WEEKLY'` → `daily` /
  `weekly` / `monthly` ; `'FREQ=DAILY;INTERVAL=2'` et `'every 2 days'` → `'none'`.
  `mapPriority('todoist', '4')` → `0`, `'1'` → `1` ; `mapPriority('ticktick', '5')` → `1`, `'3'` → `2`,
  `'1'` → `4`, `'0'` → `0` ; `mapPriority('generic', 'High')` / `'Haute'` / `'P1'` → `1`,
  `'Medium'` / `'Moyenne'` → `3`, `'Low'` / `'Basse'` → `5`, `'2'` → `2`, `'abc'` → `0`.
- [ ] Implémenter `parseDay`, `parseRecurrence`, `mapPriority` sans dépendance (mois `en`/`fr` en
  table, `NFD` pour les accents). Jour seul en sortie : JAMAIS `new Date('YYYY-MM-DD')`.
- [ ] PASS, commit `feat(import): dates, recurrences et priorites`.

### Task D3 : adaptateur Todoist

**Files :** Create `src/lib/task-import/todoist.ts`, `todoist.test.ts`, `__fixtures__/todoist-travail.csv`

- [ ] Fichier exemple (en-tête réel `TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT,DEADLINE,DEADLINE_LANG`)
  avec : une tâche p1 datée `2026-10-09` ; une section « Clients » ; une tâche sous la section avec
  `@urgent @tel` ; deux tâches `INDENT 2` sous elle ; une `note` ; une tâche `every week` ;
  une ligne `task` au contenu vide.
- [ ] Tests : `parseTodoist(rows, 'Travail.csv')` rend 4 tâches ; la 1re `{ priority: 1, dueDay: '2026-10-09', categoryPath: ['Travail'] }` ;
  celle sous la section `{ categoryPath: ['Travail', 'Clients'], subtasks: ['…', '…'] }`, nom sans
  `@urgent`, description contenant « urgent, tel » et la note ; la récurrente `recurrence: 'weekly'` ;
  `skipped` contient la ligne vide (`empty_title`). Un `INDENT 3` est rattaché comme sous-tâche
  de la tâche de niveau 1 (COSMO n'a qu'un niveau). Une sous-tâche sans parent → `orphan_subtask`.
- [ ] Implémenter : index des colonnes par nom d'en-tête (jamais par position), nom de fichier sans
  extension ni suffixe ` [ID]` → catégorie racine, section courante → sous-catégorie, `DATE`
  illisible recopié en description (« Échéance d'origine : … » via une clé passée en paramètre,
  pas de texte en dur), `DEADLINE` prioritaire sur `DATE` pour l'échéance.
- [ ] PASS, commit.

### Task D4 : adaptateur TickTick

**Files :** Create `src/lib/task-import/ticktick.ts`, `ticktick.test.ts`, `__fixtures__/ticktick-backup.csv`

- [ ] Fichier exemple : trois lignes de métadonnées (`"Date: 2026-10-08+0000"`, `"Version: 7.1"`,
  `"Status: \n0 Normal\n1 Completed\n2 Archived"`), puis l'en-tête
  `"Folder Name","List Name","Title","Kind","Tags","Content","Is Check list","Start Date","Due Date","Reminder","Repeat","Priority","Status","Created Time","Completed Time","Order","Timezone","Is All Day","Is Floating","Column Name","Column Order","View Mode","taskId","parentId"`,
  et : une tâche `Perso / Maison` priorité 5 due `2026-10-09T22:00:00+0000` ; une sous-tâche
  (`parentId`) ; une checklist (`Kind CHECKLIST`, contenu `▫Lait\n▪Pain`) ; une tâche terminée
  (`Status 2`) ; une tâche `Repeat FREQ=DAILY;INTERVAL=1` sans dossier.
- [ ] Tests : métadonnées sautées ; `categoryPath` `['Perso', 'Maison']` et `['Inbox']` pour une
  liste sans dossier ; priorité 1 ; `dueDay` lu dans le fuseau de la colonne `Timezone` quand il
  est présent, sinon le jour UTC ; sous-tâche rattachée ; checklist → `subtasks: ['Lait', 'Pain']` ;
  terminée `completed: true` ; récurrence `daily`.
- [ ] Implémenter : recherche de la ligne d'en-tête dans les LIGNES DÉJÀ ANALYSÉES (contient
  `Folder Name`, `List Name` et `Title`) ; deux passes (parents, puis enfants par `parentId`).
- [ ] PASS, commit.

### Task D5 : CSV générique et Notion

**Files :** Create `src/lib/task-import/generic.ts`, `generic.test.ts`

- [ ] Types : `ColumnRole = 'title' | 'description' | 'due' | 'category' | 'priority' | 'done'` ;
  `ColumnMapping = Partial<Record<ColumnRole, number>>`.
- [ ] Tests : `guessMapping(['Name', 'Status', 'Due Date', 'Priority', 'Project', 'Notes'])` →
  `{ title: 0, done: 1, due: 2, priority: 3, category: 4, description: 5 }` ; en-têtes français
  (`Nom`, `Statut`, `Échéance`, `Priorité`, `Projet`, `Description`) ; sans colonne reconnue comme
  titre → `title: 0`. `parseGeneric(rows, mapping, 'Base.csv')` : `done` vrai pour `Done`, `Terminé`,
  `Complete`, `Yes`, `Oui`, `☑`, `true` ; date Notion `October 9, 2026 3:00 PM` → `2026-10-09` ;
  catégorie `Travail/Clients` découpée en chemin ; titre vide → `skipped`.
- [ ] PASS, commit.

### Task D6 : reconnaissance du format

**Files :** Create `src/lib/task-import/detect.ts`, `detect.test.ts`

- [ ] `detectFormat(rows)` → `'todoist'` si la première ligne contient `TYPE` et `CONTENT` ;
  `'ticktick'` si une des 30 premières lignes contient `Folder Name`, `List Name` et `Title` ;
  sinon `'generic'`. Tests sur les deux fichiers exemples et un CSV Notion de trois colonnes.
- [ ] PASS, commit.

### Task D7 : plan d'import

**Files :** Create `src/lib/task-import/plan.ts`, `plan.test.ts`

- [ ] Interface :

```ts
export const IMPORT_LIMIT = 2000;
export interface ImportPlan {
  tasks: ImportedTask[];
  /** Chemins à créer, parents avant enfants, ex. [['Travail'], ['Travail', 'Clients']]. */
  categoriesToCreate: string[][];
  skipped: SkippedRow[];
  completedExcluded: number;
}
export function buildImportPlan(parsed: ParsedImport[], existing: readonly Category[], opts: { includeCompleted: boolean }): ImportPlan;
export function resolveCategoryId(path: string[], byPath: ReadonlyMap<string, string>): string;
export const pathKey = (path: string[]) => path.map(normalizeName).join('\u0000');
```

- [ ] Tests : une catégorie existante `Travail` (casse et accents différents : `travail`) n'est
  PAS recréée, sa fille `Clients` l'est ; terminées exclues par défaut et comptées dans
  `completedExcluded` ; au-delà de 2 000 tâches, le surplus passe en `skipped` avec `over_limit` ;
  deux fichiers fusionnés ; ordre parents avant enfants.
- [ ] Implémentation : arbre existant parcouru depuis les racines (`parentId: null`), noms comparés
  par `normalizeName` (minuscules, `NFD`, sans diacritiques, espaces réduits).
- [ ] PASS, commit.

### Task D8 : exécution et annulation

**Files :** Create `src/lib/task-import/execute.ts`, `execute.test.ts`

- [ ] Interface (sans React, les dépendances sont injectées) :

```ts
export interface ImportDeps {
  createCategory: (input: { name: string; parentId: string | null }) => Promise<{ id: string }>;
  createTask: (input: CreateTaskInput) => Promise<{ id: string }>;
  deleteTask: (id: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  toDeadline: (dayKey: string) => string; // deadlineFromDayKey
}
export interface ImportResult { createdTaskIds: string[]; createdCategoryIds: string[]; failures: { line: number; message: string }[] }
export async function runImport(plan: ImportPlan, existing: readonly Category[], deps: ImportDeps, onProgress: (done: number, total: number) => void, concurrency?: number): Promise<ImportResult>;
export async function undoImport(result: ImportResult, deps: ImportDeps): Promise<{ failed: number }>;
```

- [ ] Tests avec de faux `deps` : catégories créées une par une, parents d'abord, et leurs ids
  utilisés par les enfants ; tâches créées avec `deadline: toDeadline(dueDay)`,
  `subtasks` en `{ id, name, completed: false }`, `status: completed ? 'done' : 'todo'` ; une
  création qui rejette n'arrête pas les autres et finit dans `failures` ; jamais plus de
  `concurrency` créations en vol (compteur dans le faux) ; `onProgress` appelé jusqu'à `total` ;
  `undoImport` supprime toutes les tâches puis les catégories créées, enfants avant parents.
- [ ] Implémentation : file simple à `concurrency` (défaut 4) travailleurs ; une catégorie qui échoue
  fait tomber ses tâches dans `failures` avec la ligne. Sous-tâches plafonnées à 50 (garde zod).
- [ ] PASS, commit `feat(import): plan, execution par lots et annulation`.

### Task D9 : fenêtre d'import

**Files :** Create `src/pages/settings/ImportTasksDialog.tsx`, `ImportColumnMapping.tsx` ;
Modify `src/pages/settings/DataTab.tsx`, `src/locales/{fr,en}/settings.json`

- [ ] **`DataTab`** : remplacer la mention « bientôt disponible » par une carte « Importer depuis
  Todoist, TickTick ou Notion » avec un bouton qui ouvre `ImportTasksDialog` (chargé en `lazy`).
  Supprimer `data.importNotice` / `data.importNoticeRest` des deux catalogues.
- [ ] **`ImportTasksDialog`** : `ui/dialog` sur desktop, `BottomSheet` sur mobile. Étapes :
  1. **Fichiers** : `<input type="file" accept=".csv,text/csv" multiple>` + zone de dépôt ; refus
     au-delà de 5 Mo (message) ; lecture par `file.text()` ; `detectFormat`.
  2. **Colonnes** (seulement si un fichier est `generic`) : `ImportColumnMapping` (un `<select>` par
     rôle, aperçu des trois premières lignes, titre obligatoire).
  3. **Aperçu** : nombre de tâches, liste des catégories à créer, lignes ignorées avec raison
     (traduite), case « Inclure les tâches terminées » (décochée), bouton « Importer N tâches ».
  4. **Import** : barre de progression (`role="progressbar"`, `aria-valuenow`), fermeture refusée
     pendant l'exécution (Échap compris, cf. `src/components/CLAUDE.md`).
  5. **Fin** : « N tâches importées », échecs listés, bouton « Annuler l'import » (`undoImport`),
     bouton « Voir mes tâches » (`navigate('/tasks')`).
  Les dépendances de `runImport` viennent des repositories (`getTasksRepository`,
  `getCategoriesRepository` de `@/lib/repository.factory`) ; à la fin, invalider
  `taskKeys.lists()` et `categoryKeys.lists()`.
- [ ] Libellés `settings.json` (`import.*`), fr et en ; gardes i18n ; typecheck ; lint.
- [ ] Commit `feat(import): fenetre d'import dans Reglages > Donnees`.

### Task D10 : vérification navigateur (démo)

- [ ] Importer les deux fichiers exemples et un CSV Notion de test (écrit dans le scratchpad) en
  démo ; vérifier les catégories créées, les sous-tâches, les échéances au bon jour, l'aperçu, la
  progression, « Annuler l'import » qui remet tout à l'état d'avant.
- [ ] Mobile 375 px : la feuille du bas, les étapes lisibles.
- [ ] Console sans erreur ; capture.

---

## Partie E · Avant de pousser

- [ ] `npm run lint`, `npm run typecheck`, `npm test` (lire `$?` et le NOMBRE de fichiers), puis
  `npm run i18n:check`, `npm run i18n:scan`, `npm run i18n:identical`, `npm run check:bundle`
  (gardes hors `vitest run`, mémoire « Gardes globales avant push »).
- [ ] Le front qui écrit `status` / `health` ne part QU'APRÈS l'application de la `214` (Task A5).
  Si la migration n'est pas encore appliquée, pousser les parties C et D d'abord, et garder
  A3-B7 sur une branche.
- [ ] Mettre à jour `src/modules/tasks/CLAUDE.md` (une règle : glisser vers Terminée passe par la
  bascule) et retirer la ligne « Import … bientôt » s'il en reste une trace dans la doc.
