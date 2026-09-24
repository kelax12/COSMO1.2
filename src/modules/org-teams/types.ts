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
  /** Ce que fait l'équipe (mig. 152). */
  description?: string | null;
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
  description?: string | null;
}

export interface UpdateOrgTeamInput {
  name?: string;
  color?: string;
  description?: string | null;
}

/**
 * Ce que devient le travail d'une équipe supprimée (mig. 151). Sans l'un ou
 * l'autre, la suppression n'aboutit que si l'équipe ne porte rien : ses
 * projets et OKR NE deviennent PLUS visibles de toute l'entreprise en silence.
 */
export interface DeleteOrgTeamOptions {
  /** Ses projets et OKR passent à cette équipe. */
  targetTeamId?: string | null;
  /** Ils deviennent visibles de toute l'organisation (admin seulement). */
  makePublic?: boolean;
}

/** Ce qu'une suppression d'équipe emporterait. */
export interface TeamDeletionImpact {
  projects: number;
  /** OKR rattachés à CETTE SEULE équipe (les autres gardent leurs équipes). */
  okrs: number;
}
