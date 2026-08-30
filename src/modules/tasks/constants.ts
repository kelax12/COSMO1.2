// ═══════════════════════════════════════════════════════════════════
// TASKS MODULE - Constants & Query Keys
// ═══════════════════════════════════════════════════════════════════

import { TaskFilters } from './types';

/**
 * LocalStorage key for persisting tasks in demo mode
 */
export const TASKS_STORAGE_KEY = 'cosmo_demo_tasks';

/** Graphe de dépendances en mode démo (mig. 132 côté production). */
export const TASK_DEPENDENCIES_STORAGE_KEY = 'cosmo_demo_task_dependencies';

/**
 * React Query keys for tasks
 * Centralized to prevent duplication and ensure consistent cache management
 */
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: TaskFilters) => [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
  byDate: (date: string) => [...taskKeys.all, 'date', date] as const,
  /** Tâches partagées avec moi et pas encore acceptées (boîte de réception). */
  pendingShared: () => [...taskKeys.all, 'pending-shared'] as const,
  /**
   * Graphe de dépendances (mig. 132) — UNE seule clé pour tout le graphe, pas
   * une par tâche : chaque modal a besoin des DEUX sens, donc d'arêtes qui ne
   * portent pas son id. Une clé par tâche redemanderait le même graphe autant
   * de fois qu'on ouvre de tâches.
   */
  dependencies: () => [...taskKeys.all, 'dependencies'] as const,
};
