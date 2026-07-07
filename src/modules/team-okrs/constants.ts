// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS MODULE - Constants
// ═══════════════════════════════════════════════════════════════════

export const TEAM_OKRS_STORAGE_KEY = 'cosmo_team_okrs';

export const teamOkrKeys = {
  all: ['team-okrs'] as const,
  list: (orgId: string) => [...teamOkrKeys.all, 'list', orgId] as const,
};
