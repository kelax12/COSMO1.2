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
  /**
   * Responsable de CETTE équipe (mig. 107) — gère ses membres et ses projets
   * sans être admin de l'organisation.
   *
   * Le rôle est porté par l'appartenance, pas par le membre : il ne peut donc
   * pas déborder sur une autre équipe, et disparaît avec la ligne quand la
   * personne quitte l'équipe. `OrgRole` reste `admin | member`.
   */
  isLead: boolean;
}

export interface CreateOrgTeamInput {
  name: string;
  color?: string;
}
