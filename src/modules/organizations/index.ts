// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS MODULE - Public API (mode entreprise)
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────────
export type {
  OrgRole,
  Organization,
  MyOrganization,
  OrgMember,
  OrgJoinRequestStatus,
  OrgJoinRequest,
} from './types';

// ─── Constants & query keys ──────────────────────────────────────────
export {
  orgKeys,
  ORG_STORAGE_KEY,
  ORG_MEMBERS_STORAGE_KEY,
  ORG_JOIN_REQUESTS_STORAGE_KEY,
} from './constants';

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
  useMyOrganization,
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
} from './hooks';
