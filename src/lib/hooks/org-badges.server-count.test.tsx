// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// La pastille d'entreprise compte SANS lire la liste des taches (C-05)
//
// POURQUOI CE FICHIER EXISTE
//
// `Layout` monte `useOrgBadges` sur TOUTES les pages protegees, pour tout
// membre d'une organisation. Le hook n'affiche aucune liste : il en derive un
// nombre. Il montait pourtant `useTeamTasks`, donc `get_my_team_tasks` suivi
// d'un `.limit(1000)` — la lecture la plus chere du produit
// (`SCALABILITY.md` §2). Le rechargement en avait ete coupe le 2026-08-27
// (`background`), la LECTURE pas.
//
// Deux choses sont verifiees ici, et il faut les DEUX :
//
//   1. hors demo, le repository des taches d'equipe n'est JAMAIS appele ;
//   2. le nombre affiche est le MEME qu'avant. Le premier test seul serait
//      satisfait par une pastille qui affiche zero.
//
// ⚠️ TEMOIN. Le troisieme cas sabote la source serveur (aucune ligne
// `assigned`) et exige que le compteur TOMBE. Sans lui, ce fichier passerait
// encore si les deux sources cessaient d'alimenter quoi que ce soit — c'est
// exactement la classe de garde « verte sans rien mesurer » recensee dans
// CLAUDE.md (§ une garde se verifie sur ce qu'elle REGARDE).
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const ORG = 'org-a';
const ME = 'me';
const LAST_SEEN = Date.parse('2026-08-01T00:00:00.000Z');

const orgRepo = { getMyOrgInbox: vi.fn() };
const teamRepo = { getTasks: vi.fn() };

vi.mock('@/lib/repository.factory', () => ({
  getOrganizationsRepository: () => orgRepo,
  getTeamProjectsRepository: () => teamRepo,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('@/modules/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: ME, name: 'Moi', email: 'moi@cosmo.app' } }),
}));
vi.mock('@/modules/organizations/ActiveOrgContext', () => ({
  useActiveOrganization: () => ({ activeOrg: { id: ORG, name: 'Alpha', myRole: 'member' } }),
}));

const isDemo = vi.fn(() => false);
vi.mock('@/lib/app-mode.store', () => ({
  useIsDemo: () => isDemo(),
  appModeStore: { get isDemo() { return isDemo(); }, setDemo: vi.fn() },
}));

import { useOrgBadges } from './use-org-notifications';

/** Deux assignations recentes qui ne viennent pas de moi, comme la mig. 142 les rend. */
const badgeTasks = [
  { orgId: ORG, id: 't1', name: 'Reprendre la maquette', createdAt: '2026-08-20T10:00:00.000Z', kind: 'assigned' as const },
  { orgId: ORG, id: 't2', name: 'Relire le contrat', createdAt: '2026-08-21T10:00:00.000Z', kind: 'assigned' as const },
];

const inbox = (over: Partial<Record<string, unknown>> = {}) => ({
  invitations: [],
  removalNotices: [],
  myJoinRequest: null,
  joinRequests: [],
  notifications: [],
  badgeTasks,
  ...over,
});

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  orgRepo.getMyOrgInbox.mockReset();
  teamRepo.getTasks.mockReset();
  teamRepo.getTasks.mockResolvedValue([]);
  isDemo.mockReturnValue(false);
  localStorage.clear();
  localStorage.setItem(`cosmo_org_last_seen_${ORG}`, String(LAST_SEEN));
});

describe('useOrgBadges — le compte vient du serveur (finding C-05)', () => {
  it('ne lit JAMAIS la liste des taches d equipe hors demo', async () => {
    orgRepo.getMyOrgInbox.mockResolvedValue(inbox());
    const { result } = renderHook(() => useOrgBadges(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.total).toBe(2));
    expect(orgRepo.getMyOrgInbox).toHaveBeenCalledTimes(1);
    expect(teamRepo.getTasks).not.toHaveBeenCalled();
  });

  it('affiche le MEME nombre, et le meme apercu, que la derivation d avant', async () => {
    orgRepo.getMyOrgInbox.mockResolvedValue(inbox());
    const { result } = renderHook(() => useOrgBadges(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.projects).toBe(2));
    expect(result.current.projectItems).toEqual([
      'Reprendre la maquette', 'Relire le contrat',
    ]);
  });

  it('TEMOIN — sans ligne `assigned`, le compteur tombe a zero', async () => {
    orgRepo.getMyOrgInbox.mockResolvedValue(inbox({ badgeTasks: [] }));
    const { result } = renderHook(() => useOrgBadges(), { wrapper: wrapper() });

    await waitFor(() => expect(orgRepo.getMyOrgInbox).toHaveBeenCalled());
    await waitFor(() => expect(result.current.projects).toBe(0));
  });

  it('ne compte pas DEUX fois une tache a la fois assignee et notifiee', async () => {
    // La RPC rend la meme tache dans les deux branches : `assigned` parce
    // qu'elle m'est assignee, `notified` parce qu'une notification la vise.
    // Elle ne doit compter qu'une fois — sinon le nombre affiche change, ce
    // que ce correctif s'interdit.
    orgRepo.getMyOrgInbox.mockResolvedValue(inbox({
      badgeTasks: [
        badgeTasks[0],
        { ...badgeTasks[0], kind: 'notified' as const },
      ],
    }));
    const { result } = renderHook(() => useOrgBadges(), { wrapper: wrapper() });

    await waitFor(() => expect(orgRepo.getMyOrgInbox).toHaveBeenCalled());
    await waitFor(() => expect(result.current.projects).toBe(1));
  });

  it('nomme l apercu quand les notifications serveur font autorite', async () => {
    // `serverWins` : le compteur vient des notifications non lues, et les
    // libelles des lignes `notified` de la mig. 142. Sans elles, la pastille
    // afficherait un nombre qu'aucune liste ne peut expliquer.
    orgRepo.getMyOrgInbox.mockResolvedValue(inbox({
      badgeTasks: [
        { orgId: ORG, id: 't9', name: 'Chiffrer le lot 3', createdAt: '2026-07-01T10:00:00.000Z', kind: 'notified' as const },
      ],
      notifications: [
        { id: 'x1', orgId: ORG, actorId: 'u1', kind: 'task_assigned', taskId: 't9', readAt: null, createdAt: '2026-08-22T10:00:00.000Z' },
      ],
    }));
    const { result } = renderHook(() => useOrgBadges(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.projects).toBe(1));
    expect(result.current.projectItems).toEqual(['Chiffrer le lot 3']);
  });

  it('en demo, la source reste locale — et elle est gratuite', async () => {
    isDemo.mockReturnValue(true);
    orgRepo.getMyOrgInbox.mockResolvedValue(inbox({ badgeTasks: [] }));
    teamRepo.getTasks.mockResolvedValue([
      {
        id: 'd1', orgId: ORG, projectId: 'p1', name: 'Tache de demo', priority: 3,
        assigneeIds: [ME], createdBy: 'quelqu-un', completed: false, status: 'todo',
        createdAt: '2026-08-20T10:00:00.000Z', updatedAt: '2026-08-20T10:00:00.000Z',
      },
    ]);
    const { result } = renderHook(() => useOrgBadges(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.projects).toBe(1));
    expect(result.current.projectItems).toEqual(['Tache de demo']);
    expect(teamRepo.getTasks).toHaveBeenCalled();
  });
});
