// @vitest-environment jsdom
//
// Accueil entreprise : chaque étape crée AU MOMENT où elle est validée, et se
// passe. Hooks interceptés, page réelle, routeur réel (l'étape vit dans
// l'URL). Ordre depuis le 2026-10-05 : équipe, invitations, projet, cap.
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
let sentRequest: { id: string; requestedAt?: string } | null = null;
let realTeams: { id: string; name: string }[] = [];
let realInvites: { email: string; claimedAt: string | null }[] = [];
let realProjects: { name: string; archivedAt?: string | null }[] = [];
let realOkrs: { title: string }[] = [];

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
  useEmailInvitations: () => ({ data: realInvites }),
}));
vi.mock('@/modules/org-teams', () => ({
  useCreateOrgTeam: () => ({ mutate: teamMutate, isPending: false }),
  useOrgTeams: () => ({ data: realTeams }),
}));
vi.mock('@/modules/team-projects', () => ({
  useCreateTeamProjectWithTasks: () => ({ mutate: projectMutate, isPending: false }),
  useTeamProjects: () => ({ data: realProjects }),
}));
vi.mock('@/modules/team-okrs', () => ({
  useCreateTeamOKR: () => ({ mutate: okrMutate, isPending: false }),
  useTeamOKRs: () => ({ data: realOkrs }),
}));

import EnterpriseOnboarding from './EnterpriseOnboarding';
import { readMemberWelcomeSeen } from './ent-onboarding';
import { BUSINESS_PENDING_FLAG } from '../first-run';

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
    realTeams = [];
    realInvites = [];
    realProjects = [];
    realOkrs = [];
  });

  it('crée l équipe, y invite sous moi, lance un projet rattaché, fixe le cap, et ouvre l espace', async () => {
    teamMutate.mockImplementation((_input, opts) => opts.onSuccess({ id: 'team-9' }));
    inviteMutate.mockImplementation((_input, opts) =>
      opts.onSuccess({
        results: [
          { email: 'a@acme.fr', token: 't1', status: 'created' },
          { email: 'b@acme.fr', token: null, status: 'already_member' },
        ],
        sending: { sent: 1, failed: 0 },
      }),
    );
    projectMutate.mockImplementation((_input, opts) => opts.onSuccess('p-1'));
    okrMutate.mockImplementation((_input, opts) => opts.onSuccess({ id: 'okr-1' }));
    renderAt('/entreprise/onboarding?setup=org-1');

    // ── Équipe, d'abord ──
    await type(/première équipe/i, 'Marketing');
    click(/créer l'équipe/i);
    expect(teamMutate).toHaveBeenCalledWith({ name: 'Marketing' }, expect.anything());

    // ── Invitations : rattachées à l'équipe, placées sous moi ──
    await type(/adresses e-mail/i, 'A@acme.fr, b@acme.fr ; a@acme.fr');
    expect(screen.getByLabelText(/ajouter à l'équipe « marketing »/i)).toBeTruthy();
    click(/envoyer les 2 invitations/i);
    expect(inviteMutate).toHaveBeenCalledWith(
      { emails: ['a@acme.fr', 'b@acme.fr'], managerId: 'u-1', teamIds: ['team-9'], accessDays: null },
      expect.anything(),
    );
    expect(screen.getByRole('status').textContent).toMatch(/1 invitation envoyée/);
    click(/^continuer/i);

    // ── Projet : le modèle choisi montre ses tâches ──
    fireEvent.click(await screen.findByRole('radio', { name: /sprint/i }));
    click(/créer le projet/i);
    const [{ input, tasks }] = projectMutate.mock.calls[0];
    expect(input).toMatchObject({ name: 'Sprint', teamId: 'team-9', ownerId: 'u-1' });
    expect(tasks.length).toBe(4);
    expect(tasks.every((task: { deadline?: string }) => /^\d{4}-\d{2}-\d{2}$/.test(task.deadline ?? ''))).toBe(true);

    // ── Cap : le résultat clé manquant est EXPLIQUÉ ──
    await type(/objectif de l'entreprise/i, 'Devenir la référence');
    expect(screen.getByRole('button', { name: /fixer le cap/i }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/rend l'objectif mesurable/i)).toBeTruthy();
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
    expect(await screen.findByText('1 personne invitée')).toBeTruthy();
    expect(screen.getByText(/équipe « marketing » créée/i)).toBeTruthy();
    expect(screen.getByText(/projet « sprint » lancé/i)).toBeTruthy();
    expect(screen.getByText(/cap fixé : « devenir la référence »/i)).toBeTruthy();
    click(/ouvrir l'espace entreprise/i);
    expect(setActiveOrgId).toHaveBeenCalledWith('org-1');
    expect(readMemberWelcomeSeen('org-1', 'u-1')).toBe(true);
    expect(await screen.findByText('espace entreprise')).toBeTruthy();
  });

  it('les rattachements de l invitation se décochent', async () => {
    realTeams = [{ id: 'team-1', name: 'Produit' }];
    renderAt('/entreprise/onboarding?setup=org-1&step=invite');
    await type(/adresses e-mail/i, 'a@acme.fr');
    fireEvent.click(screen.getByLabelText(/ajouter à l'équipe « produit »/i));
    fireEvent.click(screen.getByLabelText(/sous moi/i));
    click(/envoyer l'invitation/i);
    expect(inviteMutate.mock.calls[0][0]).toMatchObject({ managerId: null, teamIds: [] });
  });

  it('chaque étape se passe sans rien créer', async () => {
    renderAt('/entreprise/onboarding?setup=org-1');
    await screen.findByLabelText(/première équipe/i);
    click(/passer cette étape/i);
    await screen.findByLabelText(/adresses e-mail/i);
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
    renderAt('/entreprise/onboarding?setup=org-1&step=invite');
    await screen.findByLabelText(/adresses e-mail/i);
    const current = screen.getAllByRole('listitem').find((li) => li.getAttribute('aria-current') === 'step');
    expect(current?.textContent).toMatch(/invitations/i);
  });

  it('montre le code de l entreprise à côté des invitations', async () => {
    renderAt('/entreprise/onboarding?setup=org-1&step=invite');
    expect(await screen.findByText('COSMO-ABCDEFGHIJ')).toBeTruthy();
  });

  it('un ?setup= qui ne désigne pas une entreprise que j administre retombe sur le choix', async () => {
    organizations = [{ id: 'org-1', name: 'Acme', myRole: 'member' }];
    renderAt('/entreprise/onboarding?setup=org-1');
    expect(await screen.findByRole('button', { name: /créer une entreprise/i })).toBeTruthy();
    expect(screen.queryByLabelText(/première équipe/i)).toBeNull();
  });

  it('crée l entreprise avec le nom saisi, et oublie le rappel « entreprise en attente »', async () => {
    organizations = [];
    localStorage.setItem(BUSINESS_PENDING_FLAG, '1');
    createOrgMutate.mockImplementation((_name, opts) => opts.onSuccess({ id: 'org-new' }));
    renderAt('/entreprise/onboarding');
    click(/créer une entreprise/i);
    await type(/nom de l'entreprise/i, '  Nova Studio ');
    click(/créer l'entreprise/i);
    expect(createOrgMutate.mock.calls[0][0]).toBe('Nova Studio');
    expect(localStorage.getItem(BUSINESS_PENDING_FLAG)).toBeNull();
  });

  it('une création ouvre la mise en place de la nouvelle entreprise', async () => {
    organizations = [];
    createOrgMutate.mockImplementation((_name, opts) => {
      organizations = [{ id: 'org-new', name: 'Nova Studio', myRole: 'admin' }];
      opts.onSuccess({ id: 'org-new', name: 'Nova Studio' });
    });
    renderAt('/entreprise/onboarding');
    click(/créer une entreprise/i);
    await type(/nom de l'entreprise/i, 'Nova Studio');
    click(/créer l'entreprise/i);
    expect(await screen.findByLabelText(/première équipe/i)).toBeTruthy();
  });

  it('« Plus tard » sans entreprise laisse un rappel pour l accueil perso', async () => {
    organizations = [];
    renderAt('/entreprise/onboarding');
    click(/plus tard/i);
    expect(await screen.findByText('espace perso')).toBeTruthy();
    expect(localStorage.getItem(BUSINESS_PENDING_FLAG)).toBe('1');
  });

  it('rejoindre exige le consentement avant d envoyer la demande', async () => {
    organizations = [];
    renderAt('/entreprise/onboarding');
    localStorage.setItem(BUSINESS_PENDING_FLAG, '1');
    joinMutate.mockImplementation((_code, opts) => opts.onSuccess());
    click(/rejoindre une entreprise/i);
    await type(/code d'invitation/i, 'cosmo-abcdefghij');
    const send = screen.getByRole('button', { name: /envoyer la demande/i });
    expect(send.hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    click(/envoyer la demande/i);
    expect(joinMutate.mock.calls[0][0]).toBe('COSMO-ABCDEFGHIJ');
    expect(localStorage.getItem(BUSINESS_PENDING_FLAG)).toBeNull();
  });

  it('une demande en attente s affiche, et « Plus tard » ne laisse pas de rappel', async () => {
    organizations = [];
    sentRequest = { id: 'jr-1' };
    renderAt('/entreprise/onboarding');
    expect(await screen.findByRole('button', { name: /annuler ma demande/i })).toBeTruthy();
    expect(screen.getByText(/en attente de validation/i)).toBeTruthy();
    click(/plus tard/i);
    expect(await screen.findByText('espace perso')).toBeTruthy();
    expect(localStorage.getItem(BUSINESS_PENDING_FLAG)).toBeNull();
  });

  it('après un rechargement, la scène se redessine à partir des vraies données', async () => {
    realTeams = [{ id: 'team-1', name: 'Produit' }];
    realInvites = [{ email: 'lea@acme.fr', claimedAt: null }];
    realOkrs = [{ title: 'Doubler le chiffre' }];
    const { container } = renderAt('/entreprise/onboarding?setup=org-1&step=project');
    await screen.findByRole('radio', { name: /sprint/i });
    const svgText = Array.from(container.querySelectorAll('svg text')).map((n) => n.textContent ?? '');
    expect(svgText.some((x) => x.includes('PRODUIT'))).toBe(true);
    expect(svgText).toContain('L');
    expect(svgText.some((x) => x.includes('Doubler le chiffre'))).toBe(true);
  });
});
