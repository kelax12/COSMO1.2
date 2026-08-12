// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TeamTaskHistorySection from './TeamTaskHistorySection';
import type { OrgMember } from '@/modules/organizations';
import type { TeamProject, TeamTaskActivity } from '@/modules/team-projects';

// Le journal est la seule donnée mockée : on teste la couche de RENDU, qui doit
// traduire les valeurs brutes écrites par le trigger `log_team_task_activity`.
const entries: TeamTaskActivity[] = [];
vi.mock('@/modules/team-projects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/team-projects')>()),
  useTeamTaskActivity: () => ({ data: entries }),
}));

const member = (userId: string, displayName: string): OrgMember => ({
  orgId: 'org-1', userId, displayName, role: 'member', joinedAt: '2026-01-01T00:00:00Z',
});

const members = [member('user-axel', 'Axel'), member('user-lucas', 'Lucas'), member('user-camille', 'Camille')];
const projects = [
  { id: 'proj-1', orgId: 'org-1', name: 'Refonte du site', color: 'blue', archived: false,
    createdBy: 'user-axel', createdAt: '2026-01-01T00:00:00Z' } as TeamProject,
];

const entry = (over: Partial<TeamTaskActivity>): TeamTaskActivity => ({
  id: 'a1', taskId: 'ttask-1', orgId: 'org-1', actorId: 'user-axel', field: 'status',
  oldValue: null, newValue: null, createdAt: new Date().toISOString(), ...over,
});

const renderWith = (list: TeamTaskActivity[]) => {
  entries.length = 0;
  entries.push(...list);
  return render(<TeamTaskHistorySection taskId="ttask-1" members={members} projects={projects} />);
};

describe('TeamTaskHistorySection', () => {
  it('affiche les libellés de statut, pas les identifiants techniques', () => {
    const { container } = renderWith([entry({ field: 'status', oldValue: 'todo', newValue: 'in_progress' })]);
    expect(container.textContent).toContain('À faire');
    expect(container.textContent).toContain('En cours');
    expect(container.textContent).not.toContain('in_progress');
  });

  it('affiche les noms des assignés, pas leurs UUID', () => {
    const { container } = renderWith([
      entry({ field: 'assignees', oldValue: 'user-lucas', newValue: 'user-lucas,user-camille' }),
    ]);
    expect(container.textContent).toContain('Lucas, Camille');
    expect(container.textContent).not.toContain('user-camille');
  });

  it('affiche le nom du projet, pas son UUID', () => {
    const { container } = renderWith([entry({ field: 'project', oldValue: null, newValue: 'proj-1' })]);
    expect(container.textContent).toContain('Refonte du site');
    expect(container.textContent).not.toContain('proj-1');
  });

  it('replie sur un libellé lisible quand le membre ou le projet a été supprimé', () => {
    const { container } = renderWith([
      entry({ id: 'a1', field: 'assignees', newValue: '11111111-1111-1111-1111-111111111111' }),
      entry({ id: 'a2', field: 'project', newValue: '22222222-2222-2222-2222-222222222222' }),
    ]);
    expect(container.textContent).toContain('un membre retiré');
    expect(container.textContent).toContain('un projet supprimé');
    expect(container.textContent).not.toContain('1111');
  });

  it('rend « aucun » quand tous les assignés ont été retirés', () => {
    // `array_to_string` d'un tableau vide écrit '' — pas un blanc à l'écran.
    renderWith([entry({ field: 'assignees', oldValue: 'user-lucas', newValue: '' })]);
    expect(screen.getByText(/aucune/)).toBeTruthy();
  });
});
