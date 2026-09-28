// ═══════════════════════════════════════════════════════════════════
// TEAM-LISTS MODULE - Constants
// ═══════════════════════════════════════════════════════════════════

// Clés localStorage (démo) : préfixe cosmo_ (sweep clearDemoStorage, B21).
export const TEAM_LISTS_STORAGE_KEY = 'cosmo_team_lists';
export const TEAM_LIST_TASKS_STORAGE_KEY = 'cosmo_team_list_tasks';

export const teamListKeys = {
  all: ['team-lists'] as const,
  list: (orgId: string) => [...teamListKeys.all, orgId] as const,
};
