// ═══════════════════════════════════════════════════════════════════
// Tableau des tâches d'équipe : colonnes, regroupement, export
// (audit 2026-09-24, onglet Tâches : « colonnes configurables, regroupement,
// export, colonne Assignés avec Vous »). Logique PURE, testée à part.
// ═══════════════════════════════════════════════════════════════════

import type { TeamTask } from '@/modules/team-projects';
import type { TaskGroupBy } from './task-filters';
import { STATUS_ORDER } from './team-projects.helpers';

/** Colonnes qu'on peut masquer. Nom, case, pastille et actions restent toujours. */
export type TaskColumnId = 'project' | 'status' | 'assignees' | 'priority' | 'start' | 'deadline' | 'duration' | 'category';
export const TASK_COLUMNS: readonly TaskColumnId[] = ['project', 'status', 'assignees', 'priority', 'start', 'deadline', 'duration', 'category'];
export const DEFAULT_TASK_COLUMNS: readonly TaskColumnId[] = ['project', 'status', 'assignees', 'priority', 'deadline', 'duration'];

// ⚠️ Préférence d'AFFICHAGE, par personne et par appareil : le stockage local,
// jamais la base (même règle que `org-pins.ts`). Lecture tolérante.
const columnsKey = (orgId: string) => `cosmo_org_task_columns_${orgId}`;

export const readTaskColumns = (orgId: string): TaskColumnId[] => {
  try {
    const raw = localStorage.getItem(columnsKey(orgId));
    if (!raw) return [...DEFAULT_TASK_COLUMNS];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_TASK_COLUMNS];
    // Ordre canonique, doublons et inconnues retirés : une valeur corrompue ne
    // peut ni dupliquer une colonne ni en inventer une.
    return TASK_COLUMNS.filter((c) => parsed.includes(c));
  } catch {
    return [...DEFAULT_TASK_COLUMNS];
  }
};

export const writeTaskColumns = (orgId: string, columns: readonly TaskColumnId[]): void => {
  try {
    localStorage.setItem(columnsKey(orgId), JSON.stringify(TASK_COLUMNS.filter((c) => columns.includes(c))));
  } catch { /* stockage indisponible : la préférence ne survit pas, l'écran si */ }
};

// ─── Regroupement ───────────────────────────────────────────────────

export interface TaskGroup {
  /** Clé stable du groupe (id de projet, statut, id de personne, priorité). */
  key: string;
  tasks: TeamTask[];
}

export const UNASSIGNED_GROUP = '__none__';

/**
 * Découpe une liste DÉJÀ triée en groupes, sans changer l'ordre interne.
 *
 * Par assigné, une tâche à plusieurs personnes apparaît sous CHACUNE : c'est
 * la question que pose ce regroupement (« qu'a chacun sur les bras ? »). Les
 * autres regroupements sont des partitions.
 *
 * Ordre des groupes : celui du flux pour les statuts, P1→P5 pour les
 * priorités, `orderOf` (le nom) pour projets et personnes, « personne » en
 * dernier.
 */
export function groupTasks(
  tasks: readonly TeamTask[],
  by: TaskGroupBy,
  orderOf: (key: string) => string = (k) => k,
): TaskGroup[] {
  if (by === 'none') return [{ key: 'all', tasks: [...tasks] }];
  const groups = new Map<string, TeamTask[]>();
  const push = (key: string, task: TeamTask) => {
    const list = groups.get(key);
    if (list) list.push(task);
    else groups.set(key, [task]);
  };
  for (const task of tasks) {
    if (by === 'project') push(task.projectId, task);
    else if (by === 'status') push(task.status, task);
    else if (by === 'priority') push(String(task.priority), task);
    else if (task.assigneeIds.length === 0) push(UNASSIGNED_GROUP, task);
    else for (const id of task.assigneeIds) push(id, task);
  }
  const keys = [...groups.keys()];
  if (by === 'status') keys.sort((a, b) => STATUS_ORDER.indexOf(a as TeamTask['status']) - STATUS_ORDER.indexOf(b as TeamTask['status']));
  else if (by === 'priority') keys.sort((a, b) => Number(a) - Number(b));
  else {
    keys.sort((a, b) => {
      if (a === UNASSIGNED_GROUP) return 1;
      if (b === UNASSIGNED_GROUP) return -1;
      return orderOf(a).localeCompare(orderOf(b));
    });
  }
  return keys.map((key) => ({ key, tasks: groups.get(key) ?? [] }));
}

/** Lignes à peindre : en-têtes de groupe puis tâches, les groupes repliés ne montrant que leur en-tête. */
export type TaskTableLine =
  | { kind: 'group'; key: string; count: number; collapsed: boolean }
  | { kind: 'task'; key: string; task: TeamTask };

export function flattenGroups(groups: readonly TaskGroup[], grouped: boolean, collapsed: ReadonlySet<string>): TaskTableLine[] {
  const out: TaskTableLine[] = [];
  for (const g of groups) {
    const isCollapsed = collapsed.has(g.key);
    if (grouped) out.push({ kind: 'group', key: g.key, count: g.tasks.length, collapsed: isCollapsed });
    if (grouped && isCollapsed) continue;
    // La clé d'une ligne porte son groupe : par assigné, la même tâche peut
    // figurer deux fois, et React exige des clés uniques.
    for (const task of g.tasks) out.push({ kind: 'task', key: `${g.key}:${task.id}`, task });
  }
  return out;
}

// ─── Export CSV ─────────────────────────────────────────────────────

export interface TaskCsvLabels {
  headers: { name: string; project: string; status: string; priority: string; start: string; deadline: string; duration: string; assignees: string; category: string; createdAt: string };
  statusOf: (task: TeamTask) => string;
  projectOf: (projectId: string) => string;
  personOf: (userId: string) => string;
  categoryOf: (categoryId: string) => string;
}

/**
 * Export des tâches AFFICHÉES (filtres et tri appliqués), jamais de l'ensemble
 * lu : on exporte ce qu'on voit. Pas d'identifiant interne ni de description :
 * un fichier qui sort de l'application n'emporte que ce que le tableau montre.
 * L'échappement anti-formule (faille N11) est fait par `downloadCSV`.
 */
export function buildTasksCsv(tasks: readonly TeamTask[], labels: TaskCsvLabels): { headers: string[]; rows: string[][] } {
  const h = labels.headers;
  return {
    headers: [h.name, h.project, h.status, h.priority, h.start, h.deadline, h.duration, h.assignees, h.category, h.createdAt],
    rows: tasks.map((task) => [
      task.name,
      labels.projectOf(task.projectId),
      labels.statusOf(task),
      `P${task.priority}`,
      task.startDate ?? '',
      task.deadline ?? '',
      String(task.estimatedTime ?? 0),
      task.assigneeIds.map(labels.personOf).filter(Boolean).join(' | '),
      task.categoryId ? labels.categoryOf(task.categoryId) : '',
      task.createdAt.slice(0, 10),
    ]),
  };
}
