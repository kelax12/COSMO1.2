// ═══════════════════════════════════════════════════════════════════
// FRIENDS MODULE - Type Definitions
// ═══════════════════════════════════════════════════════════════════

/**
 * Friend - Represents a user's friend/collaborator
 */
export interface Friend {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

/**
 * Input type for sending a friend request
 */
export interface FriendRequestInput {
  email: string;
}

/**
 * Input type for sharing a task with a friend
 */
export interface ShareTaskInput {
  taskId: string;
  friendId: string;
  role?: 'viewer' | 'editor';
}

/**
 * Friend request status
 */
export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected';

/**
 * Pending friend request
 */
export interface PendingFriendRequest {
  id: string;
  email: string;
  status: FriendRequestStatus;
  sentAt: string;
}
