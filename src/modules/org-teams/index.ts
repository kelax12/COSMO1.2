// ═══════════════════════════════════════════════════════════════════
// ORG-TEAMS MODULE - Public API
// ═══════════════════════════════════════════════════════════════════

export type { OrgTeam, OrgTeamMember, CreateOrgTeamInput, UpdateOrgTeamInput, TeamDeletionImpact, DeleteTeamInput } from './types';

export {
  orgTeamKeys,
  ORG_TEAMS_STORAGE_KEY,
  ORG_TEAM_MEMBERS_STORAGE_KEY,
} from './constants';

export type { IOrgTeamsRepository } from './repository';
export { LocalStorageOrgTeamsRepository } from './local.repository';
export { SupabaseOrgTeamsRepository } from './supabase.repository';

export {
  useOrgTeams,
  useOrgTeamMembers,
  useCreateOrgTeam,
  useCreateTeamWithMembers,
  useUpdateOrgTeam,
  useDeleteOrgTeam,
  useTeamDeletionImpact,
  useAddTeamMember,
  useRemoveTeamMember,
  useSetTeamLead,
} from './hooks';
