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
 * A single sharing grant, as stored in `shared_tasks` (Supabase) or the
 * `cosmo_shared_tasks` localStorage map (demo). This is the owner-side
 * read model that replaces the removed `tasks.collaborators[]` array.
 */
export interface TaskShare {
  taskId: string;
  /** Recipient's auth.users.id (Supabase) or friend.id (demo). */
  friendId: string;
  role: 'viewer' | 'editor';
  /** Le destinataire a-t-il accepté la tâche ? (false = « Envoyé », en attente). */
  accepted?: boolean;
}

/**
 * A sharing grant enrichi des deux extrémités (propriétaire + destinataire),
 * pour afficher les avatars des collaborateurs côté propriétaire ET côté
 * destinataire. Retourné par `getRelatedTaskShares()`.
 */
export interface RelatedTaskShare {
  taskId: string;
  /** auth.users.id du partageur (propriétaire de la tâche). */
  sharedBy: string;
  /** auth.users.id du destinataire. */
  friendId: string;
  role: 'viewer' | 'editor';
  /** Le destinataire a-t-il accepté la tâche ? */
  accepted?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// LIST SHARING (partage de listes — copy-on-accept)
// ═══════════════════════════════════════════════════════════════════

/**
 * Snapshot d'une tâche figé au moment du partage d'une liste. On ne copie que
 * les champs métier reproductibles chez le destinataire (pas d'id, pas de
 * userId/sharedBy/collaborateurs — le destinataire recrée des tâches qui lui
 * appartiennent).
 */
export interface TaskSnapshot {
  name: string;
  description?: string;
  priority: number;
  category: string;
  deadline: string;
  estimatedTime: number;
  bookmarked: boolean;
  completed: boolean;
  subtasks?: import('@/modules/tasks').Subtask[];
  recurrence?: import('@/modules/tasks').TaskRecurrence;
}

/**
 * Input pour partager une liste avec un ami. Embarque un snapshot de la liste
 * (nom, couleur) et de ses tâches.
 */
export interface ShareListInput {
  /** Id de la liste source côté partageur (traçabilité / dédup). */
  listId: string;
  name: string;
  color: string;
  tasks: TaskSnapshot[];
  /**
   * auth.users.id du destinataire. Comme `ShareTaskInput`, si l'appelant n'a que
   * l'id de ligne friends, passer `friendEmail` pour résoudre l'auth.uid canonique.
   */
  friendId: string;
  friendEmail?: string;
}

/**
 * Une grant de partage de liste, telle que stockée dans `shared_lists`
 * (Supabase) ou la clé `cosmo_shared_lists` (démo). Vue destinataire.
 */
export interface SharedListGrant {
  id: string;
  /** Id de la liste source côté partageur (démo). */
  listId?: string;
  name: string;
  color: string;
  tasks: TaskSnapshot[];
  /** auth.users.id du partageur (démo : id fictif). */
  sharedBy: string;
  /** Nom affichable du partageur (résolu à la lecture). */
  sharedByName?: string;
  /** auth.users.id du destinataire. */
  friendId: string;
  /** Le destinataire a-t-il accepté (matérialisé) la liste ? */
  accepted: boolean;
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
  /** Avatar de l'expéditeur (URL/data URL/emoji), résolu via la RPC
   *  `get_incoming_request_senders` (Supabase) ou seedé en démo. */
  senderAvatar?: string;
  /** Nom affiché de l'expéditeur, même source que `senderAvatar`. */
  senderName?: string;
}
