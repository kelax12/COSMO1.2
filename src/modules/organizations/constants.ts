// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS MODULE - Constants
// ═══════════════════════════════════════════════════════════════════

// Clés localStorage (mode démo) — préfixe cosmo_ obligatoire pour être
// couvertes par le sweep clearDemoStorage() (faille B21).
export const ORGS_STORAGE_KEY = 'cosmo_org_list';
export const ORG_MEMBERS_STORAGE_KEY = 'cosmo_org_members';
export const ORG_JOIN_REQUESTS_STORAGE_KEY = 'cosmo_org_join_requests';

// Org active (multi-org v2) — préférence par appareil ET par utilisateur
// ({ userId, orgId } en JSON). Clé cosmo_ : reset au loginDemo (voulu).
export const ACTIVE_ORG_STORAGE_KEY = 'cosmo_active_org';
export const ORG_INVITE_LINKS_STORAGE_KEY = 'cosmo_org_invite_links';
export const ORG_NOTIFICATIONS_STORAGE_KEY = 'cosmo_org_notifications';
export const ORG_INVITATIONS_STORAGE_KEY = 'cosmo_org_invitations';
// Surcharges de permissions par membre (mig. 115) — vide par défaut.
export const ORG_MEMBER_PERMISSIONS_STORAGE_KEY = 'cosmo_org_member_permissions';

/**
 * React Query keys for organizations
 */
export const orgKeys = {
  all: ['organizations'] as const,
  /** Liste de MES organisations (multi-org). */
  mine: () => [...orgKeys.all, 'mine'] as const,
  members: (orgId: string) => [...orgKeys.all, 'members', orgId] as const,
  joinRequests: (orgId: string) => [...orgKeys.all, 'joinRequests', orgId] as const,
  mySentRequest: () => [...orgKeys.all, 'mySentRequest'] as const,
  /** Invitations d'entreprise recues et non traitees (boite de reception). */
  myInvitations: () => [...orgKeys.all, 'myInvitations'] as const,
  /** Retraits d'entreprise non acquittes (boite de reception). */
  myRemovalNotices: () => [...orgKeys.all, 'myRemovalNotices'] as const,
  /** Amis que j'ai invités dans cette org, invitation encore en attente. */
  pendingSentInvitations: (orgId: string) => [...orgKeys.all, 'pendingSentInvitations', orgId] as const,
  /**
   * Boite de reception d'entreprise, EN UNE SEULE CLE (mig. 129).
   *
   * Pas d'`orgId` : la RPC `get_my_org_inbox()` ne prend aucun parametre, son
   * perimetre vient de `auth.uid()` seul. La clef devait donc etre globale,
   * sans quoi changer d'organisation active aurait relance la lecture.
   */
  inbox: () => [...orgKeys.all, 'inbox'] as const,
  /** Surcharges de permissions posées dans cette org (mig. 115). */
  permissions: (orgId: string) => [...orgKeys.all, 'permissions', orgId] as const,
};
