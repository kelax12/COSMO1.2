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

/**
 * Ce que la suppression d'une équipe emporterait (mig. 151), compté sous RLS :
 * l'appelant ne compte que ce qu'il voit. Le chiffre sert à ANNONCER ; la
 * décision reste à la clé étrangère, qui refuse aussi ce qu'il ne voit pas.
 */
export interface TeamDeletionImpact {
  activeProjects: number;
  archivedProjects: number;
  /** OKR rattachés à cette SEULE équipe : sans transfert, ils deviendraient des objectifs d'entreprise. */
  soleOkrs: number;
  /** OKR partagés avec une autre équipe : ils perdent seulement ce lien. */
  sharedOkrs: number;
}

export interface DeleteTeamInput {
  teamId: string;
  /** Équipe qui reçoit projets et OKR. Jamais `null` pour « toute l'organisation » : c'est la fuite que M5 ferme. */
  targetTeamId: string | null;
  archiveProjects: boolean;
}
