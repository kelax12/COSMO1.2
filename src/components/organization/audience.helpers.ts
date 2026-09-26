import type { OrgMember } from '@/modules/organizations';

/**
 * Qui LIT un projet (ou ses tâches et commentaires), en nombre de personnes.
 *
 * Miroir de la règle de `can_access_team_project` : sans équipe, toute
 * l'organisation ; avec une équipe, ses membres, la hiérarchie au-dessus de
 * chacun d'eux et les admins. Sert à AFFICHER l'audience avant de créer
 * (audit des popups du 2026-09-25 : « la visibilité se déduit d'une option
 * Toute l'organisation »). La RLS reste la frontière, ce compte ne décide rien.
 */
export function projectAudience(
  members: OrgMember[],
  teamMemberIds: string[] | null,
): { count: number; wholeOrg: boolean } {
  if (teamMemberIds === null) return { count: members.length, wholeOrg: true };
  return { count: audienceIds(members, teamMemberIds).size, wholeOrg: false };
}

/** Les personnes qui lisent un contenu rattaché aux équipes de `teamMemberIds`. */
export function audienceIds(members: OrgMember[], teamMemberIds: string[]): Set<string> {
  const byId = new Map(members.map((m) => [m.userId, m]));
  const seen = new Set<string>();
  for (const id of teamMemberIds) {
    // Remonter la chaîne : cap à 50, comme `is_above` (un cycle ne boucle pas).
    let current = byId.get(id);
    for (let depth = 0; current && depth < 50 && !seen.has(current.userId); depth++) {
      seen.add(current.userId);
      current = current.managerId ? byId.get(current.managerId) : undefined;
    }
  }
  for (const m of members) if (m.role === 'admin') seen.add(m.userId);
  return seen;
}

interface ReachInput {
  member: OrgMember;
  members: OrgMember[];
  /** Appartenances aux équipes de l'organisation. */
  memberships: { teamId: string; userId: string }[];
  projects: { teamId?: string | null; archivedAt?: string | null }[];
  okrs: { teamIds: string[] }[];
}

/**
 * Ce qu'un membre VOIT, donc ce sur quoi ses droits s'exercent : projets
 * actifs et objectifs. Sert l'aperçu « peut supprimer les tâches de 42
 * projets » de la fiche de permissions (audit des popups, 2026-09-25).
 */
export function memberReach({ member, members, memberships, projects, okrs }: ReachInput): { projects: number; okrs: number } {
  const cache = new Map<string, boolean>();
  const seesTeams = (teamIds: string[]): boolean => {
    const key = [...teamIds].sort().join(',');
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const ids = memberships.filter((m) => teamIds.includes(m.teamId)).map((m) => m.userId);
    const sees = audienceIds(members, ids).has(member.userId);
    cache.set(key, sees);
    return sees;
  };
  return {
    projects: projects.filter((p) => !p.archivedAt && (!p.teamId || seesTeams([p.teamId]))).length,
    okrs: okrs.filter((o) => o.teamIds.length === 0 || seesTeams(o.teamIds)).length,
  };
}
