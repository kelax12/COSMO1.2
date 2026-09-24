// ═══════════════════════════════════════════════════════════════════
// ORG-TEAMS MODULE - Repository Interface
// ═══════════════════════════════════════════════════════════════════

import { OrgTeam, OrgTeamMember, CreateOrgTeamInput, TeamDeletionImpact, DeleteTeamInput } from './types';

export interface IOrgTeamsRepository {
  getTeams(orgId: string): Promise<OrgTeam[]>;
  /** Toutes les appartenances de l'org (jointure affichée côté client). */
  getTeamMembers(orgId: string): Promise<OrgTeamMember[]>;
  createTeam(orgId: string, input: CreateOrgTeamInput): Promise<OrgTeam>;
  /** Ce que la suppression emporterait, compté sous RLS (mig. 151). */
  getDeletionImpact(teamId: string): Promise<TeamDeletionImpact>;
  /**
   * Supprime l'équipe après avoir déplacé ses projets et ses OKR vers
   * `targetTeamId`, en UNE transaction (`delete_team_with_transfer`, mig. 151).
   *
   * Sans cible, la base refuse tant que l'équipe porte un projet ou un OKR dont
   * elle est la seule équipe : la clé étrangère ne rend JAMAIS un projet visible
   * par toute l'organisation, y compris un projet que l'appelant ne voit pas.
   */
  deleteTeam(input: DeleteTeamInput): Promise<void>;
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
