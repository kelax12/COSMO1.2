// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// La boite de reception d'entreprise tient en UNE lecture (mig. 129)
//
// Cinq requetes partaient a chaque ouverture de l'application, sur TOUTES les
// pages protegees, parce que `Layout` monte `useOrgBadges` pour peindre une
// pastille. Ces tests echouent si l'un des cinq hooks est rebranche sur sa
// lecture d'origine : une cle React Query de plus est une requete de plus.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const fakeRepo = {
  getMyOrgInbox: vi.fn(),
  getPendingJoinRequests: vi.fn(),
  getMySentJoinRequest: vi.fn(),
  getMyOrgInvitations: vi.fn(),
  getMyOrgRemovalNotices: vi.fn(),
};

vi.mock('@/lib/repository.factory', () => ({ getOrganizationsRepository: () => fakeRepo }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import {
  useOrgJoinRequests, useMySentJoinRequest,
  useMyOrgInvitations, useMyOrgRemovalNotices,
} from './hooks';
import { useOrgInbox } from './inbox';
import { useOrgNotifications } from './notifications';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

const inbox = {
  invitations: [
    { id: 'i1', orgId: ORG_B, orgName: 'Beta', inviterId: 'u9', inviterName: 'Zoe', createdAt: '2026-08-20T10:00:00.000Z' },
  ],
  removalNotices: [
    { id: 'n1', orgId: 'org-c', orgName: 'Gamma', actorName: 'Max', createdAt: '2026-08-19T10:00:00.000Z' },
  ],
  myJoinRequest: { id: 'r0', orgId: ORG_B, userId: 'me', requestedAt: '2026-08-18T10:00:00.000Z', status: 'pending' as const },
  joinRequests: [
    { id: 'r1', orgId: ORG_A, userId: 'u1', requestedAt: '2026-08-17T10:00:00.000Z', status: 'pending' as const, requesterName: 'Alice' },
    { id: 'r2', orgId: ORG_B, userId: 'u2', requestedAt: '2026-08-16T10:00:00.000Z', status: 'pending' as const, requesterName: 'Bob' },
  ],
  notifications: [
    { id: 'x1', orgId: ORG_A, actorId: 'u1', kind: 'task_assigned' as const, taskId: 't1', readAt: null, createdAt: '2026-08-21T10:00:00.000Z' },
    { id: 'x2', orgId: ORG_B, actorId: null, kind: 'task_overdue' as const, taskId: 't2', readAt: null, createdAt: '2026-08-22T10:00:00.000Z' },
  ],
};

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => {
  Object.values(fakeRepo).forEach((fn) => fn.mockReset());
  fakeRepo.getMyOrgInbox.mockResolvedValue(inbox);
});

describe('boite de reception d entreprise', () => {
  it('les CINQ hooks partagent UNE lecture, et aucune lecture unitaire ne part', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => ({
      demandesOrgA: useOrgJoinRequests(ORG_A),
      maDemande: useMySentJoinRequest(),
      invitations: useMyOrgInvitations(),
      retraits: useMyOrgRemovalNotices(),
      notifsOrgA: useOrgNotifications(ORG_A),
    }), { wrapper });

    await waitFor(() => expect(result.current.invitations.data).toHaveLength(1));

    expect(fakeRepo.getMyOrgInbox).toHaveBeenCalledTimes(1);
    expect(fakeRepo.getPendingJoinRequests).not.toHaveBeenCalled();
    expect(fakeRepo.getMySentJoinRequest).not.toHaveBeenCalled();
    expect(fakeRepo.getMyOrgInvitations).not.toHaveBeenCalled();
    expect(fakeRepo.getMyOrgRemovalNotices).not.toHaveBeenCalled();
  });

  it('chaque selecteur rend exactement ce que rendait sa requete', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => ({
      demandesOrgA: useOrgJoinRequests(ORG_A),
      demandesOrgB: useOrgJoinRequests(ORG_B),
      maDemande: useMySentJoinRequest(),
      invitations: useMyOrgInvitations(),
      retraits: useMyOrgRemovalNotices(),
      notifsOrgA: useOrgNotifications(ORG_A),
      notifsOrgB: useOrgNotifications(ORG_B),
    }), { wrapper });

    await waitFor(() => expect(result.current.invitations.data).toHaveLength(1));

    // Le filtrage par organisation se fait cote client : chaque org ne voit
    // que ce qui la concerne, jamais le lot entier.
    expect(result.current.demandesOrgA.data.map((r) => r.id)).toEqual(['r1']);
    expect(result.current.demandesOrgB.data.map((r) => r.id)).toEqual(['r2']);
    expect(result.current.notifsOrgA.data.map((n) => n.id)).toEqual(['x1']);
    expect(result.current.notifsOrgB.data.map((n) => n.id)).toEqual(['x2']);
    expect(result.current.maDemande.data?.id).toBe('r0');
    expect(result.current.invitations.data[0].orgName).toBe('Beta');
    expect(result.current.retraits.data[0].orgName).toBe('Gamma');
  });

  it('sans organisation demandee, les sections par org sont vides et non le lot entier', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => ({
      demandes: useOrgJoinRequests(undefined),
      notifs: useOrgNotifications(undefined),
      invitations: useMyOrgInvitations(),
    }), { wrapper });

    await waitFor(() => expect(result.current.invitations.data).toHaveLength(1));
    expect(result.current.demandes.data).toEqual([]);
    expect(result.current.notifs.data).toEqual([]);
  });

  it('rend des listes vides tant que la lecture n a pas abouti', () => {
    fakeRepo.getMyOrgInbox.mockReturnValue(new Promise(() => {}));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => ({
      inbox: useOrgInbox(),
      invitations: useMyOrgInvitations(),
      maDemande: useMySentJoinRequest(),
    }), { wrapper });

    expect(result.current.invitations.data).toEqual([]);
    expect(result.current.maDemande.data).toBeNull();
    expect(result.current.inbox.isLoading).toBe(true);
  });
});
