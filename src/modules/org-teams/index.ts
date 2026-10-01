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
// Dépôt de démo NON réexporté (2026-10-01) : le baril est importé par le shell,
// la réexportation ramenait le dépôt dans le chunk d'ENTRÉE alors que la fabrique
// le charge à la demande (`src/lib/demo-repositories.ts`).
export { SupabaseOrgTeamsRepository } from './supabase.repository';

export {
  useOrgTeams,
  useOrgTeamMembers,
  useCreateOrgTeam,
  useCreateTeamWithMembers,
  type CreateTeamFullInput,
  useUpdateOrgTeam,
  useDeleteOrgTeam,
  useTeamDeletionImpact,
  useAddTeamMember,
  useRemoveTeamMember,
  useSetTeamLead,
} from './hooks';
