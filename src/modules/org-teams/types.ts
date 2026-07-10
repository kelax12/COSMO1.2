// ═══════════════════════════════════════════════════════════════════
// ORG-TEAMS MODULE - Types (équipes transverses, v2)
// ═══════════════════════════════════════════════════════════════════

export interface OrgTeam {
  id: string;
  orgId: string;
  name: string;
  color: string;
  /** Créateur (gestionnaire de l'équipe avec les admins). */
  createdBy: string | null;
  createdAt: string;
}

export interface OrgTeamMember {
  teamId: string;
  orgId: string;
  /** auth.users.id. */
  userId: string;
}

export interface CreateOrgTeamInput {
  name: string;
  color?: string;
}
