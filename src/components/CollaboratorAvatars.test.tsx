// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CollaboratorAvatars from './CollaboratorAvatars';
import type { Friend } from '@/modules/friends';

const friends: Friend[] = [
  { id: 'f1', name: 'Alice', email: 'a@x.y', userId: 'alice-uid', avatar: 'data:image/jpeg;base64,xxx' },
  { id: 'f2', name: 'Bob', email: 'b@x.y', userId: 'bob-uid', avatar: '🦊' },
  { id: 'f3', name: 'Carla Dupont', email: 'c@x.y', userId: 'carla-uid' },
];

describe('CollaboratorAvatars', () => {
  it('renders nothing without collaborators', () => {
    const { container } = render(<CollaboratorAvatars collaboratorIds={[]} friends={friends} />);
    expect(container.innerHTML).toBe('');
  });

  it('matches a friend by userId and shows the emoji avatar in the fallback', () => {
    render(<CollaboratorAvatars collaboratorIds={['bob-uid']} friends={friends} />);
    expect(screen.getByText('🦊')).toBeTruthy();
  });

  it('falls back to initials when the friend has no avatar', () => {
    render(<CollaboratorAvatars collaboratorIds={['Carla Dupont']} friends={friends} />);
    expect(screen.getByText('CD')).toBeTruthy(); // initiales des 2 premiers mots
  });

  it('caps visible avatars at maxVisible and shows the +N overflow badge', () => {
    render(
      <CollaboratorAvatars
        collaboratorIds={['alice-uid', 'bob-uid', 'Carla Dupont', 'x', 'y']}
        friends={friends}
        maxVisible={3}
      />
    );
    expect(screen.getByText('+2')).toBeTruthy();
  });
});
