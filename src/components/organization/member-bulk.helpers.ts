// ═══════════════════════════════════════════════════════════════════
// Actions groupées de l'annuaire : QUI peut subir QUEL geste
//
// Règle du dépôt : l'interface n'affiche jamais une action que le serveur
// refusera. Chaque fonction ci-dessous est le miroir d'une règle SQL, citée :
//   • ajout à une équipe   → policy `org_team_members_insert` (mig. 100) ;
//   • changement de manager → `set_member_manager` (mig. 066), via les
//     helpers de la pyramide `canManage` / `isValidDestination`.
// Un membre sélectionné mais non éligible n'est pas une erreur : il est
// ÉCARTÉ, compté, et le toast récapitulatif le dit.
// ═══════════════════════════════════════════════════════════════════

import { subtreeOf, type OrgMember } from '@/modules/organizations';
import type { OrgTeam, OrgTeamMember } from '@/modules/org-teams';
import { canManage, isValidDestination } from './pyramid.helpers';

interface Actor {
  currentUserId: string | undefined;
  isAdmin: boolean;
}

/** Miroir de `can_manage_team` (mig. 107) : admin, créateur, ou responsable. */
export function canManageTeam(
  team: OrgTeam,
  memberships: OrgTeamMember[],
  { currentUserId, isAdmin }: Actor,
): boolean {
  if (isAdmin) return true;
  if (!currentUserId) return false;
  if (team.createdBy === currentUserId) return true;
  return memberships.some((m) => m.teamId === team.id && m.userId === currentUserId && m.isLead);
}

export const manageableTeams = (teams: OrgTeam[], memberships: OrgTeamMember[], actor: Actor): OrgTeam[] =>
  teams.filter((t) => canManageTeam(t, memberships, actor));

export interface Partition {
  eligible: OrgMember[];
  /** Déjà dans l'état demandé (déjà membre de l'équipe, déjà sous ce manager). */
  unchanged: OrgMember[];
  /** Hors de la portée de l'appelant : le serveur refuserait. */
  outOfScope: OrgMember[];
}

/**
 * Ajout à `team` : il faut gérer l'équipe, puis, hors admin, n'ajouter que
 * soi-même ou un membre de son sous-arbre (`is_above`).
 */
export function partitionForTeam(
  selected: OrgMember[],
  team: OrgTeam,
  memberships: OrgTeamMember[],
  members: OrgMember[],
  actor: Actor,
): Partition {
  const out: Partition = { eligible: [], unchanged: [], outOfScope: [] };
  const inTeam = new Set(memberships.filter((m) => m.teamId === team.id).map((m) => m.userId));
  const manages = canManageTeam(team, memberships, actor);
  const mySubtree = actor.currentUserId ? subtreeOf(members, actor.currentUserId) : new Set<string>();
  for (const m of selected) {
    if (inTeam.has(m.userId)) out.unchanged.push(m);
    else if (!manages) out.outOfScope.push(m);
    else if (actor.isAdmin || m.userId === actor.currentUserId || mySubtree.has(m.userId)) out.eligible.push(m);
    else out.outOfScope.push(m);
  }
  return out;
}

/**
 * Rattachement sous `destId` (`null` = détacher, admin seulement). Un
 * non-admin ne déplace que son sous-arbre, vers lui-même ou son sous-arbre ;
 * personne ne se déplace soi-même ni ne crée de cycle.
 */
export function partitionForManager(
  selected: OrgMember[],
  destId: string | null,
  members: OrgMember[],
  { currentUserId, isAdmin }: Actor,
): Partition {
  const out: Partition = { eligible: [], unchanged: [], outOfScope: [] };
  for (const m of selected) {
    if ((m.managerId ?? null) === destId) out.unchanged.push(m);
    else if (!canManage(m, members, currentUserId, isAdmin)) out.outOfScope.push(m);
    else if (destId === null ? isAdmin : isValidDestination(m, destId, members, currentUserId, isAdmin)) out.eligible.push(m);
    else out.outOfScope.push(m);
  }
  return out;
}

/** Destinations proposées : admin → tout le monde ; manager → lui-même et son sous-arbre. */
export function managerDestinations(members: OrgMember[], { currentUserId, isAdmin }: Actor): OrgMember[] {
  if (isAdmin) return members;
  if (!currentUserId) return [];
  const scope = subtreeOf(members, currentUserId);
  return members.filter((m) => m.userId === currentUserId || scope.has(m.userId));
}

/**
 * Le mode sélection n'a de sens que si au moins un geste est possible :
 * admin, manager d'au moins une personne, ou gestionnaire d'une équipe.
 */
export function canUseBulkActions(
  members: OrgMember[],
  teams: OrgTeam[],
  memberships: OrgTeamMember[],
  actor: Actor,
): boolean {
  if (actor.isAdmin) return true;
  if (!actor.currentUserId) return false;
  if (members.some((m) => m.managerId === actor.currentUserId)) return true;
  return manageableTeams(teams, memberships, actor).length > 0;
}
