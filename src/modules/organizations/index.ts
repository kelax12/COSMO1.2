// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS MODULE - Public API (mode entreprise)
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────────
export type {
  OrgRole,
  Organization,
  MyOrganization,
  OrgMember,
  OrgTreeNode,
  OrgJoinRequestStatus,
  OrgJoinRequest,
  UpdateOrganizationInput,
  OrgInviteLink,
} from './types';
export { buildOrgTree, isManagerOf, subtreeOf } from './types';

// ─── Constants & query keys ──────────────────────────────────────────
export {
  orgKeys,
  ORGS_STORAGE_KEY,
  ORG_MEMBERS_STORAGE_KEY,
  ORG_JOIN_REQUESTS_STORAGE_KEY,
  ACTIVE_ORG_STORAGE_KEY,
} from './constants';

// ─── Contexte org active (multi-org) ─────────────────────────────────
export { ActiveOrgProvider, useActiveOrganization } from './ActiveOrgContext';

// ─── Validation ──────────────────────────────────────────────────────
export {
  createOrganizationSchema,
  joinCodeSchema,
  JOIN_CODE_REGEX,
} from './organization.schema';

// ─── Repository ──────────────────────────────────────────────────────
export type { IOrganizationsRepository } from './repository';
export { LocalStorageOrganizationsRepository } from './local.repository';
export { SupabaseOrganizationsRepository } from './supabase.repository';

// ─── Hooks ───────────────────────────────────────────────────────────
export {
  useMyOrganizations,
  useOrgMembers,
  useOrgJoinRequests,
  useMySentJoinRequest,
  useCreateOrganization,
  useRequestJoinOrganization,
  useRespondJoinRequest,
  useCancelJoinRequest,
  useSetMemberRole,
  useRemoveMember,
  useLeaveOrganization,
  useDeleteOrganization,
  useTransferOwnership,
  useUpdateOrganization,
  useSetMemberManager,
  useCreateInviteLink,
  useClaimOrgInvite,
  useRegenerateJoinCode,
} from './hooks';
