// ═══════════════════════════════════════════════════════════════════
// ORG-TEAMS MODULE - Public API
// ═══════════════════════════════════════════════════════════════════

export type { OrgTeam, OrgTeamMember, CreateOrgTeamInput } from './types';

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
  useDeleteOrgTeam,
  useAddTeamMember,
  useRemoveTeamMember,
} from './hooks';
