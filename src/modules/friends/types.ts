// ═══════════════════════════════════════════════════════════════════
// FRIENDS MODULE - Type Definitions
// ═══════════════════════════════════════════════════════════════════

/**
 * Friend - Represents a user's friend/collaborator
 */
export interface Friend {
  id: string;
  userId?: string; // The friend's auth.users.id — required for RLS/FK on tasks.collaborators and shared_tasks.friend_id. Resolved via profiles table in Supabase mode; falls back to id in demo mode.
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
  /**
   * The friend's auth.users.id. If the caller only has the friends-table
   * row id (e.g. when migration 018 hasn't backfilled the friend's
   * profile yet), pass `friendEmail` as well so shareTask can resolve
   * the canonical auth.uid before inserting into shared_tasks.
   */
  friendId: string;
  /** Optional fallback resolver — resolved via the profiles table. */
  friendEmail?: string;
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
  email: string;        // email du destinataire
  status: FriendRequestStatus;
  sentAt: string;
  senderId?: string;
  senderEmail?: string; // email de l'expéditeur
  receiverId?: string;
}
