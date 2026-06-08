// ═══════════════════════════════════════════════════════════════════
// Tasks — filtrage & tri (logique pure extraite de TaskTable.tsx pour
// testabilité + réutilisation). Comportement IDENTIQUE à l'inline d'origine
// (god component refactor #6, étape 1). Aucune dépendance React/DOM.
// ═══════════════════════════════════════════════════════════════════
import { Task } from './types';

export type TaskQuickFilter = 'none' | 'favoris' | 'terminées' | 'retard' | 'collaboration';
export type SortDirection = 'asc' | 'desc';

/** Filtre « accès rapide » (chips Favoris / Terminées / Retard / Collaboration). */
export function applyQuickFilter(
  tasks: Task[],
  quickFilter: TaskQuickFilter,
  showCompleted: boolean,
  now: Date,
): Task[] {
  switch (quickFilter) {
    case 'favoris':
      return tasks.filter((task) => task.bookmarked && !task.completed);
    case 'terminées':
      return tasks.filter((task) => task.completed);
    case 'retard':
      return tasks.filter((task) => !task.completed && new Date(task.deadline) < now);
    case 'collaboration':
      return tasks.filter((task) => task.isCollaborative && !task.completed);
    default:
      return showCompleted
        ? tasks.filter((task) => task.completed)
        : tasks.filter((task) => !task.completed);
  }
}

/** Priorité facultative : une tâche sans priorité (0) reste toujours visible. */
export function withinPriorityRange(task: Task, range: readonly number[]): boolean {
  return task.priority === 0 || (task.priority >= range[0] && task.priority <= range[1]);
}

/**
 * Comparateur de tri. Sans `sortField`, fallback : favoris d'abord. Avec un
 * champ, tri ascendant/descendant. `completedAt` n'est pris en compte que si
 * la vue « terminées » est active (showCompleted).
 */
export function compareTasks(
  a: Task,
  b: Task,
  sortField: string | undefined,
  sortDirection: SortDirection,
  showCompleted: boolean,
): number {
  if (sortField) {
    let comparison = 0;
    if (sortField === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (sortField === 'priority') {
      comparison = a.priority - b.priority;
    } else if (sortField === 'deadline') {
      comparison = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    } else if (sortField === 'estimatedTime') {
      comparison = a.estimatedTime - b.estimatedTime;
    } else if (sortField === 'createdAt') {
      comparison = new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime();
    } else if (sortField === 'category') {
      comparison = a.category.localeCompare(b.category);
    } else if (sortField === 'completedAt' && showCompleted) {
      const aDate = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bDate = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      comparison = aDate - bDate;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  }

  if (a.bookmarked && !b.bookmarked) return -1;
  if (!a.bookmarked && b.bookmarked) return 1;
  return 0;
}

export interface FilterSortParams {
  tasks: Task[];
  quickFilter: TaskQuickFilter;
  showCompleted: boolean;
  priorityRange: readonly number[];
  sortField?: string;
  sortDirection: SortDirection;
  /** Injectable pour des tests déterministes. Défaut : `new Date()`. */
  now?: Date;
}

/** Pipeline complet : quick-filter → plage de priorité → tri (copie, non muté). */
export function filterAndSortTasks(params: FilterSortParams): Task[] {
  const { tasks, quickFilter, showCompleted, priorityRange, sortField, sortDirection } = params;
  const now = params.now ?? new Date();

  const byView = applyQuickFilter(tasks, quickFilter, showCompleted, now);
  const byPriority = byView.filter((task) => withinPriorityRange(task, priorityRange));

  return [...byPriority].sort((a, b) => compareTasks(a, b, sortField, sortDirection, showCompleted));
}
