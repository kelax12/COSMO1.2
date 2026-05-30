// ═══════════════════════════════════════════════════════════════════
// FRIENDS MODULE - Repository Pattern Implementation
// ═══════════════════════════════════════════════════════════════════

import { Friend, FriendRequestInput, ShareTaskInput, PendingFriendRequest, TaskShare } from './types';
import { FRIENDS_STORAGE_KEY, FRIEND_REQUESTS_STORAGE_KEY, SHARED_TASKS_STORAGE_KEY } from './constants';

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
  },
  {
    id: 'req-demo-2',
    email: 'demo@cosmo.app',
    status: 'pending',
    sentAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    senderId: 'user-camille',
    senderEmail: 'camille.richard@email.com',
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

  // Task sharing — read model (owner side)
  getTaskShares(taskId: string): Promise<TaskShare[]>;
  getMyTaskShares(): Promise<TaskShare[]>;
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
    const sharedTasks = JSON.parse(localStorage.getItem(SHARED_TASKS_STORAGE_KEY) || '{}');
    
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
    const sharedTasks = JSON.parse(localStorage.getItem(SHARED_TASKS_STORAGE_KEY) || '{}');
    
    if (sharedTasks[taskId]) {
      sharedTasks[taskId] = sharedTasks[taskId].filter(
        (s: { friendId: string }) => s.friendId !== friendId
      );
      localStorage.setItem(SHARED_TASKS_STORAGE_KEY, JSON.stringify(sharedTasks));
    }
  }

  async getTaskShares(taskId: string): Promise<TaskShare[]> {
    const map = JSON.parse(localStorage.getItem(SHARED_TASKS_STORAGE_KEY) || '{}');
    const entries: { friendId: string; role?: 'viewer' | 'editor' }[] = map[taskId] || [];
    return entries.map((s) => ({ taskId, friendId: s.friendId, role: s.role || 'viewer' }));
  }

  async getMyTaskShares(): Promise<TaskShare[]> {
    const map = JSON.parse(localStorage.getItem(SHARED_TASKS_STORAGE_KEY) || '{}');
    const out: TaskShare[] = [];
    for (const taskId of Object.keys(map)) {
      const entries: { friendId: string; role?: 'viewer' | 'editor' }[] = map[taskId] || [];
      for (const s of entries) {
        out.push({ taskId, friendId: s.friendId, role: s.role || 'viewer' });
      }
    }
    return out;
  }
}
