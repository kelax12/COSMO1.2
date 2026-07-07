// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS MODULE - Constants
// ═══════════════════════════════════════════════════════════════════

// Clés localStorage (mode démo) — préfixe cosmo_ obligatoire pour être
// couvertes par le sweep clearDemoStorage() (faille B21).
export const ORG_STORAGE_KEY = 'cosmo_org_current';
export const ORG_MEMBERS_STORAGE_KEY = 'cosmo_org_members';
export const ORG_JOIN_REQUESTS_STORAGE_KEY = 'cosmo_org_join_requests';

/**
 * React Query keys for organizations
 */
export const orgKeys = {
  all: ['organizations'] as const,
  mine: () => [...orgKeys.all, 'mine'] as const,
  members: (orgId: string) => [...orgKeys.all, 'members', orgId] as const,
  joinRequests: (orgId: string) => [...orgKeys.all, 'joinRequests', orgId] as const,
  mySentRequest: () => [...orgKeys.all, 'mySentRequest'] as const,
};
