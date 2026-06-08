import { describe, it, expect } from 'vitest';
import {
  collabIdOf,
  isAlreadyCollaborator,
  filterFriendsForCollab,
  resolveCollaboratorDisplay,
} from './collaborators';

const friend = (over: Partial<{ id: string; userId: string; name: string; email: string; avatar: string }> = {}) => ({
  id: 'row-1',
  name: 'Alice',
  email: 'alice@example.com',
  ...over,
});

describe('collabIdOf', () => {
  it('prefers userId (auth.uid) when present', () => {
    expect(collabIdOf({ id: 'row-1', userId: 'uid-1' })).toBe('uid-1');
  });
  it('falls back to friend.id in demo mode', () => {
    expect(collabIdOf({ id: 'row-1' })).toBe('row-1');
  });
});

describe('isAlreadyCollaborator', () => {
  it('matches by auth.uid', () => {
    expect(isAlreadyCollaborator(friend({ userId: 'uid-1' }), ['uid-1'])).toBe(true);
  });
  it('matches by row id', () => {
    expect(isAlreadyCollaborator(friend({ id: 'row-9' }), ['row-9'])).toBe(true);
  });
  it('matches by email', () => {
    expect(isAlreadyCollaborator(friend({ email: 'a@b.co' }), ['a@b.co'])).toBe(true);
  });
  it('is false when no identity is present in the list', () => {
    expect(isAlreadyCollaborator(friend({ userId: 'uid-1' }), ['other'])).toBe(false);
  });
});

describe('filterFriendsForCollab', () => {
  const friends = [
    friend({ id: 'a', userId: 'uid-a', name: 'Alice', email: 'alice@x.com' }),
    friend({ id: 'b', userId: 'uid-b', name: 'Bob', email: 'bob@x.com' }),
  ];

  it('excludes already-selected collaborators', () => {
    const out = filterFriendsForCollab(friends, ['uid-a'], '');
    expect(out.map((f) => f.id)).toEqual(['b']);
  });
  it('returns all available when query empty', () => {
    expect(filterFriendsForCollab(friends, [], '')).toHaveLength(2);
  });
  it('filters by name (case-insensitive)', () => {
    expect(filterFriendsForCollab(friends, [], 'ALI').map((f) => f.id)).toEqual(['a']);
  });
  it('filters by email', () => {
    expect(filterFriendsForCollab(friends, [], 'bob@').map((f) => f.id)).toEqual(['b']);
  });
  it('tolerates undefined friends', () => {
    expect(filterFriendsForCollab(undefined, [], '')).toEqual([]);
  });
});

describe('resolveCollaboratorDisplay', () => {
  const deps = {
    friends: [friend({ id: 'row-1', userId: 'uid-1', name: 'Alice', email: 'alice@x.com', avatar: '🦊' })],
    sentRequests: [{ id: 'r1', email: 'pending@x.com', receiverId: 'uid-pending' }],
    pendingInvitesLocal: ['invite@x.com'],
  };

  it('resolves a known friend by auth.uid', () => {
    expect(resolveCollaboratorDisplay('uid-1', deps)).toEqual({
      name: 'Alice', email: 'alice@x.com', avatar: '🦊', isPending: false,
    });
  });
  it('resolves a pending outgoing request by receiverId', () => {
    const d = resolveCollaboratorDisplay('uid-pending', deps);
    expect(d).toEqual({ name: 'pending@x.com', email: 'pending@x.com', avatar: undefined, isPending: true });
  });
  it('shows an email-shaped id verbatim and flags local pending invites', () => {
    expect(resolveCollaboratorDisplay('invite@x.com', deps)).toEqual({
      name: 'invite@x.com', email: 'invite@x.com', avatar: undefined, isPending: true,
    });
  });
  it('masks a raw UUID behind a generic label', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    expect(resolveCollaboratorDisplay(uuid, deps)).toEqual({
      name: 'Collaborateur', email: undefined, avatar: undefined, isPending: false,
    });
  });
  it('falls back to the id for an unresolved non-uuid non-email value', () => {
    expect(resolveCollaboratorDisplay('Carol', deps)).toEqual({
      name: 'Carol', email: undefined, avatar: undefined, isPending: false,
    });
  });
});
