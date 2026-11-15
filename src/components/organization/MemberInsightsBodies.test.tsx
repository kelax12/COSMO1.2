// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Onglets « Tâches » et « Contribution » de la fiche d'un membre (TST-02, B3)
//
// Les vrais corps, les vrais hooks, les dépôts de démo « Nova Studio » : états
// chargement, vide et données, filtres, droit d'édition du supérieur.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import {
  renderApp, setViewport, resetOrgWorld, warmDemoCaches, demoMembers, lazyT,
  session, fakeAuth, ORG_ID,
} from '@/test/org-ui-harness';
import { getTeamProjectsRepository } from '@/lib/repository.factory';
import type { OrgMember } from '@/modules/organizations';
import type { TeamTask } from '@/modules/team-projects';

vi.mock('@/modules/auth/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/auth/AuthContext')>()),
  useAuth: () => ({
    ...fakeAuth(),
    user: { id: session.userId, name: session.userId, email: `${session.userId}@cosmo.app` },
  }),
}));

import { MemberTasksBody, MemberContributionBody } from './MemberInsightsBodies';

const orgAdmin = lazyT('orgAdmin');
const org = lazyT('org');

let busy: OrgMember;
let idle: OrgMember;
let busyTasks: TeamTask[] = [];

beforeAll(async () => {
  await warmDemoCaches();
});

beforeEach(async () => {
  resetOrgWorld();
  setViewport('desktop');
  const members = await demoMembers();
  const tasks = await getTeamProjectsRepository().getTasks(ORG_ID);
  const count = (m: OrgMember) => tasks.filter((x) => x.assigneeIds.includes(m.userId) && !x.completed).length;
  busy = [...members].sort((a, b) => count(b) - count(a))[0]!;
  busyTasks = tasks.filter((x) => x.assigneeIds.includes(busy.userId));
  // Un membre qu'aucune tâche n'attend.
  idle = { ...members[0]!, userId: 'user-sans-tache', displayName: 'Personne Libre' };
});

const renderTasks = (member: OrgMember, canEdit = false) =>
  renderApp(<MemberTasksBody orgId={ORG_ID} member={member} canEdit={canEdit} />, { route: '/entreprise/members' });

describe('MemberTasksBody', () => {
  it('annonce le chargement puis liste les tâches ouvertes du membre', async () => {
    renderTasks(busy);

    expect(screen.getByText(orgAdmin.t('insights.loading'))).toBeTruthy();
    const open = busyTasks.find((x) => !x.completed)!;
    expect(await screen.findByText(open.name)).toBeTruthy();
    expect(screen.queryByText(orgAdmin.t('insights.loading'))).toBeNull();
  });

  it('dit qu’aucune tâche n’est assignée et propose d’en ajouter', async () => {
    renderTasks(idle);

    expect(await screen.findByText(orgAdmin.t('insights.noTeamTask'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: orgAdmin.t('insights.addTask') }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('bascule sur les tâches terminées avec la pastille correspondante', async () => {
    const done = busyTasks.filter((x) => x.completed);
    renderTasks(busy);
    await screen.findByText(busyTasks.find((x) => !x.completed)!.name);

    const chip = screen.getByRole('button', { name: orgAdmin.t('insights.completed', { count: done.length }) });
    fireEvent.click(chip);

    expect(chip.getAttribute('aria-pressed')).toBe('true');
    if (done.length > 0) expect(screen.getByText(done[0]!.name)).toBeTruthy();
    else expect(screen.getByText(orgAdmin.t('insights.noOpenTask'))).toBeTruthy();
  });

  it('n’offre pas la sélection multiple sans le droit d’édition, et l’offre à un supérieur', async () => {
    const { unmount } = renderTasks(busy, false);
    await screen.findByText(busyTasks.find((x) => !x.completed)!.name);
    expect(screen.queryByRole('button', { name: org.t('projects.selectMultiple') })).toBeNull();
    unmount();

    renderTasks(busy, true);
    expect(await screen.findByRole('button', { name: org.t('projects.selectMultiple') })).toBeTruthy();
  });

  it('ouvre la fiche d’une tâche en édition au clic sur sa ligne (supérieur)', async () => {
    renderTasks(busy, true);
    const open = busyTasks.find((x) => !x.completed)!;

    fireEvent.click(await screen.findByText(open.name));

    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
  });
});

describe('MemberContributionBody', () => {
  it('annonce le chargement puis affiche la contribution du membre', async () => {
    renderApp(<MemberContributionBody orgId={ORG_ID} member={busy} />, { route: '/entreprise/members' });

    expect(screen.getByText(orgAdmin.t('insights.loading'))).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(orgAdmin.t('insights.loading'))).toBeNull());
    expect(document.body.textContent).toMatch(/\d+\s*%/);
  });

  it('affiche zéro pour un membre sans tâche, sans diviser par zéro', async () => {
    renderApp(<MemberContributionBody orgId={ORG_ID} member={idle} />, { route: '/entreprise/members' });

    await waitFor(() => expect(screen.queryByText(orgAdmin.t('insights.loading'))).toBeNull());
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });
});
