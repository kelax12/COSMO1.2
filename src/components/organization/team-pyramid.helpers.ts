// Pyramide d'une équipe (reco UI n° 22) — fonction pure.
//
// La hiérarchie vit au niveau de l'ORGANISATION (`managerId`) ; une équipe en
// est une tranche. Le supérieur d'un membre dans l'équipe est donc son plus
// proche ANCÊTRE qui appartient aussi à l'équipe : sans cette remontée, deux
// personnes séparées par un manager hors équipe apparaîtraient comme deux
// racines sans lien.

import type { OrgMember } from '@/modules/organizations';

export interface TeamPyramidNode {
  member: OrgMember;
  isLead: boolean;
  children: TeamPyramidNode[];
}

export function buildTeamPyramid(
  allMembers: OrgMember[],
  teamUserIds: ReadonlySet<string>,
  leadIds: ReadonlySet<string> = new Set(),
): TeamPyramidNode[] {
  const byId = new Map(allMembers.map((m) => [m.userId, m]));

  /** Plus proche ancêtre dans l'équipe ; cycle ou absence → null (racine). */
  const teamParent = (m: OrgMember): string | null => {
    const seen = new Set<string>([m.userId]);
    let cur = m.managerId ?? null;
    while (cur && !seen.has(cur)) {
      if (teamUserIds.has(cur)) return cur;
      seen.add(cur);
      cur = byId.get(cur)?.managerId ?? null;
    }
    return null;
  };

  const nodes = new Map<string, TeamPyramidNode>();
  for (const id of teamUserIds) {
    const m = byId.get(id);
    if (m) nodes.set(id, { member: m, isLead: leadIds.has(id), children: [] });
  }

  const roots: TeamPyramidNode[] = [];
  for (const node of nodes.values()) {
    const parent = teamParent(node.member);
    const parentNode = parent ? nodes.get(parent) : undefined;
    if (parentNode) parentNode.children.push(node);
    else roots.push(node);
  }

  // Responsables d'abord, puis ordre alphabétique : l'ordre ne bouge pas d'un
  // rendu à l'autre.
  const sort = (list: TeamPyramidNode[]) => {
    list.sort((a, b) => Number(b.isLead) - Number(a.isLead) || a.member.displayName.localeCompare(b.member.displayName));
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}
