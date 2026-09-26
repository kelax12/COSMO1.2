// ═══════════════════════════════════════════════════════════════════
// QUI VOIT un projet ou un objectif existant (audit 2026-09-24, M12).
//
// La création annonçait déjà son audience ; une fois l'objet créé, plus rien
// ne la disait. Ce module la calcule, personne par personne et AVEC SA RAISON,
// pour la pastille « Visible : … · N personnes ».
//
// Miroir de `can_access_team_project` (mig. 194) : sans équipe, toute
// l'entreprise ; sinon les membres des équipes (principale et associées), la
// hiérarchie au-dessus de chacun, les admins et, pour un projet, ses membres
// directs (mig. 190). Pour un objectif, `team_okr_teams` joue le rôle des
// équipes, sans membres directs. Ce n'est qu'une ANNONCE : la RLS reste juge.
// ═══════════════════════════════════════════════════════════════════

import { isMemberActive, type OrgMember } from '@/modules/organizations';

export type VisibilityReason = 'team' | 'hierarchy' | 'admin' | 'direct' | 'org';

export interface Visibility {
  wholeOrg: boolean;
  /** Personnes qui voient, avec la PREMIÈRE raison qui leur ouvre l'accès. */
  viewers: Map<string, VisibilityReason>;
}

interface VisibilityInput {
  members: OrgMember[];
  /** Équipes de l'objet ; [] = toute l'entreprise. */
  teamIds: string[];
  memberships: { teamId: string; userId: string }[];
  /** Membres directs (projet seulement). */
  directIds?: string[];
}

export function visibilityOf({ members, teamIds, memberships, directIds = [] }: VisibilityInput): Visibility {
  const viewers = new Map<string, VisibilityReason>();
  // Un membre suspendu ou dont l'accès a expiré ne voit rien (mig. 161).
  const active = members.filter((m) => isMemberActive(m));
  if (teamIds.length === 0) {
    for (const m of active) viewers.set(m.userId, 'org');
    return { wholeOrg: true, viewers };
  }
  const byId = new Map(active.map((m) => [m.userId, m]));
  const teamSet = new Set(teamIds);
  const inTeams = memberships.filter((m) => teamSet.has(m.teamId) && byId.has(m.userId)).map((m) => m.userId);
  for (const id of inTeams) viewers.set(id, 'team');
  // Hiérarchie : remonter depuis chaque membre, cap à 50 comme `is_above`.
  // La chaîne se parcourt sur TOUS les membres : un manager suspendu ne coupe
  // pas l'accès de celui qui est au-dessus de lui.
  const allById = new Map(members.map((m) => [m.userId, m]));
  for (const id of inTeams) {
    let current = allById.get(allById.get(id)?.managerId ?? '');
    for (let depth = 0; current && depth < 50; depth++) {
      if (byId.has(current.userId) && !viewers.has(current.userId)) viewers.set(current.userId, 'hierarchy');
      current = current.managerId ? allById.get(current.managerId) : undefined;
    }
  }
  for (const m of active) if (m.role === 'admin' && !viewers.has(m.userId)) viewers.set(m.userId, 'admin');
  for (const id of directIds) if (byId.has(id) && !viewers.has(id)) viewers.set(id, 'direct');
  return { wholeOrg: false, viewers };
}
