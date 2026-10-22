import { useOrgMembers } from '@/modules/organizations';
import { useOrgTeamMembers } from '@/modules/org-teams';
import { useTeamProjectMembers, useTeamProjectTeams } from '@/modules/team-projects';
import { visibilityOf, type VisibilityReason } from './visibility.helpers';

export interface VisibilityTarget {
  orgId: string;
  /** Équipes de l'objet (principale et associées) ; [] = toute l'entreprise. */
  teamIds: string[];
  /**
   * Projet : ses équipes ASSOCIÉES (mig. 164) et ses membres directs (mig. 190)
   * s'ajoutent à `teamIds`. Absent pour un objectif.
   */
  projectId?: string;
  /** OKR 'teams' ou 'custom' (mig. 205) : fermé même sans équipe. */
  closed?: boolean;
  /** Personnes nommées d'un OKR 'custom' (mig. 205). */
  namedIds?: string[];
}

const REASON_ORDER: VisibilityReason[] = ['team', 'direct', 'hierarchy', 'admin', 'org'];

/** Qui voit l'objet, et pourquoi : partagé par la pastille et la pile d'avatars. */
export const useVisibility = ({ orgId, teamIds: ownTeamIds, projectId, closed = false, namedIds = [] }: VisibilityTarget) => {
  const { data: members = [] } = useOrgMembers(orgId);
  const { data: memberships = [] } = useOrgTeamMembers(orgId);
  const { data: projectTeams = [] } = useTeamProjectTeams(projectId ? orgId : undefined);
  const { data: projectMembers = [] } = useTeamProjectMembers(projectId ? orgId : undefined);
  // Un projet sans équipe principale reste visible par TOUTE l'entreprise,
  // quelles que soient ses équipes associées (`p.team_id IS NULL`, mig. 194).
  const teamIds = ownTeamIds.length === 0 ? [] : [...new Set([
    ...ownTeamIds,
    ...projectTeams.filter((l) => l.projectId === projectId).map((l) => l.teamId),
  ])];
  const directIds = projectId ? projectMembers.filter((m) => m.projectId === projectId).map((m) => m.userId) : [];
  // Pas de mémo : le calcul est linéaire en membres, et les tableaux reçus
  // changent d'identité à chaque rendu du parent.
  const vis = visibilityOf({ members, teamIds, memberships, directIds, closed, namedIds });
  const people = members
    .filter((m) => vis.viewers.has(m.userId))
    .sort((a, b) =>
      REASON_ORDER.indexOf(vis.viewers.get(a.userId)!) - REASON_ORDER.indexOf(vis.viewers.get(b.userId)!)
      || a.displayName.localeCompare(b.displayName));
  return { vis, teamIds, directIds, memberships, people };
};

