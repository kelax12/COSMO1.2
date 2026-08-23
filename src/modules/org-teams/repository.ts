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
  /**
   * Nomme ou révoque le responsable d'une équipe (mig. 107).
   *
   * La personne doit DÉJÀ être membre de l'équipe : on promeut une
   * appartenance existante, on n'en crée pas. Côté serveur, la policy UPDATE
   * n'accepte l'appel que d'un admin ou d'un responsable de cette équipe.
   */
  setTeamLead(teamId: string, userId: string, isLead: boolean): Promise<void>;
}
