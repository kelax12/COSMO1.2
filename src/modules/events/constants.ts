// ═══════════════════════════════════════════════════════════════════
// EVENTS MODULE - Query Keys & Constants
// ═══════════════════════════════════════════════════════════════════

import { EventFilters } from './types';

/**
 * Query keys for React Query cache management
 * 
 * Usage:
 * - eventsKeys.all: Base key for all event queries
 * - eventsKeys.lists(): Key for list queries
 * - eventsKeys.list(filters): Key for filtered list queries
 * - eventsKeys.details(): Base key for detail queries
 * - eventsKeys.detail(id): Key for a specific event
 * - eventsKeys.byTask(taskId): Key for events linked to a task
 */
export const eventsKeys = {
  all: ['events'] as const,
  lists: () => [...eventsKeys.all, 'list'] as const,
  list: (filters: EventFilters) => [...eventsKeys.lists(), filters] as const,
  details: () => [...eventsKeys.all, 'detail'] as const,
  detail: (id: string) => [...eventsKeys.details(), id] as const,
  byTask: (taskId: string) => [...eventsKeys.all, 'task', taskId] as const,
};

/**
 * LocalStorage key for demo mode persistence
 */
export const EVENTS_STORAGE_KEY = 'cosmo_demo_events';
