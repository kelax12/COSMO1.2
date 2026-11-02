// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { MyOrganization } from '@/modules/organizations';

// Les enfants paresseux ne sont pas l'objet : rien à rendre.
vi.mock('@/components/organization/InviteFriendsToOrg', () => ({ default: () => null }));
vi.mock('@/components/organization/OrgJoinCodeCard', () => ({ default: () => null }));
vi.mock('@/components/organization/OrgInviteLinkCard', () => ({ default: () => null }));
vi.mock('@/components/organization/OrgJoinRequestsList', () => ({ default: () => null }));
vi.mock('@/components/organization/EmailInvitationsList', () => ({ default: () => null }));

import OrgInviteSection from './OrgInviteSection';

const org: MyOrganization = {
  id: 'org-1',
  name: 'Acme',
  ownerId: 'u1',
  createdAt: '2026-01-01T00:00:00Z',
  myRole: 'admin',
};

function renderSection(isOwner: boolean) {
  return render(
    <MemoryRouter>
      <OrgInviteSection
        org={org}
        currentUserId="u1"
        isAdmin
        canInvite
        canInviteByEmail
        seatsFull
        seatsQuota={5}
        memberCount={5}
        isOwner={isOwner}
        onInviteByEmail={() => {}}
      />
    </MemoryRouter>,
  );
}

describe('OrgInviteSection, plus de place', () => {
  it('propriétaire sur le palier gratuit : phrase du palier suivant et lien présélectionné', () => {
    renderSection(true);
    expect(screen.getByText(/passez au palier 5 à 10 membres/i)).toBeTruthy();
    const link = screen.getByRole('link', { name: /passer au palier supérieur/i });
    expect(link.getAttribute('href')).toContain('tier=t10');
  });

  it('non propriétaire : renvoyé au propriétaire, aucun lien de mise à niveau', () => {
    renderSection(false);
    expect(screen.getByText(/seul le propriétaire peut changer de palier/i)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /passer au palier supérieur/i })).toBeNull();
  });
});
