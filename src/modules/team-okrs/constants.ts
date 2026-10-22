// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS MODULE - Constants
// ═══════════════════════════════════════════════════════════════════

export const TEAM_OKRS_STORAGE_KEY = 'cosmo_team_okrs';
/** Corbeille démo (mig. 193) : les objectifs supprimés y attendent 30 jours. */
export const TEAM_OKR_TRASH_STORAGE_KEY = 'cosmo_team_okr_trash';
/** Durée de la corbeille, en jours : celle que `purge_team_okr_trash` applique. */
export const TEAM_OKR_TRASH_DAYS = 30;

export const teamOkrKeys = {
  all: ['team-okrs'] as const,
  list: (orgId: string) => [...teamOkrKeys.all, 'list', orgId] as const,
  trash: (orgId: string) => [...teamOkrKeys.all, 'trash', orgId] as const,
};
