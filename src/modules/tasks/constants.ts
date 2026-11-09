// ═══════════════════════════════════════════════════════════════════
// TASKS MODULE - Constants & Query Keys
// ═══════════════════════════════════════════════════════════════════

import { TaskFilters } from './types';
import type { TaskQuery } from './task-query';

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
  /**
   * V14.1 (PER-01). Trois familles SOUS `lists()`, pour que toute invalidation
   * de liste les atteigne. La requête est passée normalisée
   * (`normalizeTaskQuery`) : deux écrans qui veulent le même ensemble
   * partagent le même cache.
   *
   * - `archive` : pages serveur (useInfiniteQuery), l'archive « Terminées » ;
   * - `subset`  : un sous-ensemble entier, borné par nature (`listAll`) ;
   * - `count`   : un nombre, compté côté serveur.
   */
  archive: (query: TaskQuery) => [...taskKeys.lists(), 'archive', query] as const,
  subset: (query: TaskQuery) => [...taskKeys.lists(), 'subset', query] as const,
  count: (query: TaskQuery) => [...taskKeys.lists(), 'count', query] as const,
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
