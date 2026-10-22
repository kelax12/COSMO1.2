// ═══════════════════════════════════════════════════════════════════
// Statistiques d'entreprise · périmètre (audit 2026-09-23, M3)
//
// La pyramide dit QUI ENCADRE QUI ; l'équipe dit QUI TRAVAILLE ENSEMBLE.
// Les statistiques ne suivaient que la première : un responsable d'équipe
// transverse sans subordonné ne voyait pas l'avancement de sa propre équipe.
// Trois périmètres désormais, chacun ouvert à qui y a une raison d'être :
//   · hiérarchie : admin (toute l'organisation) ou manager (lui + sous-arbre) ;
//   · équipe : les équipes que je dirige (toutes pour un admin) ;
//   · projet : les projets visibles (le serveur a déjà filtré la lecture).
// ═══════════════════════════════════════════════════════════════════

import { subtreeOf, type OrgMember } from '@/modules/organizations';
import type { OrgTeam, OrgTeamMember } from '@/modules/org-teams';
import type { TeamTask } from '@/modules/team-projects';

export type StatsScope =
  | { kind: 'hierarchy' }
  | { kind: 'team'; teamId: string }
  | { kind: 'project'; projectId: string };

export interface ScopeContext {
  members: OrgMember[];
  teamMembers: OrgTeamMember[];
  currentUserId?: string;
  isAdmin: boolean;
}

/** Peut-on regarder par la hiérarchie ? Admin, ou au moins un subordonné. */
export const canUseHierarchy = ({ members, currentUserId, isAdmin }: ScopeContext): boolean =>
  isAdmin || (!!currentUserId && members.some((m) => m.managerId === currentUserId));

/** Équipes qu'on peut regarder : toutes pour un admin, sinon celles qu'on dirige. */
export const leadableTeams = (teams: OrgTeam[], ctx: ScopeContext): OrgTeam[] => {
  if (ctx.isAdmin) return teams;
  const mine = new Set(
    ctx.teamMembers.filter((tm) => tm.userId === ctx.currentUserId && tm.isLead).map((tm) => tm.teamId),
  );
  return teams.filter((team) => mine.has(team.id) || team.createdBy === ctx.currentUserId);
};

/** Ouvre l'onglet Statistiques : hiérarchie OU au moins une équipe dirigée. */
export const canSeeStats = (teams: OrgTeam[], ctx: ScopeContext): boolean =>
  canUseHierarchy(ctx) || leadableTeams(teams, ctx).length > 0;

/** Périmètre par défaut : la hiérarchie quand elle existe, sinon la première équipe dirigée. */
export const defaultScope = (teams: OrgTeam[], ctx: ScopeContext): StatsScope => {
  if (canUseHierarchy(ctx)) return { kind: 'hierarchy' };
  const first = leadableTeams(teams, ctx)[0];
  return first ? { kind: 'team', teamId: first.id } : { kind: 'hierarchy' };
};

/** Membres regardés dans ce périmètre. */
export const scopeMembers = (scope: StatsScope, ctx: ScopeContext, tasks: TeamTask[]): OrgMember[] => {
  const { members, teamMembers, currentUserId, isAdmin } = ctx;
  if (scope.kind === 'team') {
    const ids = new Set(teamMembers.filter((tm) => tm.teamId === scope.teamId).map((tm) => tm.userId));
    return members.filter((m) => ids.has(m.userId));
  }
  if (scope.kind === 'project') {
    const ids = new Set(tasks.filter((t) => t.projectId === scope.projectId).flatMap((t) => t.assigneeIds));
    return members.filter((m) => ids.has(m.userId));
  }
  if (isAdmin || !currentUserId) return members;
  const sub = subtreeOf(members, currentUserId);
  return members.filter((m) => m.userId === currentUserId || sub.has(m.userId));
};

/** Tâches regardées dans ce périmètre. */
export const scopeTasks = (scope: StatsScope, ctx: ScopeContext, tasks: TeamTask[], scoped: OrgMember[]): TeamTask[] => {
  if (scope.kind === 'project') return tasks.filter((t) => t.projectId === scope.projectId);
  if (scope.kind === 'hierarchy' && ctx.isAdmin) return tasks;
  const ids = new Set(scoped.map((m) => m.userId));
  return tasks.filter((t) => t.assigneeIds.some((id) => ids.has(id)));
};

/** Encodage d'un périmètre dans un `<select>`. */
export const scopeKey = (scope: StatsScope): string =>
  scope.kind === 'hierarchy' ? 'hierarchy' : `${scope.kind}:${scope.kind === 'team' ? scope.teamId : scope.projectId}`;

export const parseScopeKey = (key: string): StatsScope => {
  const [kind, id] = key.split(':');
  if (kind === 'team' && id) return { kind: 'team', teamId: id };
  if (kind === 'project' && id) return { kind: 'project', projectId: id };
  return { kind: 'hierarchy' };
};
