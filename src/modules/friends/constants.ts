// ═══════════════════════════════════════════════════════════════════
// FRIENDS MODULE - Constants
// ═══════════════════════════════════════════════════════════════════

export const FRIENDS_STORAGE_KEY = 'cosmo_friends';
export const FRIEND_REQUESTS_STORAGE_KEY = 'cosmo_friend_requests';
export const SHARED_TASKS_STORAGE_KEY = 'cosmo_shared_tasks';

/**
 * React Query keys for friends
 */
export const friendKeys = {
  all: ['friends'] as const,
  lists: () => [...friendKeys.all, 'list'] as const,
  detail: (id: string) => [...friendKeys.all, 'detail', id] as const,
  requests: () => [...friendKeys.all, 'requests'] as const,
  sharedTasks: () => [...friendKeys.all, 'sharedTasks'] as const,
};

