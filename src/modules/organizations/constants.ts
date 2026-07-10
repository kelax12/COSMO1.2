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
};
