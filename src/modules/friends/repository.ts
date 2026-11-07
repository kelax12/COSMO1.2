// ═══════════════════════════════════════════════════════════════════
// FRIENDS MODULE - Interface du repository (contrat des deux implémentations)
// ═══════════════════════════════════════════════════════════════════
//
// Forme unique (V12.3, src/modules/CLAUDE.md § Forme d'un module) : ce fichier ne
// porte que l'interface et ses types. Démo : `local.repository.ts`, seed :
// `local.seed.ts`, production : `supabase.repository.ts`.

import type { Friend, FriendRequestInput, ShareTaskInput, PendingFriendRequest, TaskShare, RelatedTaskShare, ShareListInput, SharedListGrant } from './types';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface IFriendsRepository {
  // Read operations
  getAll(): Promise<Friend[]>;
  getPendingRequests(): Promise<PendingFriendRequest[]>;
  getSentRequests(): Promise<PendingFriendRequest[]>;

  // Write operations
  sendFriendRequest(input: FriendRequestInput): Promise<PendingFriendRequest>;
  acceptFriendRequest(requestId: string): Promise<Friend>;
  rejectFriendRequest(requestId: string): Promise<void>;
  /** L'EXPÉDITEUR retire sa propre demande — DELETE (cf. implémentation). */
  cancelFriendRequest(requestId: string): Promise<void>;
  removeFriend(id: string): Promise<void>;

  // Task sharing operations
  shareTask(input: ShareTaskInput): Promise<void>;
  unshareTask(taskId: string, friendId: string): Promise<void>;
  /** Le destinataire courant accepte une tâche partagée (accepted_at = now). */
  acceptSharedTask(taskId: string): Promise<void>;

  // Task sharing — read model (owner side)
  getTaskShares(taskId: string): Promise<TaskShare[]>;
  getMyTaskShares(): Promise<TaskShare[]>;
  /** Toutes les grants impliquant l'utilisateur courant (propriétaire OU
   *  destinataire) — pour afficher les avatars des collaborateurs des deux
   *  côtés. */
  getRelatedTaskShares(): Promise<RelatedTaskShare[]>;

  // List sharing operations (copy-on-accept)
  /** Partage une liste (snapshot nom + couleur + tâches) avec un ami. */
  shareList(input: ShareListInput): Promise<void>;
  /** Listes partagées REÇUES par l'utilisateur courant, non encore acceptées. */
  getIncomingSharedLists(): Promise<SharedListGrant[]>;
  /** Marque une grant de liste comme acceptée (la matérialisation liste+tâches
   *  est orchestrée côté hook via les repos lists/tasks). */
  acceptSharedList(grantId: string): Promise<void>;
  /** Refuse (supprime) une grant de liste reçue. */
  refuseSharedList(grantId: string): Promise<void>;
}
