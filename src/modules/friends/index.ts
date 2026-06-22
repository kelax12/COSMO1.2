// ═══════════════════════════════════════════════════════════════════
// FRIENDS MODULE - Public API
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type {
  Friend,
  FriendRequestInput,
  ShareTaskInput,
  PendingFriendRequest,
  FriendRequestStatus,
  TaskShare,
  RelatedTaskShare,
} from './types';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS & QUERY KEYS
// ═══════════════════════════════════════════════════════════════════

export { 
  friendKeys, 
  FRIENDS_STORAGE_KEY,
  FRIEND_REQUESTS_STORAGE_KEY,
  SHARED_TASKS_STORAGE_KEY,
} from './constants';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY
// ═══════════════════════════════════════════════════════════════════

export type { IFriendsRepository } from './repository';
export { LocalStorageFriendsRepository } from './repository';
export { SupabaseFriendsRepository } from './supabase.repository';

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════

export {
  useFriends,
  useFriendRequests,
  useSentFriendRequests,
  useTaskShares,
  useMyTaskShares,
  useSharesByTask,
  useCollaboratorsByTask,
  usePendingCollaboratorTaskIds,
  useRelatedTaskShares,
} from './hooks';

// ═══════════════════════════════════════════════════════════════════
// WRITE HOOKS (Mutations)
// ═══════════════════════════════════════════════════════════════════

export {
  useSendFriendRequest,
  useAcceptFriendRequest,
  useRejectFriendRequest,
  useRemoveFriend,
  useShareTask,
  useUnshareTask,
  useAcceptSharedTask,
} from './hooks';

// ═══════════════════════════════════════════════════════════════════
// SHARE LINKS (liens d'invitation — Supabase only, mig. 046)
// ═══════════════════════════════════════════════════════════════════

export {
  useShareLink,
  useClaimShareLink,
  buildInviteUrl,
  isValidInviteToken,
  PENDING_INVITE_STORAGE_KEY,
} from './share-link.hooks';
export type { ClaimShareLinkResult } from './share-link.hooks';
