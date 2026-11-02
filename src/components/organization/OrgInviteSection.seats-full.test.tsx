// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

interface Opts {
  isOwner?: boolean;
  seatsFull?: boolean;
  seatsQuota?: number | null;
  memberCount?: number;
  pastDue?: boolean;
}

function renderSection({ isOwner = true, seatsFull = true, seatsQuota = 5, memberCount = 5, pastDue = false }: Opts = {}) {
  return render(
    <MemoryRouter>
      <OrgInviteSection
        org={org}
        currentUserId="u1"
        isAdmin
        canInvite
        canInviteByEmail
        seatsFull={seatsFull}
        seatsQuota={seatsQuota}
        memberCount={memberCount}
        isOwner={isOwner}
        pastDue={pastDue}
        onInviteByEmail={() => {}}
      />
    </MemoryRouter>,
  );
}

describe('OrgInviteSection, plus de place', () => {
  it('propriétaire sur le palier gratuit : phrase du palier suivant et lien présélectionné', () => {
    renderSection();
    expect(screen.getByText(/passez au palier 5 à 10 membres/i)).toBeTruthy();
    const link = screen.getByRole('link', { name: /passer au palier supérieur/i });
    expect(link.getAttribute('href')).toContain('tier=t10');
  });

  it('non propriétaire : renvoyé au propriétaire, aucun lien de mise à niveau', () => {
    renderSection({ isOwner: false });
    expect(screen.getByText(/seul le propriétaire peut changer de palier/i)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /passer au palier supérieur/i })).toBeNull();
  });

  it('palier payant plein : prix actuel rappelé et palier suivant présélectionné', () => {
    renderSection({ seatsQuota: 10, memberCount: 10 });
    expect(screen.getByText(/au lieu de/i)).toBeTruthy();
    const link = screen.getByRole('link', { name: /passer au palier supérieur/i });
    expect(link.getAttribute('href')).toContain('tier=t20');
  });

  it('au-delà du quota : le palier conseillé tient compte de l effectif', () => {
    renderSection({ seatsQuota: 5, memberCount: 7 });
    const link = screen.getByRole('link', { name: /passer au palier supérieur/i });
    expect(link.getAttribute('href')).toContain('tier=t10');
  });

  it('impayé : jamais de mise à niveau (second abonnement), la carte à régulariser', () => {
    renderSection({ pastDue: true, seatsQuota: 5, memberCount: 12 });
    expect(screen.queryByRole('link', { name: /passer au palier supérieur/i })).toBeNull();
    expect(screen.getByText(/le dernier paiement n'est pas passé/i)).toBeTruthy();
    const link = screen.getByRole('link', { name: /mettre à jour ma carte/i });
    expect(link.getAttribute('href')).not.toContain('tier=');
    expect(link.getAttribute('href')).toContain('billing');
  });

  it('places disponibles : aucun bloc', () => {
    renderSection({ seatsFull: false, memberCount: 3 });
    expect(screen.queryByRole('link', { name: /passer au palier supérieur/i })).toBeNull();
    expect(screen.queryByText(/seul le propriétaire peut changer de palier/i)).toBeNull();
  });

  it('l adresse saisie est reprise dans la phrase', () => {
    renderSection();
    fireEvent.change(document.getElementById('invite-quick-emails') as HTMLInputElement, {
      target: { value: 'ada@acme.fr' },
    });
    expect(screen.getByText(/pour inviter ada@acme\.fr/i)).toBeTruthy();
  });
});
