// ═══════════════════════════════════════════════════════════════════
// ORG-TEAMS MODULE - Repository Interface
// ═══════════════════════════════════════════════════════════════════

import { OrgTeam, OrgTeamMember, CreateOrgTeamInput } from './types';

export interface IOrgTeamsRepository {
  getTeams(orgId: string): Promise<OrgTeam[]>;
  /** Toutes les appartenances de l'org (jointure affichée côté client). */
  getTeamMembers(orgId: string): Promise<OrgTeamMember[]>;
  createTeam(orgId: string, input: CreateOrgTeamInput): Promise<OrgTeam>;
  deleteTeam(teamId: string): Promise<void>;
  addTeamMember(teamId: string, orgId: string, userId: string): Promise<void>;
  removeTeamMember(teamId: string, userId: string): Promise<void>;
}
