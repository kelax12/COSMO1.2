// ═══════════════════════════════════════════════════════════════════
// Rapports d'activité · qui lit quoi (miroir de la policy de la mig. 202)
//
//   · rapport d'entreprise : droit `report.org` (admin par défaut) ;
//   · rapport d'équipe     : droit `report.allTeams` → toutes les équipes,
//     sinon les équipes que je dirige (responsable ou créateur).
// Le serveur tranche : ce fichier ne fait qu'éviter de proposer un périmètre
// qui rendrait une page vide.
// ═══════════════════════════════════════════════════════════════════

import type { EffectiveOrgPermissions } from '@/modules/organizations';
import type { OrgTeam, OrgTeamMember } from '@/modules/org-teams';

export interface ReportAccess {
  canOrg: boolean;
  /** Équipes dont je peux lire le rapport, dans l'ordre de l'annuaire. */
  teams: OrgTeam[];
}

export const reportAccess = (
  can: Pick<EffectiveOrgPermissions, 'report.org' | 'report.allTeams'>,
  teams: OrgTeam[],
  teamMembers: OrgTeamMember[],
  currentUserId: string | undefined,
): ReportAccess => {
  if (can['report.allTeams']) return { canOrg: can['report.org'], teams };
  const led = new Set(
    teamMembers.filter((tm) => tm.userId === currentUserId && tm.isLead).map((tm) => tm.teamId),
  );
  return {
    canOrg: can['report.org'],
    teams: teams.filter((t) => led.has(t.id) || (!!currentUserId && t.createdBy === currentUserId)),
  };
};

/** La section Rapports n'apparaît qu'à qui peut en lire au moins un. */
export const canSeeReports = (access: ReportAccess): boolean => access.canOrg || access.teams.length > 0;
