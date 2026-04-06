// ═══════════════════════════════════════════════════════════════════
// FRIENDS MODULE - Unit Tests
// Synchronisé avec src/modules/friends/types.ts
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { friendKeys, FRIENDS_STORAGE_KEY } from '@/modules/friends/constants';
import { Friend, PendingFriendRequest } from '@/modules/friends/types';

// ═══════════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════════

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

// ═══════════════════════════════════════════════════════════════════
// TYPES TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Friends Types', () => {
  it('should create a valid Friend object', () => {
    const friend: Friend = {
      id: 'friend-1',
      name: 'Alice Dupont',
      email: 'alice@example.com',
    };

    expect(friend.id).toBe('friend-1');
    expect(friend.name).toBe('Alice Dupont');
    expect(friend.email).toBe('alice@example.com');
  });

  it('should allow optional avatar', () => {
    const friend: Friend = {
      id: 'friend-2',
      name: 'Bob Martin',
      email: 'bob@example.com',
      avatar: 'https://example.com/avatar.png',
    };

    expect(friend.avatar).toBeDefined();
  });

  it('should create a valid PendingFriendRequest', () => {
    const request: PendingFriendRequest = {
      id: 'req-1',
      email: 'charlie@example.com',
      status: 'pending',
      sentAt: new Date().toISOString(),
    };

    expect(request.status).toBe('pending');
    expect(request.email).toBe('charlie@example.com');
  });
});

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Friends Constants', () => {
  it('should have correct storage key', () => {
    expect(FRIENDS_STORAGE_KEY).toBe('cosmo_friends');
  });

  it('should have correct query keys structure', () => {
    expect(friendKeys.all).toEqual(['friends']);
    expect(friendKeys.lists()).toEqual(['friends', 'list']);
    expect(friendKeys.detail('friend-1')).toEqual(['friends', 'detail', 'friend-1']);
    // Correction : pendingRequests() n'existe pas — la vraie méthode est requests()
    expect(friendKeys.requests()).toEqual(['friends', 'requests']);
    expect(friendKeys.sharedTasks()).toEqual(['friends', 'sharedTasks']);
  });
});

// ═══════════════════════════════════════════════════════════════════
// FRIEND FILTERING LOGIC TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Friend Filtering Logic', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it('should filter friends by name', () => {
    const friends: Friend[] = [
      { id: '1', name: 'Alice Dupont', email: 'alice@example.com' },
      { id: '2', name: 'Bob Martin', email: 'bob@example.com' },
      { id: '3', name: 'Alice Bernard', email: 'abernard@example.com' },
    ];

    const filtered = friends.filter((f) =>
      f.name.toLowerCase().includes('alice')
    );

    expect(filtered).toHaveLength(2);
    expect(filtered.every((f) => f.name.includes('Alice'))).toBe(true);
  });

  it('should filter friends by email', () => {
    const friends: Friend[] = [
      { id: '1', name: 'Alice', email: 'alice@company.com' },
      { id: '2', name: 'Bob', email: 'bob@personal.com' },
      { id: '3', name: 'Charlie', email: 'charlie@company.com' },
    ];

    const companyFriends = friends.filter((f) =>
      f.email.includes('@company.com')
    );

    expect(companyFriends).toHaveLength(2);
  });

  it('should return empty array when no friends match', () => {
    const friends: Friend[] = [
      { id: '1', name: 'Alice', email: 'alice@example.com' },
    ];

    const filtered = friends.filter((f) =>
      f.name.toLowerCase().includes('zzz')
    );

    expect(filtered).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// FRIEND REQUEST STATUS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Friend Request Status Logic', () => {
  it('should count pending requests correctly', () => {
    const requests: PendingFriendRequest[] = [
      { id: '1', email: 'a@a.com', status: 'pending', sentAt: '' },
      { id: '2', email: 'b@b.com', status: 'accepted', sentAt: '' },
      { id: '3', email: 'c@c.com', status: 'pending', sentAt: '' },
      { id: '4', email: 'd@d.com', status: 'rejected', sentAt: '' },
    ];

    const pendingCount = requests.filter((r) => r.status === 'pending').length;

    expect(pendingCount).toBe(2);
  });

  it('should identify accepted requests', () => {
    const requests: PendingFriendRequest[] = [
      { id: '1', email: 'a@a.com', status: 'accepted', sentAt: '' },
    ];

    expect(requests[0].status).toBe('accepted');
  });
});
