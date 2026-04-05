// ═══════════════════════════════════════════════════════════════════
// FRIENDS MODULE - Unit Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Friend, FriendRequestInput, ShareTaskInput, PendingFriendRequest, FriendRequestStatus } from '@/modules/friends/types';
import { friendKeys, FRIENDS_STORAGE_KEY } from '@/modules/friends/constants';

// ═══════════════════════════════════════════════════════════════════
// TYPES TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Friends Types', () => {
  it('should have valid FriendRequestStatus values', () => {
    const statuses: FriendRequestStatus[] = ['pending', 'accepted', 'rejected'];
    expect(statuses).toContain('pending');
    expect(statuses).toContain('accepted');
    expect(statuses).toContain('rejected');
  });

  it('should create valid Friend object', () => {
    const friend: Friend = {
      id: 'friend-1',
      name: 'John Doe',
      email: 'john@example.com',
      avatar: '👤',
    };

    expect(friend.id).toBe('friend-1');
    expect(friend.name).toBe('John Doe');
    expect(friend.email).toBe('john@example.com');
    expect(friend.avatar).toBe('👤');
  });

  it('should create Friend without optional avatar', () => {
    const friend: Friend = {
      id: 'friend-2',
      name: 'Jane Doe',
      email: 'jane@example.com',
    };

    expect(friend.avatar).toBeUndefined();
  });

  it('should create valid ShareTaskInput', () => {
    const input: ShareTaskInput = {
      taskId: 'task-1',
      friendId: 'friend-1',
      role: 'editor',
    };

    expect(input.taskId).toBe('task-1');
    expect(input.friendId).toBe('friend-1');
    expect(input.role).toBe('editor');
  });

  it('should create valid PendingFriendRequest', () => {
    const request: PendingFriendRequest = {
      id: 'req-1',
      email: 'newuser@example.com',
      status: 'pending',
      sentAt: '2026-01-15T10:00:00Z',
    };

    expect(request.id).toBe('req-1');
    expect(request.status).toBe('pending');
    expect(request.sentAt).toBe('2026-01-15T10:00:00Z');
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
    expect(friendKeys.pendingRequests()).toEqual(['friends', 'pending']);
  });
});

// ═══════════════════════════════════════════════════════════════════
// EMAIL VALIDATION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Email Validation', () => {
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  it('should accept valid email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('john.doe@company.org')).toBe(true);
    expect(isValidEmail('test+label@domain.co.uk')).toBe(true);
  });

  it('should reject invalid email addresses', () => {
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('user domain.com')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// FRIEND REQUEST FLOW TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Friend Request Flow', () => {
  it('should transition from pending to accepted', () => {
    const acceptRequest = (request: PendingFriendRequest): PendingFriendRequest => {
      return { ...request, status: 'accepted' };
    };

    const request: PendingFriendRequest = {
      id: '1', email: 'test@test.com', status: 'pending', sentAt: '2026-01-01'
    };

    const accepted = acceptRequest(request);
    expect(accepted.status).toBe('accepted');
  });

  it('should transition from pending to rejected', () => {
    const rejectRequest = (request: PendingFriendRequest): PendingFriendRequest => {
      return { ...request, status: 'rejected' };
    };

    const request: PendingFriendRequest = {
      id: '1', email: 'test@test.com', status: 'pending', sentAt: '2026-01-01'
    };

    const rejected = rejectRequest(request);
    expect(rejected.status).toBe('rejected');
  });

  it('should create friend from accepted request', () => {
    const createFriendFromRequest = (request: PendingFriendRequest): Friend => {
      return {
        id: `friend-${request.id}`,
        name: request.email.split('@')[0],
        email: request.email,
        avatar: '👤',
      };
    };

    const request: PendingFriendRequest = {
      id: '1', email: 'john@example.com', status: 'accepted', sentAt: '2026-01-01'
    };

    const friend = createFriendFromRequest(request);
    expect(friend.name).toBe('john');
    expect(friend.email).toBe('john@example.com');
  });
});
