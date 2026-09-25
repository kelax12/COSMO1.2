// @vitest-environment jsdom
// Assistant de démarrage : chaque étape crée AU MOMENT où elle est validée,
// et se passe. Hooks interceptés, composant réel.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

const inviteMutate = vi.fn();
const teamMutate = vi.fn();
const projectMutate = vi.fn();

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

import OrgSetupWizard from './OrgSetupWizard';
import type { OrgSetupScreen } from './org-setup.helpers';

const Harness = ({ onFinish = () => {} }: { onFinish?: () => void }) => {
  const [screenId, setScreen] = useState<OrgSetupScreen>('invite');
  return (
    <OrgSetupWizard
      orgId="org-1"
      orgName="Acme"
      currentUserId="u-1"
      screen={screenId}
      onScreen={setScreen}
      onFinish={onFinish}
    />
  );
};

const renderWizard = (onFinish?: () => void) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness onFinish={onFinish} />
    </QueryClientProvider>,
  );

describe('OrgSetupWizard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invite par e-mail, crée l équipe, puis un projet depuis un modèle rattaché à cette équipe', async () => {
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
    const onFinish = vi.fn();
    renderWizard(onFinish);

    fireEvent.change(screen.getByLabelText(/adresses e-mail/i), { target: { value: 'A@acme.fr, b@acme.fr ; a@acme.fr' } });
    fireEvent.click(screen.getByRole('button', { name: /envoyer les 2 invitations/i }));
    expect(inviteMutate).toHaveBeenCalledWith(
      { emails: ['a@acme.fr', 'b@acme.fr'], managerId: null, teamIds: [], accessDays: null },
      expect.anything(),
    );
    expect(screen.getByRole('status').textContent).toMatch(/1 invitation envoyée/);
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }));

    fireEvent.change(screen.getByLabelText(/première équipe/i), { target: { value: 'Marketing' } });
    fireEvent.click(screen.getByRole('button', { name: /créer l'équipe/i }));
    expect(teamMutate).toHaveBeenCalledWith({ name: 'Marketing' }, expect.anything());

    fireEvent.click(screen.getByRole('radio', { name: /sprint/i }));
    fireEvent.click(screen.getByRole('button', { name: /créer le projet/i }));
    const [{ input, tasks }] = projectMutate.mock.calls[0];
    expect(input).toMatchObject({ name: 'Sprint', teamId: 'team-9', ownerId: 'u-1' });
    expect(tasks.length).toBe(4);
    expect(tasks.every((task: { deadline?: string }) => /^\d{4}-\d{2}-\d{2}$/.test(task.deadline ?? ''))).toBe(true);

    await waitFor(() => expect(screen.getByText(/acme est prête/i)).toBeTruthy());
    expect(screen.getByText(/équipe « marketing » créée/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /ouvrir l'espace entreprise/i }));
    expect(onFinish).toHaveBeenCalled();
  });

  it('chaque étape se passe sans rien créer', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /passer/i }));
    fireEvent.click(screen.getByRole('button', { name: /passer/i }));
    fireEvent.click(screen.getByRole('button', { name: /passer/i }));
    expect(screen.getByText(/acme est prête/i)).toBeTruthy();
    expect(inviteMutate).not.toHaveBeenCalled();
    expect(teamMutate).not.toHaveBeenCalled();
    expect(projectMutate).not.toHaveBeenCalled();
  });

  it('annonce l étape en cours sur le fil d étapes', () => {
    renderWizard();
    const current = screen.getAllByRole('listitem').find((li) => li.getAttribute('aria-current') === 'step');
    expect(current?.textContent).toMatch(/invitations/i);
  });
});
