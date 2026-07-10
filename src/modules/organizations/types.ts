// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS MODULE - Type Definitions (mode entreprise)
// ═══════════════════════════════════════════════════════════════════

export type OrgRole = 'admin' | 'manager' | 'member';

export interface Organization {
  id: string;
  name: string;
  /**
   * Code d'invitation permanent ('COSMO-XXXXXX'). Uniquement présent pour un
   * membre (RLS : SELECT réservé aux membres) — ne jamais le mettre dans un
   * cache/état partagé hors de l'org.
   */
  joinCode?: string;
  ownerId: string;
  createdAt: string;
  /** Profil d'entreprise (v2) — éditable par les admins. */
  description?: string;
  industry?: string;
}

/** Champs de profil modifiables par un admin (jamais joinCode/ownerId). */
export interface UpdateOrganizationInput {
  name?: string;
  description?: string;
  industry?: string;
}

/** L'organisation de l'utilisateur courant, enrichie de son propre rôle. */
export interface MyOrganization extends Organization {
  myRole: OrgRole;
}

/** Membre de l'annuaire, enrichi depuis `profiles` (nom/avatar sanitizés). */
export interface OrgMember {
  orgId: string;
  /** auth.users.id du membre. */
  userId: string;
  role: OrgRole;
  joinedAt: string;
  displayName: string;
  email?: string;
  /** URL/data URL/emoji — même convention que Friend.avatar. */
  avatar?: string;
}

export type OrgJoinRequestStatus = 'pending' | 'accepted' | 'rejected';

/**
 * Demande d'adhésion (pattern inbox : accepted_at NULL = pending côté DB,
 * exposé ici via `status`). Vue admin (entrantes) et vue demandeur (envoyée).
 */
export interface OrgJoinRequest {
  id: string;
  orgId: string;
  /** auth.users.id du demandeur. */
  userId: string;
  requestedAt: string;
  status: OrgJoinRequestStatus;
  /** Enrichi depuis `profiles` (vue admin). */
  requesterName?: string;
  requesterEmail?: string;
  requesterAvatar?: string;
  /** Nom de l'org — renseigné en démo ; en prod la RPC de demande le renvoie
   *  au moment de l'envoi (non re-lisible ensuite : RLS membres-only). */
  orgName?: string;
}
