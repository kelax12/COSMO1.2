// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Onglet « Tâches » de l'espace entreprise (vague 15.2, TST-02)
//
// Le vrai composant, les vrais hooks React Query, les vrais dépôts de démo
// (`localStorage`, « Nova Studio ») : seule la session est simulée. Ce que
// vérifie ce fichier est ce que voit la personne : la liste, les états vide et
// de chargement, la recherche, le coche, la fiche et les droits.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, within, waitFor, fireEvent } from '@testing-library/react';
import {
  renderApp, setViewport, resetOrgWorld, warmDemoCaches, demoMembers, denyPermissions, lazyT,
  session, fakeAuth, ORG_ID, ADMIN_ID, MEMBER_ID,
} from '@/test/org-ui-harness';
import type { OrgMember } from '@/modules/organizations';
import { TEAM_PROJECTS_STORAGE_KEY, TEAM_TASKS_STORAGE_KEY } from '@/modules/team-projects/constants';
import type { TeamTask } from '@/modules/team-projects';

vi.mock('@/modules/auth/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/auth/AuthContext')>()),
  useAuth: () => ({
    ...fakeAuth(),
    user: { id: session.userId, name: session.userId, email: `${session.userId}@cosmo.app` },
  }),
}));

import TeamTasksTab from './TeamTasksTab';

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
    <TeamTasksTab orgId={ORG_ID} members={members} currentUserId={session.userId} canEditDependencies={false} isAdmin={session.userId === ADMIN_ID} />,
    { route: '/entreprise/tasks' },
  );

/** Les tâches telles que le dépôt de démonstration les a écrites. */
const storedTeamTasks = () => JSON.parse(localStorage.getItem(TEAM_TASKS_STORAGE_KEY) ?? '[]') as TeamTask[];

const search = (value: string) =>
  fireEvent.change(screen.getByRole('searchbox', { name: org.t('projects.tasksTabSearchAria') }), { target: { value } });

describe('TeamTasksTab, rendu des données', () => {
  it('montre les tâches ouvertes de l’organisation et cache les terminées par défaut', async () => {
    renderTab();

    expect(await screen.findByText("Maquettes de la page d'accueil")).toBeTruthy();
    expect(screen.getByText('Intégration du header responsive')).toBeTruthy();
    // Filtre par défaut « ouvertes » : une tâche terminée n'y figure pas.
    expect(screen.queryByText('Charte graphique validée')).toBeNull();
  });

  it('annonce un chargement avant les premières données, jamais « aucun projet »', async () => {
    renderTab();

    expect(screen.getByRole('status', { name: org.t('projects.tasksTabLoading') })).toBeTruthy();
    expect(screen.queryByText(org.t('projects.tasksTabNoProject'))).toBeNull();
    await screen.findByText('Kit presse');
    expect(screen.queryByRole('status', { name: org.t('projects.tasksTabLoading') })).toBeNull();
  });

  it('dit qu’il n’y a aucun projet quand l’organisation n’en a pas', async () => {
    localStorage.setItem(TEAM_PROJECTS_STORAGE_KEY, '[]');
    renderTab();

    expect(await screen.findByText(org.t('projects.tasksTabNoProject'))).toBeTruthy();
  });

  it('dit qu’aucune tâche ne correspond quand la recherche ne trouve rien', async () => {
    renderTab();
    await screen.findByText('Kit presse');

    search('zzzzintrouvable');

    expect(await screen.findByText(org.t('projects.tasksTabEmpty'))).toBeTruthy();
    expect(screen.queryByText('Kit presse')).toBeNull();
  });
});

describe('TeamTasksTab, recherche et filtres', () => {
  it('filtre la liste sur le nom, sans accents ni casse', async () => {
    renderTab();
    await screen.findByText('Kit presse');

    search('INTEGRATION');

    await waitFor(() => expect(screen.queryByText('Kit presse')).toBeNull());
    expect(screen.getByText('Intégration du header responsive')).toBeTruthy();
  });

  it('annonce le nombre de tâches affichées dès qu’un filtre est actif', async () => {
    renderTab();
    await screen.findByText('Kit presse');

    search('kit');

    // Le total est le nombre de tâches CHARGÉES (ouvertes et terminées récemment), pas
    // celui du dépôt : on vérifie la forme « 1 tâche affichée sur N », N étant lu à l'écran.
    const shown = await screen.findByText(/^1 tâche affichée sur \d+$/);
    expect(Number(shown.textContent!.match(/(\d+)$/)![1])).toBeGreaterThanOrEqual(storedTeamTasks().filter((t) => !t.completed).length);
  });
});

describe('TeamTasksTab, actions sur une tâche', () => {
  it('coche une tâche : elle est écrite terminée dans le dépôt', async () => {
    renderTab();
    await screen.findByText('Kit presse');

    const row = screen.getByText('Kit presse').closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('checkbox', { name: org.t('projects.markComplete') }));

    await waitFor(() => expect(storedTeamTasks().find((t) => t.name === 'Kit presse')?.completed).toBe(true));
  });

  it('ouvre la fiche d’une tâche au clic sur son nom', async () => {
    renderTab();
    await screen.findByText('Kit presse');

    fireEvent.click(screen.getByText('Kit presse'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByDisplayValue('Kit presse').length).toBeGreaterThan(0);
  });

  it('ouvre la fiche de création au clic sur « Nouvelle tâche »', async () => {
    renderTab();
    await screen.findByText('Kit presse');

    fireEvent.click(screen.getByRole('button', { name: org.t('projects.tasksTabNewTask') }));

    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});

describe('TeamTasksTab, droits en mode entreprise', () => {
  it('grise « Nouvelle tâche » et dit pourquoi pour un membre sans le droit de créer', async () => {
    session.userId = MEMBER_ID;
    denyPermissions(MEMBER_ID, ['task.create']);
    renderTab();
    await screen.findByText('Kit presse');

    // Une fois les droits chargés le bouton est ré-monté DANS l'enveloppe qui porte la raison :
    // on le relit, l'ancien nœud est détaché.
    const explanation = await screen.findByRole('note');
    expect(explanation.getAttribute('aria-label') ?? '').toMatch(/\S/);
    const button = screen.getByRole('button', { name: org.t('projects.tasksTabNewTask') }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.click(button);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('laisse « Nouvelle tâche » active à l’administrateur', async () => {
    renderTab();
    await screen.findByText('Kit presse');

    expect((screen.getByRole('button', { name: org.t('projects.tasksTabNewTask') }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('note')).toBeNull();
  });
});
