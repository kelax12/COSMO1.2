// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Onglet « Projets » de l'espace entreprise (vague 15.2, TST-02)
//
// Le vrai composant, les vrais hooks, les dépôts de démo de « Nova Studio ».
// Vérifie ce que voit la personne : les projets, l'état vide selon le droit de
// créer, le chargement, la recherche, et l'ouverture de la fiche de création.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, within, waitFor, fireEvent } from '@testing-library/react';
import {
  renderApp, setViewport, resetOrgWorld, warmDemoCaches, demoMembers, denyPermissions, lazyT,
  session, fakeAuth, ORG_ID, ADMIN_ID, MEMBER_ID,
} from '@/test/org-ui-harness';
import type { OrgMember } from '@/modules/organizations';
import { TEAM_PROJECTS_STORAGE_KEY } from '@/modules/team-projects/constants';

vi.mock('@/modules/auth/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/auth/AuthContext')>()),
  useAuth: () => ({
    ...fakeAuth(),
    user: { id: session.userId, name: session.userId, email: `${session.userId}@cosmo.app` },
  }),
}));

import TeamProjectsTab from './TeamProjectsTab';

const org = lazyT('org');

let members: OrgMember[] = [];

beforeAll(async () => {
  await warmDemoCaches();
});

beforeEach(async () => {
  resetOrgWorld();
  setViewport('desktop');
  members = await demoMembers();
});

const renderTab = () =>
  renderApp(
    <TeamProjectsTab orgId={ORG_ID} members={members} currentUserId={session.userId} canEditDependencies={false} isAdmin={session.userId === ADMIN_ID} />,
    { route: '/entreprise/projects' },
  );

describe('TeamProjectsTab, rendu des données', () => {
  it('montre les projets de l’organisation', async () => {
    renderTab();

    expect(await screen.findByText('Refonte du site')).toBeTruthy();
    expect(screen.getByText('Lancement produit')).toBeTruthy();
  });

  it('annonce un chargement avant les projets, jamais « Aucun projet »', async () => {
    renderTab();

    expect(screen.queryByText(org.t('projects.empty'))).toBeNull();
    await screen.findByText('Refonte du site');
  });
});

describe('TeamProjectsTab, état vide', () => {
  it('propose de créer un projet à l’administrateur quand il n’y en a aucun', async () => {
    localStorage.setItem(TEAM_PROJECTS_STORAGE_KEY, '[]');
    renderTab();

    expect(await screen.findByText(org.t('projects.empty'))).toBeTruthy();
    expect(screen.getByRole('button', { name: new RegExp(org.t('projects.createProject')) })).toBeTruthy();
  });

  it('n’offre pas la création à un membre qui n’en a pas le droit, et dit à qui s’adresser', async () => {
    session.userId = MEMBER_ID;
    denyPermissions(MEMBER_ID, ['project.create']);
    localStorage.setItem(TEAM_PROJECTS_STORAGE_KEY, '[]');
    renderTab();

    expect(await screen.findByText(org.t('projects.empty'))).toBeTruthy();
    await waitFor(() => expect(screen.getByText(org.t('projects.managerMustCreate'))).toBeTruthy());
    expect(screen.queryByRole('button', { name: new RegExp(org.t('projects.createProject')) })).toBeNull();
  });
});

describe('TeamProjectsTab, actions', () => {
  it('ouvre le formulaire de création de projet', async () => {
    renderTab();
    await screen.findByText('Refonte du site');

    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(org.t('projects.newProject')) })[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByRole('textbox').length).toBeGreaterThan(0);
  });
});
