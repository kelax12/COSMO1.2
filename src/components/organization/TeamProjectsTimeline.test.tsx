// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Planning (vue chronologique) des projets d'entreprise (TST-02, B3)
//
// Le vrai composant, alimenté par les projets et tâches de « Nova Studio »
// (vrai dépôt de démo) : lignes par projet ou par personne, jalons, tâches sans
// date, zoom, état vide, mode sélection.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, within, fireEvent } from '@testing-library/react';
import {
  renderApp, setViewport, resetOrgWorld, warmDemoCaches, demoMembers, lazyT,
  session, fakeAuth, ORG_ID,
} from '@/test/org-ui-harness';
import { getTeamProjectsRepository } from '@/lib/repository.factory';
import type { OrgMember } from '@/modules/organizations';
import type { TeamProject, TeamTask } from '@/modules/team-projects';

vi.mock('@/modules/auth/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/auth/AuthContext')>()),
  useAuth: () => ({
    ...fakeAuth(),
    user: { id: session.userId, name: session.userId, email: `${session.userId}@cosmo.app` },
  }),
}));

import TeamProjectsTimeline from './TeamProjectsTimeline';

const pf = lazyT('portfolio');

let members: OrgMember[] = [];
let projects: TeamProject[] = [];
let tasks: TeamTask[] = [];

beforeAll(async () => {
  await warmDemoCaches();
});

beforeEach(async () => {
  resetOrgWorld();
  setViewport('desktop');
  members = await demoMembers();
  const repo = getTeamProjectsRepository();
  projects = (await repo.getProjects(ORG_ID)).filter((p) => !p.archivedAt);
  tasks = await repo.getTasks(ORG_ID);
});

const isoIn = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const renderTimeline = (over: Partial<React.ComponentProps<typeof TeamProjectsTimeline>> = {}) => {
  const props = {
    projects, tasks, members, groupBy: 'project' as const, onOpenTask: vi.fn(), ...over,
  };
  renderApp(<TeamProjectsTimeline {...props} />, { route: '/entreprise/projects' });
  return props;
};

/** Une tâche ouverte, rattachée au premier projet, échéance proche et assignée à `assignee`. */
const dated = (id: string, name: string, offset: number | null, assignee?: string): TeamTask => ({
  ...tasks[0]!,
  id, name, projectId: projects[0]!.id, completed: false,
  deadline: offset === null ? undefined : isoIn(offset),
  assigneeIds: assignee ? [assignee] : [],
});

describe('TeamProjectsTimeline, états', () => {
  it('dit qu’il n’y a aucune échéance quand rien n’est à afficher', () => {
    renderTimeline({ projects: [], tasks: [] });

    expect(screen.getByText(pf.t('timeline.empty'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: pf.t('timeline.zoomMonth') })).toBeNull();
  });

  it('montre une ligne par projet avec son nom', () => {
    renderTimeline({ tasks: [dated('a', 'Livrable A', 5)] });

    expect(screen.getByText(projects[0]!.name)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Livrable A, échéance le/ })).toBeTruthy();
  });
});

describe('TeamProjectsTimeline, interactions', () => {
  it('ouvre la tâche au clic sur son jalon', () => {
    const props = renderTimeline({ tasks: [dated('a', 'Livrable A', 5)] });

    fireEvent.click(screen.getByRole('button', { name: /Livrable A/ }));

    expect(props.onOpenTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });

  it('coche la tâche au lieu de l’ouvrir en mode sélection', () => {
    const onToggleSelect = vi.fn();
    const props = renderTimeline({ tasks: [dated('a', 'Livrable A', 5)], selectable: true, selectedIds: new Set(), onToggleSelect });

    fireEvent.click(screen.getByRole('button', { name: /Livrable A/ }));

    expect(onToggleSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    expect(props.onOpenTask).not.toHaveBeenCalled();
  });

  it('range les tâches sans date dans une pastille qui les ouvre', () => {
    const props = renderTimeline({ tasks: [dated('u', 'Sans échéance X', null)] });

    fireEvent.click(screen.getByRole('button', { name: pf.t('timeline.unscheduledAria', { count: 1 }) }));
    const list = screen.getByText(pf.t('timeline.unscheduledTitle')).closest('div') as HTMLElement;
    fireEvent.click(within(list.parentElement as HTMLElement).getByText('Sans échéance X'));

    expect(props.onOpenTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'u' }));
  });

  it('marque le zoom choisi (aucun par défaut)', () => {
    renderTimeline({ tasks: [dated('a', 'Livrable A', 5)] });
    const month = screen.getByRole('button', { name: pf.t('timeline.zoomMonth') });
    expect(month.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(month);
    expect(month.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: pf.t('timeline.zoomAll') }));
    expect(screen.getByRole('button', { name: pf.t('timeline.zoomAll') }).getAttribute('aria-pressed')).toBe('true');
    expect(month.getAttribute('aria-pressed')).toBe('false');
  });

  it('ouvre la page du projet au clic sur son nom', () => {
    const onOpenProject = vi.fn();
    renderTimeline({ tasks: [dated('a', 'Livrable A', 5)], onOpenProject });

    fireEvent.click(screen.getByText(projects[0]!.name));

    expect(onOpenProject).toHaveBeenCalledWith(projects[0]!.id);
  });
});

describe('TeamProjectsTimeline, lignes par personne', () => {
  it('regroupe par assigné, la personne la plus chargée en premier, et les non assignées à part', () => {
    const [a, b] = members.filter((m) => m.userId !== session.userId);
    renderTimeline({
      groupBy: 'assignee',
      tasks: [
        dated('1', 'T1', 3, a!.userId), dated('2', 'T2', 4, b!.userId), dated('3', 'T3', 6, b!.userId),
        dated('4', 'T4', 7),
      ],
    });

    expect(screen.getByText(a!.displayName)).toBeTruthy();
    expect(screen.getByText(b!.displayName)).toBeTruthy();
    expect(screen.getByText(pf.t('kanban.unassigned'))).toBeTruthy();
    const labels = [a!.displayName, b!.displayName].map((n) => screen.getByText(n));
    // b porte deux jalons contre un : il précède a dans le DOM.
    expect(labels[1]!.compareDocumentPosition(labels[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
