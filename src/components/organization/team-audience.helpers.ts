// ═══════════════════════════════════════════════════════════════════
// Audience des projets d'équipe — ce qu'un changement d'équipe fait perdre
// (audit du 2026-09-24, cas « changement d'équipe »).
//
// Retirer quelqu'un d'une équipe lui retirait IMMÉDIATEMENT la vue sur les
// projets de cette équipe, y compris ceux où il avait ses propres tâches, sans
// qu'aucun écran ne l'ait annoncé. Ce module calcule, AVANT le geste, les
// projets qu'il ne verra plus.
//
// Miroir client de `my_team_project_ids` (mig. 164) : un projet est visible
// si son équipe est nulle (toute l'entreprise), si je suis admin, ou si l'une
// de ses équipes (principale OU associée) compte moi-même ou l'un de mes
// subordonnés. Ce n'est qu'une ANNONCE : la base reste seule juge.
// ═══════════════════════════════════════════════════════════════════

import { subtreeOf, type OrgMember } from '@/modules/organizations';
import type { OrgTeamMember } from '@/modules/org-teams';
import type { TeamProject, TeamProjectTeam } from '@/modules/team-projects';

interface LeaveInput {
  userId: string;
  teamId: string;
  members: OrgMember[];
  memberships: OrgTeamMember[];
  projects: TeamProject[];
  projectTeams: TeamProjectTeam[];
}

/** Toutes les équipes d'un projet : principale + associées. */
export const teamsOfProject = (project: TeamProject, projectTeams: TeamProjectTeam[]): Set<string> => {
  const out = new Set<string>();
  if (project.teamId) out.add(project.teamId);
  for (const link of projectTeams) if (link.projectId === project.id) out.add(link.teamId);
  return out;
};

/**
 * Projets actifs que `userId` ne verrait PLUS s'il quittait `teamId`.
 * Vide pour un admin : il voit tout, quelle que soit son équipe.
 */
export function projectsLostOnTeamLeave({
  userId, teamId, members, memberships, projects, projectTeams,
}: LeaveInput): TeamProject[] {
  const me = members.find((m) => m.userId === userId);
  if (!me || me.role === 'admin') return [];

  // Qui compte pour la visibilité : la personne et tout son sous-arbre.
  const viewers = new Set([userId, ...subtreeOf(members, userId)]);
  // Équipes qui lui ouvriront encore des projets APRÈS le retrait.
  const remainingTeams = new Set(
    memberships
      .filter((m) => viewers.has(m.userId) && !(m.userId === userId && m.teamId === teamId))
      .map((m) => m.teamId),
  );

  return projects.filter((project) => {
    if (project.archivedAt || project.isTemplate || !project.teamId) return false;
    const teams = teamsOfProject(project, projectTeams);
    if (!teams.has(teamId)) return false;
    return ![...teams].some((t) => remainingTeams.has(t));
  });
}
