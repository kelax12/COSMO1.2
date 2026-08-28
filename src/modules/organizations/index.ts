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
  OrgInvitation,
  OrgRemovalNotice,
  UpdateOrganizationInput,
  OrgInviteLink,
} from './types';
export { buildOrgTree, isManagerOf, subtreeOf } from './types';

// ─── Permissions par membre (mig. 115) ───────────────────────────────
export type {
  OrgPermissionKey,
  OrgAssignTarget,
  OrgMemberPermissions,
  SetOrgPermissionsInput,
  EffectiveOrgPermissions,
} from './permissions';
export {
  ORG_PERMISSION_KEYS,
  ORG_ASSIGN_TARGETS,
  DEFAULT_ASSIGN_TARGETS,
  effectivePermissions,
  effectiveAssignTargets,
  canAssignTo,
  canGrant,
  canEditPermissionsOf,
} from './permissions';

// ─── Constants & query keys ──────────────────────────────────────────
export {
  orgKeys,
  ORGS_STORAGE_KEY,
  ORG_MEMBERS_STORAGE_KEY,
  ORG_JOIN_REQUESTS_STORAGE_KEY,
  ACTIVE_ORG_STORAGE_KEY,
  ORG_MEMBER_PERMISSIONS_STORAGE_KEY,
} from './constants';

// ─── Contexte org active (multi-org) ─────────────────────────────────
export { ActiveOrgProvider, useActiveOrganization } from './ActiveOrgContext';

// ─── Validation ──────────────────────────────────────────────────────
// Les schémas ne sont PLUS réexportés ici : ils importent zod, et un barrel qui
// les porte rattache zod à tout fichier l'important pour une autre raison. Ils
// se chargent à la demande via `@/lib/validation/lazy` (cf. son en-tête).

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
  useMyOrgInvitations,
  useMyOrgRemovalNotices,
  useDismissOrgRemovalNotice,
  useInviteFriendToOrg,
  usePendingSentInvitations,
  useRespondOrgInvitation,
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
  useOrgMemberPermissions,
  useSetMemberPermissions,
} from './hooks';
export { useMyOrgPermissions } from './use-my-permissions';

// Notifications d'entreprise (mig. 095) — lecture seule côté client.
export {
  useOrgNotifications,
  useMarkNotificationsRead,
  useMarkTaskNotificationsRead,
  unreadCount,
  unreadCommentCountByTask,
  orgNotificationKeys,
} from './notifications';
export type { OrgNotification, OrgNotificationKind } from './notifications';

export { useOrgInbox } from './inbox';
export { mapOrgInbox, type OrgInboxRow } from './inbox.repository';
