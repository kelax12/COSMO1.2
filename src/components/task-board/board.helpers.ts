// ═══════════════════════════════════════════════════════════════════
// Tableau des tâches perso : colonnes, tri, et ce qu'implique un déplacement
// ═══════════════════════════════════════════════════════════════════
//
// Logique pure, testée dans board.helpers.test.ts. Le Tableau reçoit des
// tâches DÉJÀ filtrées par la page (recherche, liste, catégories) : il ne
// filtre rien d'autre que la fenêtre de « Terminée ».
import { effectiveStatus, type Task, type TaskStatus } from '@/modules/tasks';
import { isOverdue } from '@/lib/deadline';

/** Ordre des colonnes, vides comprises : une colonne qui n'apparaîtrait qu'une
 *  fois remplie empêcherait d'y déposer la première carte. */
export const BOARD_COLUMNS: readonly TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];

/** « Terminée » ne montre que les tâches finies récemment : sinon la colonne
 *  porterait tout l'historique et noierait les trois autres. */
export const DONE_WINDOW_DAYS = 7;

const DAY_MS = 86_400_000;
const instant = (iso?: string): number => (iso ? Date.parse(iso) : Number.NaN);

/** Priorité 0 = « non définie » : rangée après P5. */
const priorityRank = (p: number): number => (p >= 1 && p <= 5 ? p : 6);

function compareOpen(a: Task, b: Task, now: Date): number {
  const lateA = isOverdue(a.deadline, false, undefined, now);
  const lateB = isOverdue(b.deadline, false, undefined, now);
  if (lateA !== lateB) return lateA ? -1 : 1;

  const da = instant(a.deadline || undefined);
  const db = instant(b.deadline || undefined);
  const hasA = Number.isFinite(da);
  const hasB = Number.isFinite(db);
  if (hasA !== hasB) return hasA ? -1 : 1;
  if (hasA && hasB && da !== db) return da - db;

  return priorityRank(a.priority) - priorityRank(b.priority);
}

export type BoardColumns = Record<TaskStatus, Task[]>;

export function groupTasksByStatus(tasks: readonly Task[], now: Date = new Date()): BoardColumns {
  const columns = Object.fromEntries(BOARD_COLUMNS.map((c) => [c, [] as Task[]])) as BoardColumns;
  const doneFloor = now.getTime() - DONE_WINDOW_DAYS * DAY_MS;

  for (const task of tasks) {
    const status = effectiveStatus(task);
    if (status !== 'done') {
      columns[status].push(task);
      continue;
    }
    const at = instant(task.completedAt);
    if (Number.isFinite(at) && at >= doneFloor) columns.done.push(task);
  }

  for (const status of BOARD_COLUMNS) {
    if (status === 'done') columns.done.sort((a, b) => instant(b.completedAt) - instant(a.completedAt));
    else columns[status].sort((a, b) => compareOpen(a, b, now));
  }
  return columns;
}

/**
 * Ce qu'un déplacement de carte doit écrire.
 *
 * 🔴 `toggle` vers Terminée, jamais un `update({ status: 'done' })` : seule la
 * RPC `toggle_task_complete_v2` génère l'occurrence suivante d'une tâche
 * récurrente (`src/modules/tasks/CLAUDE.md`). Un statut écrit à la main
 * cocherait la tâche (trigger 214) sans jamais créer la suivante.
 */
export function moveIntent(from: TaskStatus, to: TaskStatus): 'none' | 'toggle' | 'status' {
  if (from === to) return 'none';
  return to === 'done' ? 'toggle' : 'status';
}
