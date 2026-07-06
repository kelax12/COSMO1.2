// ═══════════════════════════════════════════════════════════════════
// FRIENDS MODULE - Repository Pattern Implementation
// ═══════════════════════════════════════════════════════════════════

import { Friend, FriendRequestInput, ShareTaskInput, PendingFriendRequest, TaskShare, RelatedTaskShare, ShareListInput, SharedListGrant } from './types';
import { FRIENDS_STORAGE_KEY, FRIEND_REQUESTS_STORAGE_KEY, SHARED_TASKS_STORAGE_KEY, SHARED_LISTS_STORAGE_KEY } from './constants';

/** Id de l'utilisateur démo — utilisé pour distinguer partages entrants/sortants. */
const DEMO_USER_ID = 'demo-user';

// ═══════════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════════

const DEMO_FRIENDS: Friend[] = [
  { id: 'friend-1', name: 'Marie Dupont', email: 'marie.dupont@email.com', avatar: '👩' },
  { id: 'friend-2', name: 'Jean Martin', email: 'jean.martin@email.com', avatar: '👨' },
  { id: 'friend-3', name: 'Sophie Bernard', email: 'sophie.bernard@email.com', avatar: '👩‍💼' },
];

const DEMO_INCOMING_REQUESTS: PendingFriendRequest[] = [
  {
    id: 'req-demo-1',
    email: 'demo@cosmo.app',
    status: 'pending',
    sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    senderId: 'user-lucas',
    senderEmail: 'lucas.moreau@email.com',
    senderName: 'Lucas Moreau',
    senderAvatar: '🧑',
  },
  {
    id: 'req-demo-2',
    email: 'demo@cosmo.app',
    status: 'pending',
    sentAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    senderId: 'user-camille',
    senderEmail: 'camille.richard@email.com',
    senderName: 'Camille Richard',
    senderAvatar: '👩',
  },
];

// Listes partagées entrantes seedées pour la démo — le destinataire est
// l'utilisateur démo (friendId = DEMO_USER_ID), non encore acceptées.
const DEMO_INCOMING_SHARED_LISTS: SharedListGrant[] = [
  {
    id: 'shared-list-demo-1',
    listId: 'list-marie-courses',
    name: 'Courses du week-end',
    color: 'green',
    sharedBy: 'friend-1',
    sharedByName: 'Marie Dupont',
    friendId: DEMO_USER_ID,
    accepted: false,
    tasks: [
      { name: 'Fruits & légumes', priority: 3, category: 'Personnel', deadline: '', estimatedTime: 15, bookmarked: false, completed: false },
      { name: 'Pain & viennoiseries', priority: 3, category: 'Personnel', deadline: '', estimatedTime: 10, bookmarked: false, completed: false },
      { name: 'Produits ménagers', priority: 4, category: 'Personnel', deadline: '', estimatedTime: 10, bookmarked: false, completed: false },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface IFriendsRepository {
  // Read operations
  getAll(): Promise<Friend[]>;
  getById(id: string): Promise<Friend | null>;
  getByEmail(email: string): Promise<Friend | null>;
  getPendingRequests(): Promise<PendingFriendRequest[]>;
  getSentRequests(): Promise<PendingFriendRequest[]>;

  // Write operations
  sendFriendRequest(input: FriendRequestInput): Promise<PendingFriendRequest>;
  acceptFriendRequest(requestId: string): Promise<Friend>;
  rejectFriendRequest(requestId: string): Promise<void>;
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

// ═══════════════════════════════════════════════════════════════════
// LOCAL STORAGE REPOSITORY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export class LocalStorageFriendsRepository implements IFriendsRepository {
  /**
   * Get all friends from localStorage (or initialize with demo data)
   */
  private getFriends(): Friend[] {
    const data = localStorage.getItem(FRIENDS_STORAGE_KEY);
    if (!data) {
      // Defensive clone — DEMO_FRIENDS is a module-level constant. The old
      // code returned it directly and later code mutated the result, leaving
      // the constant in a corrupted state for the rest of the JS module's
      // life (visible across multiple loginDemo() calls). Faille B12.
      const seed = JSON.parse(JSON.stringify(DEMO_FRIENDS)) as Friend[];
      this.saveFriends(seed);
      return seed;
    }
    try {
      return JSON.parse(data);
    } catch {
      // Corrupted storage — reseed defensively. Faille B14.
      const seed = JSON.parse(JSON.stringify(DEMO_FRIENDS)) as Friend[];
      this.saveFriends(seed);
      return seed;
    }
  }

  /**
   * Save friends to localStorage
   */
  private saveFriends(friends: Friend[]): void {
    localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(friends));
  }

  /**
   * Get pending friend requests
   */
  private getRequests(): PendingFriendRequest[] {
    const data = localStorage.getItem(FRIEND_REQUESTS_STORAGE_KEY);
    if (!data) {
      // Defensive clone — see getFriends() above. Faille B12.
      const seed = JSON.parse(JSON.stringify(DEMO_INCOMING_REQUESTS)) as PendingFriendRequest[];
      this.saveRequests(seed);
      return seed;
    }
    try {
      return JSON.parse(data);
    } catch {
      const seed = JSON.parse(JSON.stringify(DEMO_INCOMING_REQUESTS)) as PendingFriendRequest[];
      this.saveRequests(seed);
      return seed;
    }
  }

  /**
   * Save pending friend requests
   */
  private saveRequests(requests: PendingFriendRequest[]): void {
    localStorage.setItem(FRIEND_REQUESTS_STORAGE_KEY, JSON.stringify(requests));
  }

  /**
   * Get the shared-tasks map from localStorage. JSON.parse défensif — une clé
   * corrompue ne doit pas faire crasher toute la zone Amis en démo. Faille B14.
   */
  private getSharedTasksMap(): Record<string, { friendId: string; role?: 'viewer' | 'editor'; accepted?: boolean }[]> {
    try {
      return JSON.parse(localStorage.getItem(SHARED_TASKS_STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async getAll(): Promise<Friend[]> {
    return this.getFriends();
  }

  async getById(id: string): Promise<Friend | null> {
    const friends = this.getFriends();
    return friends.find(f => f.id === id) || null;
  }

  async getByEmail(email: string): Promise<Friend | null> {
    const friends = this.getFriends();
    return friends.find(f => f.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async getPendingRequests(): Promise<PendingFriendRequest[]> {
    return this.getRequests().filter(r => r.status === 'pending');
  }

  async getSentRequests(): Promise<PendingFriendRequest[]> {
    // Outgoing requests: created by current user = no senderEmail
    return this.getRequests().filter(r => r.status === 'pending' && !r.senderEmail);
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async sendFriendRequest(input: FriendRequestInput): Promise<PendingFriendRequest> {
    const requests = this.getRequests();
    
    // Check if already sent
    const existing = requests.find(r => r.email.toLowerCase() === input.email.toLowerCase());
    if (existing) {
      return existing;
    }

    const newRequest: PendingFriendRequest = {
      id: crypto.randomUUID(),
      email: input.email,
      status: 'pending',
      sentAt: new Date().toISOString(),
    };

    this.saveRequests([...requests, newRequest]);
    return newRequest;
  }

  async acceptFriendRequest(requestId: string): Promise<Friend> {
    const requests = this.getRequests();
    const request = requests.find(r => r.id === requestId);

    if (!request) {
      throw new Error(`Friend request ${requestId} not found`);
    }
    // Only incoming requests carry `senderEmail`. Outgoing demo requests have
    // only the recipient's email and must not be acceptable as "you befriend
    // yourself" — reject those explicitly. Faille B13.
    if (!request.senderEmail) {
      throw new Error('Cannot accept an outgoing friend request');
    }

    // Update request status
    request.status = 'accepted';
    this.saveRequests(requests);

    const friendEmail = request.senderEmail;
    const friends = this.getFriends();
    const newFriend: Friend = {
      id: crypto.randomUUID(),
      name: friendEmail.split('@')[0].split('.').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
      email: friendEmail,
    };

    this.saveFriends([...friends, newFriend]);
    return newFriend;
  }

  async rejectFriendRequest(requestId: string): Promise<void> {
    const requests = this.getRequests();
    const request = requests.find(r => r.id === requestId);
    
    if (request) {
      request.status = 'rejected';
      this.saveRequests(requests);
    }
  }

  async removeFriend(id: string): Promise<void> {
    const friends = this.getFriends();
    this.saveFriends(friends.filter(f => f.id !== id));
  }

  // ═══════════════════════════════════════════════════════════════════
  // TASK SHARING OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async shareTask(input: ShareTaskInput): Promise<void> {
    const sharedTasks = this.getSharedTasksMap();
    
    if (!sharedTasks[input.taskId]) {
      sharedTasks[input.taskId] = [];
    }
    
    // Faille B11 — the previous check did `array.includes(friendId)` against
    // entries that are `{ friendId, role }` objects, so it never matched and
    // every call appended a duplicate. Use a property-aware lookup.
    const alreadyShared = sharedTasks[input.taskId].some(
      (s: { friendId: string }) => s.friendId === input.friendId
    );
    if (!alreadyShared) {
      sharedTasks[input.taskId].push({ friendId: input.friendId, role: input.role || 'viewer' });
    }
    
    localStorage.setItem(SHARED_TASKS_STORAGE_KEY, JSON.stringify(sharedTasks));
  }

  async unshareTask(taskId: string, friendId: string): Promise<void> {
    const sharedTasks = this.getSharedTasksMap();

    if (sharedTasks[taskId]) {
      sharedTasks[taskId] = sharedTasks[taskId].filter(
        (s: { friendId: string }) => s.friendId !== friendId
      );
      localStorage.setItem(SHARED_TASKS_STORAGE_KEY, JSON.stringify(sharedTasks));
    }
  }

  async acceptSharedTask(taskId: string): Promise<void> {
    // Démo mono-utilisateur : pas de flux d'acceptation réel, on marque accepté.
    const sharedTasks = this.getSharedTasksMap();
    if (sharedTasks[taskId]) {
      sharedTasks[taskId] = sharedTasks[taskId].map((s) => ({ ...s, accepted: true }));
      localStorage.setItem(SHARED_TASKS_STORAGE_KEY, JSON.stringify(sharedTasks));
    }
  }

  async getTaskShares(taskId: string): Promise<TaskShare[]> {
    const map = this.getSharedTasksMap();
    const entries: { friendId: string; role?: 'viewer' | 'editor'; accepted?: boolean }[] = map[taskId] || [];
    // Démo : pas de flux d'acceptation → considéré accepté par défaut.
    return entries.map((s) => ({ taskId, friendId: s.friendId, role: s.role || 'viewer', accepted: s.accepted ?? true }));
  }

  async getMyTaskShares(): Promise<TaskShare[]> {
    const map = this.getSharedTasksMap();
    const out: TaskShare[] = [];
    for (const taskId of Object.keys(map)) {
      const entries: { friendId: string; role?: 'viewer' | 'editor' }[] = map[taskId] || [];
      for (const s of entries) {
        out.push({ taskId, friendId: s.friendId, role: s.role || 'viewer' });
      }
    }
    return out;
  }

  async getRelatedTaskShares(): Promise<RelatedTaskShare[]> {
    // En démo, toutes les tâches partagées appartiennent à l'utilisateur démo.
    const map = this.getSharedTasksMap();
    const out: RelatedTaskShare[] = [];
    for (const taskId of Object.keys(map)) {
      const entries: { friendId: string; role?: 'viewer' | 'editor'; accepted?: boolean }[] = map[taskId] || [];
      for (const s of entries) {
        out.push({ taskId, sharedBy: 'demo-user', friendId: s.friendId, role: s.role || 'viewer', accepted: s.accepted ?? true });
      }
    }
    return out;
  }

  // ═══════════════════════════════════════════════════════════════════
  // LIST SHARING OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Lecture défensive du tableau des grants de listes partagées. Seed les
   * listes entrantes de démo au premier accès (clone défensif — faille B12 ;
   * JSON.parse protégé — faille B14).
   */
  private getSharedListsArray(): SharedListGrant[] {
    const data = localStorage.getItem(SHARED_LISTS_STORAGE_KEY);
    if (!data) {
      const seed = JSON.parse(JSON.stringify(DEMO_INCOMING_SHARED_LISTS)) as SharedListGrant[];
      localStorage.setItem(SHARED_LISTS_STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    try {
      return JSON.parse(data) as SharedListGrant[];
    } catch {
      const seed = JSON.parse(JSON.stringify(DEMO_INCOMING_SHARED_LISTS)) as SharedListGrant[];
      localStorage.setItem(SHARED_LISTS_STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
  }

  private saveSharedListsArray(grants: SharedListGrant[]): void {
    localStorage.setItem(SHARED_LISTS_STORAGE_KEY, JSON.stringify(grants));
  }

  async shareList(input: ShareListInput): Promise<void> {
    const grants = this.getSharedListsArray();
    // Dédup : même liste déjà partagée au même ami et pas encore acceptée.
    const already = grants.some(
      (g) => g.listId === input.listId && g.friendId === input.friendId && !g.accepted
    );
    if (already) return;
    grants.push({
      id: crypto.randomUUID(),
      listId: input.listId,
      name: input.name,
      color: input.color,
      tasks: input.tasks,
      sharedBy: DEMO_USER_ID,
      friendId: input.friendId,
      accepted: false,
    });
    this.saveSharedListsArray(grants);
  }

  async getIncomingSharedLists(): Promise<SharedListGrant[]> {
    // Entrantes = destinées à l'utilisateur démo et non acceptées.
    return this.getSharedListsArray().filter(
      (g) => g.friendId === DEMO_USER_ID && !g.accepted
    );
  }

  async acceptSharedList(grantId: string): Promise<void> {
    const grants = this.getSharedListsArray();
    const next = grants.map((g) => (g.id === grantId ? { ...g, accepted: true } : g));
    this.saveSharedListsArray(next);
  }

  async refuseSharedList(grantId: string): Promise<void> {
    const grants = this.getSharedListsArray();
    this.saveSharedListsArray(grants.filter((g) => g.id !== grantId));
  }
}
