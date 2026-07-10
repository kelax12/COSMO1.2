// ═══════════════════════════════════════════════════════════════════
// ORG-TEAMS MODULE - Constants
// ═══════════════════════════════════════════════════════════════════

// Clés localStorage (démo) — préfixe cosmo_ (sweep clearDemoStorage, B21).
export const ORG_TEAMS_STORAGE_KEY = 'cosmo_org_teams';
export const ORG_TEAM_MEMBERS_STORAGE_KEY = 'cosmo_org_team_members';

export const orgTeamKeys = {
  all: ['org-teams'] as const,
  teams: (orgId: string) => [...orgTeamKeys.all, 'teams', orgId] as const,
  members: (orgId: string) => [...orgTeamKeys.all, 'members', orgId] as const,
};
