// ═══════════════════════════════════════════════════════════════════
// USER MODULE - Unit Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { User, Message, AuthState } from '@/modules/user/types';
import { DEMO_USER, USER_STORAGE_KEY, MESSAGES_STORAGE_KEY, userKeys } from '@/modules/user/constants';

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

describe('User Types', () => {
  it('should create valid User object', () => {
    const user: User = {
      id: 'user-1',
      name: 'John Doe',
      email: 'john@example.com',
      avatar: '👤',
    };

    expect(user.id).toBe('user-1');
    expect(user.name).toBe('John Doe');
    expect(user.email).toBe('john@example.com');
    expect(user.avatar).toBe('👤');
  });

  it('should create valid Message object', () => {
    const message: Message = {
      id: 'msg-1',
      read: false,
      content: 'Hello!',
      senderId: 'user-2',
      timestamp: '2026-01-15T10:00:00Z',
    };

    expect(message.id).toBe('msg-1');
    expect(message.read).toBe(false);
    expect(message.content).toBe('Hello!');
  });

  it('should create valid AuthState', () => {
    const authState: AuthState = {
      isAuthenticated: true,
      isDemo: false,
      loading: false,
    };

    expect(authState.isAuthenticated).toBe(true);
    expect(authState.isDemo).toBe(false);
    expect(authState.loading).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('User Constants', () => {
  it('should have correct storage keys', () => {
    expect(USER_STORAGE_KEY).toBe('cosmo_user');
    expect(MESSAGES_STORAGE_KEY).toBe('cosmo_messages');
  });

  it('should have valid demo user', () => {
    expect(DEMO_USER.id).toBe('demo-user');
    expect(DEMO_USER.name).toBe('Demo');
    expect(DEMO_USER.email).toBe('demo@cosmo.app');
  });

  it('should have correct query keys structure', () => {
    expect(userKeys.all).toEqual(['user']);
    expect(userKeys.current()).toEqual(['user', 'current']);
    expect(userKeys.messages()).toEqual(['user', 'messages']);
    expect(userKeys.settings()).toEqual(['user', 'settings']);
  });
});

// ═══════════════════════════════════════════════════════════════════
// MESSAGE OPERATIONS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Message Operations', () => {
  it('should count unread messages', () => {
    const countUnread = (messages: Message[]): number => {
      return messages.filter(m => !m.read).length;
    };

    const messages: Message[] = [
      { id: '1', read: false, content: 'A' },
      { id: '2', read: true, content: 'B' },
      { id: '3', read: false, content: 'C' },
    ];

    expect(countUnread(messages)).toBe(2);
  });

  it('should mark all messages as read', () => {
    const markAllAsRead = (messages: Message[]): Message[] => {
      return messages.map(m => ({ ...m, read: true }));
    };

    const messages: Message[] = [
      { id: '1', read: false, content: 'A' },
      { id: '2', read: false, content: 'B' },
    ];

    const updated = markAllAsRead(messages);
    expect(updated.every(m => m.read)).toBe(true);
  });

  it('should mark single message as read', () => {
    const markAsRead = (messages: Message[], msgId: string): Message[] => {
      return messages.map(m => m.id === msgId ? { ...m, read: true } : m);
    };

    const messages: Message[] = [
      { id: '1', read: false, content: 'A' },
      { id: '2', read: false, content: 'B' },
    ];

    const updated = markAsRead(messages, '1');
    expect(updated[0].read).toBe(true);
    expect(updated[1].read).toBe(false);
  });
});
