// ═══════════════════════════════════════════════════════════════════
// TASKS MODULE - Constants & Query Keys
// ═══════════════════════════════════════════════════════════════════

import { TaskFilters } from './types';

/**
 * LocalStorage key for persisting tasks in demo mode
 */
export const TASKS_STORAGE_KEY = 'cosmo_demo_tasks';

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
};
