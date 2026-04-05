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
  useFriend,
  usePendingFriendRequests,
  useFriendLookup,
  useFriendByEmail,
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
} from './hooks';
