// ═══════════════════════════════════════════════════════════════════
// FRIENDS MODULE - Repository Pattern Implementation
// ═══════════════════════════════════════════════════════════════════

import { Friend, FriendRequestInput, ShareTaskInput, PendingFriendRequest } from './types';
import { FRIENDS_STORAGE_KEY, FRIEND_REQUESTS_STORAGE_KEY, SHARED_TASKS_STORAGE_KEY } from './constants';

// ═══════════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════════

const DEMO_FRIENDS: Friend[] = [
  { id: 'friend-1', name: 'Marie Dupont', email: 'marie.dupont@email.com', avatar: '👩' },
  { id: 'friend-2', name: 'Jean Martin', email: 'jean.martin@email.com', avatar: '👨' },
  { id: 'friend-3', name: 'Sophie Bernard', email: 'sophie.bernard@email.com', avatar: '👩‍💼' },
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

  // Write operations
  sendFriendRequest(input: FriendRequestInput): Promise<PendingFriendRequest>;
  acceptFriendRequest(requestId: string): Promise<Friend>;
  rejectFriendRequest(requestId: string): Promise<void>;
  removeFriend(id: string): Promise<void>;

  // Task sharing operations
  shareTask(input: ShareTaskInput): Promise<void>;
  unshareTask(taskId: string, friendId: string): Promise<void>;
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
      this.saveFriends(DEMO_FRIENDS);
      return DEMO_FRIENDS;
    }
    return JSON.parse(data);
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
    return data ? JSON.parse(data) : [];
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
    console.log('Friend request sent to:', input.email);
    return newRequest;
  }

  async acceptFriendRequest(requestId: string): Promise<Friend> {
    const requests = this.getRequests();
    const request = requests.find(r => r.id === requestId);
    
    if (!request) {
      throw new Error(`Friend request ${requestId} not found`);
    }

    // Update request status
    request.status = 'accepted';
    this.saveRequests(requests);

    // Create new friend from request
    const friends = this.getFriends();
    const newFriend: Friend = {
      id: crypto.randomUUID(),
      name: request.email.split('@')[0],
      email: request.email,
      avatar: '👤',
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
    
    if (!sharedTasks[input.taskId].includes(input.friendId)) {
      sharedTasks[input.taskId].push({ friendId: input.friendId, role: input.role || 'viewer' });
    }
    
    localStorage.setItem(SHARED_TASKS_STORAGE_KEY, JSON.stringify(sharedTasks));
    console.log('Task shared:', input.taskId, 'with', input.friendId, 'as', input.role);
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
}
