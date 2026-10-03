// @vitest-environment jsdom
//
// Accueil entreprise : chaque étape crée AU MOMENT où elle est validée, et se
// passe. Hooks interceptés, page réelle, routeur réel (l'étape vit dans
// l'URL). Reprend et prolonge l'ancien `OrgSetupWizard.test.tsx` (retiré le
// 2026-10-03 avec le composant qu'il testait), plus l'étape « Cap ».
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { MotionGlobalConfig } from 'framer-motion';

const inviteMutate = vi.fn();
const teamMutate = vi.fn();
const projectMutate = vi.fn();
const okrMutate = vi.fn();
const createOrgMutate = vi.fn();
const joinMutate = vi.fn();
const setActiveOrgId = vi.fn();
let organizations: { id: string; name: string; myRole: string; joinCode?: string }[] = [];
let sentRequest: { id: string } | null = null;

vi.mock('@/modules/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', name: 'Axel Martin', email: 'a@x.fr' } }),
}));
vi.mock('@/modules/organizations', () => ({
  useActiveOrganization: () => ({ activeOrg: undefined, organizations, isLoading: false, setActiveOrgId }),
  useCreateOrganization: () => ({ mutate: createOrgMutate, isPending: false }),
  useRequestJoinOrganization: () => ({ mutate: joinMutate, isPending: false }),
  useCancelJoinRequest: () => ({ mutate: vi.fn(), isPending: false }),
  useMySentJoinRequest: () => ({ data: sentRequest }),
}));
vi.mock('@/modules/organizations/governance.hooks', () => ({
  useInviteByEmail: () => ({ mutate: inviteMutate, isPending: false }),
}));
vi.mock('@/modules/org-teams', () => ({
  useCreateOrgTeam: () => ({ mutate: teamMutate, isPending: false }),
  useOrgTeams: () => ({ data: [] }),
}));
vi.mock('@/modules/team-projects', () => ({
  useCreateTeamProjectWithTasks: () => ({ mutate: projectMutate, isPending: false }),
}));
vi.mock('@/modules/team-okrs', () => ({
  useCreateTeamOKR: () => ({ mutate: okrMutate, isPending: false }),
}));

import EnterpriseOnboarding from './EnterpriseOnboarding';
import { readMemberWelcomeSeen } from './ent-onboarding';

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/entreprise/onboarding" element={<EnterpriseOnboarding />} />
        <Route path="/entreprise" element={<p>espace entreprise</p>} />
        <Route path="/dashboard" element={<p>espace perso</p>} />
      </Routes>
    </MemoryRouter>,
  );

const click = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const type = async (label: RegExp, value: string) =>
  fireEvent.change(await screen.findByLabelText(label), { target: { value } });

describe('EnterpriseOnboarding', () => {
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    organizations = [{ id: 'org-1', name: 'Acme', myRole: 'admin', joinCode: 'COSMO-ABCDEFGHIJ' }];
    sentRequest = null;
  });

  it('invite, crée l équipe, un projet rattaché à elle, puis le cap, et ouvre l espace', async () => {
    inviteMutate.mockImplementation((_input, opts) =>
      opts.onSuccess({
        results: [
          { email: 'a@acme.fr', token: 't1', status: 'created' },
          { email: 'b@acme.fr', token: null, status: 'already_member' },
        ],
        sending: { sent: 1, failed: 0 },
      }),
    );
    teamMutate.mockImplementation((_input, opts) => opts.onSuccess({ id: 'team-9' }));
    projectMutate.mockImplementation((_input, opts) => opts.onSuccess('p-1'));
    okrMutate.mockImplementation((_input, opts) => opts.onSuccess({ id: 'okr-1' }));
    renderAt('/entreprise/onboarding?setup=org-1');

    // ── Invitations ──
    await type(/adresses e-mail/i, 'A@acme.fr, b@acme.fr ; a@acme.fr');
    click(/envoyer les 2 invitations/i);
    expect(inviteMutate).toHaveBeenCalledWith(
      { emails: ['a@acme.fr', 'b@acme.fr'], managerId: null, teamIds: [], accessDays: null },
      expect.anything(),
    );
    expect(screen.getByRole('status').textContent).toMatch(/1 invitation envoyée/);
    click(/^continuer/i);

    // ── Équipe ──
    await type(/première équipe/i, 'Marketing');
    click(/créer l'équipe/i);
    expect(teamMutate).toHaveBeenCalledWith({ name: 'Marketing' }, expect.anything());

    // ── Projet ──
    fireEvent.click(await screen.findByRole('radio', { name: /sprint/i }));
    click(/créer le projet/i);
    const [{ input, tasks }] = projectMutate.mock.calls[0];
    expect(input).toMatchObject({ name: 'Sprint', teamId: 'team-9', ownerId: 'u-1' });
    expect(tasks.length).toBe(4);
    expect(tasks.every((task: { deadline?: string }) => /^\d{4}-\d{2}-\d{2}$/.test(task.deadline ?? ''))).toBe(true);

    // ── Cap ──
    await type(/objectif de l'entreprise/i, 'Devenir la référence');
    expect(screen.getByRole('button', { name: /fixer le cap/i }).hasAttribute('disabled')).toBe(true);
    await type(/^résultat clé/i, 'Signer des clients');
    await type(/cible/i, '20');
    click(/fixer le cap/i);
    expect(okrMutate.mock.calls[0][0]).toMatchObject({
      title: 'Devenir la référence',
      audience: 'org',
      teamIds: [],
      keyResults: [{ title: 'Signer des clients', targetValue: 20 }],
    });

    // ── Fin ──
    expect(await screen.findByText(/est/, { selector: 'h2' })).toBeTruthy();
    expect(screen.getByText('1 personne invitée')).toBeTruthy();
    expect(screen.getByText(/équipe « marketing » créée/i)).toBeTruthy();
    expect(screen.getByText(/projet « sprint » lancé/i)).toBeTruthy();
    expect(screen.getByText(/cap fixé : « devenir la référence »/i)).toBeTruthy();
    click(/ouvrir l'espace entreprise/i);
    expect(setActiveOrgId).toHaveBeenCalledWith('org-1');
    // Qui vient de tout mettre en place ne reçoit pas l'accueil membre.
    expect(readMemberWelcomeSeen('org-1', 'u-1')).toBe(true);
    expect(await screen.findByText('espace entreprise')).toBeTruthy();
  });

  it('chaque étape se passe sans rien créer', async () => {
    renderAt('/entreprise/onboarding?setup=org-1');
    await screen.findByLabelText(/adresses e-mail/i);
    click(/passer cette étape/i);
    await screen.findByLabelText(/première équipe/i);
    click(/passer cette étape/i);
    await screen.findByRole('radio', { name: /sprint/i });
    click(/passer cette étape/i);
    await screen.findByLabelText(/objectif de l'entreprise/i);
    click(/passer cette étape/i);
    expect(await screen.findByText(/rien de créé pour l'instant/i)).toBeTruthy();
    expect(inviteMutate).not.toHaveBeenCalled();
    expect(teamMutate).not.toHaveBeenCalled();
    expect(projectMutate).not.toHaveBeenCalled();
    expect(okrMutate).not.toHaveBeenCalled();
  });

  it('annonce l étape en cours sur le fil d étapes', async () => {
    renderAt('/entreprise/onboarding?setup=org-1&step=team');
    await screen.findByLabelText(/première équipe/i);
    const current = screen.getAllByRole('listitem').find((li) => li.getAttribute('aria-current') === 'step');
    expect(current?.textContent).toMatch(/équipe/i);
  });

  it('montre le code de l entreprise à côté des invitations', async () => {
    renderAt('/entreprise/onboarding?setup=org-1');
    expect(await screen.findByText('COSMO-ABCDEFGHIJ')).toBeTruthy();
  });

  it('un ?setup= qui ne désigne pas une entreprise que j administre retombe sur la bienvenue', async () => {
    organizations = [{ id: 'org-1', name: 'Acme', myRole: 'member' }];
    renderAt('/entreprise/onboarding?setup=org-1');
    expect(await screen.findByRole('button', { name: /créer mon entreprise/i })).toBeTruthy();
    expect(screen.queryByLabelText(/adresses e-mail/i)).toBeNull();
  });

  it('crée l entreprise avec le nom saisi', async () => {
    organizations = [];
    renderAt('/entreprise/onboarding');
    click(/créer mon entreprise/i);
    await type(/nom de l'entreprise/i, '  Nova Studio ');
    click(/créer l'entreprise/i);
    expect(createOrgMutate.mock.calls[0][0]).toBe('Nova Studio');
  });

  it('rejoindre exige le consentement avant d envoyer la demande', async () => {
    organizations = [];
    renderAt('/entreprise/onboarding');
    click(/rejoindre une entreprise/i);
    await type(/code d'entreprise/i, 'cosmo-abcdefghij');
    const send = screen.getByRole('button', { name: /envoyer la demande/i });
    expect(send.hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    click(/envoyer la demande/i);
    expect(joinMutate.mock.calls[0][0]).toBe('COSMO-ABCDEFGHIJ');
  });

  it('une demande en attente montre l attente et la visite des lieux', async () => {
    organizations = [];
    sentRequest = { id: 'jr-1' };
    renderAt('/entreprise/onboarding');
    expect(await screen.findByRole('button', { name: /annuler la demande/i })).toBeTruthy();
    expect(screen.getByRole('list', { name: /votre futur espace/i })).toBeTruthy();
  });
});
