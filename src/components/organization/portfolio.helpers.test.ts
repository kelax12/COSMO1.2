import { describe, it, expect } from 'vitest';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import {
  matchesProjectSearch, sortProjects, projectProgress, isProjectLate,
  openBlockers, duplicateBlueprint, buildTemplatePayload, instantiateTemplate,
} from './portfolio.helpers';

const project = (patch: Partial<TeamProject>): TeamProject => ({
  id: 'p', orgId: 'o', name: 'Projet', color: 'blue', createdBy: 'u', createdAt: '2026-09-01T10:00:00Z',
  archivedAt: null, teamId: null, categoryId: null, status: 'active', ...patch,
});

const task = (patch: Partial<TeamTask>): TeamTask => ({
  id: 't', orgId: 'o', projectId: 'p', name: 'Tâche', priority: 3, deadline: '', startDate: '',
  assigneeIds: [], createdBy: 'u', completed: false, status: 'todo', completedAt: null,
  createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z', ...patch,
});

describe('matchesProjectSearch', () => {
  it('ignore accents et casse, et exige CHAQUE mot', () => {
    const p = project({ name: 'Refonte du site', description: 'Équipe web' });
    expect(matchesProjectSearch(p, 'refonte EQUIPE')).toBe(true);
    expect(matchesProjectSearch(p, 'refonte mobile')).toBe(false);
  });

  it('cherche aussi dans l’équipe, la catégorie et le responsable', () => {
    const p = project({ name: 'X' });
    expect(matchesProjectSearch(p, 'camille', { ownerName: 'Camille Martin' })).toBe(true);
    expect(matchesProjectSearch(p, 'design', { teamName: 'Design' })).toBe(true);
  });

  it('une recherche vide garde tout', () => {
    expect(matchesProjectSearch(project({}), '   ')).toBe(true);
  });
});

describe('sortProjects', () => {
  const a = project({ id: 'a', name: 'Beta', dueDate: '2026-12-01', createdAt: '2026-01-01T00:00:00Z', status: 'done' });
  const b = project({ id: 'b', name: 'alpha', dueDate: null, createdAt: '2026-03-01T00:00:00Z', status: 'active' });
  const c = project({ id: 'c', name: 'Gamma', dueDate: '2026-10-01', createdAt: '2026-02-01T00:00:00Z', status: 'on_hold' });
  const tasks = [
    task({ id: '1', projectId: 'a', completed: true }),
    task({ id: '2', projectId: 'c', completed: true }), task({ id: '3', projectId: 'c' }),
  ];

  it('par nom, sans tenir compte de la casse', () => {
    expect(sortProjects([a, b, c], 'name', tasks).map((p) => p.id)).toEqual(['b', 'a', 'c']);
  });
  it('par échéance, un projet sans échéance en DERNIER', () => {
    expect(sortProjects([a, b, c], 'dueDate', tasks).map((p) => p.id)).toEqual(['c', 'a', 'b']);
  });
  it('par avancement croissant', () => {
    expect(sortProjects([a, b, c], 'progress', tasks).map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });
  it('par statut : en cours, en pause, planifié, terminé', () => {
    expect(sortProjects([a, b, c], 'status', tasks).map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });
  it('par défaut, les plus récents d’abord', () => {
    expect(sortProjects([a, b, c], 'recent', tasks).map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('avancement, retard, blocages', () => {
  it('projectProgress compte le projet seul, 0 % sans tâche', () => {
    expect(projectProgress('p', [task({ completed: true }), task({ id: 't2' }), task({ id: 'x', projectId: 'q' })]))
      .toEqual({ done: 1, total: 2, percent: 50 });
    expect(projectProgress('vide', []).percent).toBe(0);
  });

  it('isProjectLate : échéance passée ET pas terminé', () => {
    const now = new Date('2026-09-24T12:00:00');
    expect(isProjectLate(project({ dueDate: '2026-09-20' }), now)).toBe(true);
    expect(isProjectLate(project({ dueDate: '2026-09-20', status: 'done' }), now)).toBe(false);
    expect(isProjectLate(project({ dueDate: '2026-09-24' }), now)).toBe(false);
  });

  it('openBlockers : seulement les projets dont il DÉPEND et non terminés', () => {
    const projects = [project({ id: 'a' }), project({ id: 'b', status: 'done' }), project({ id: 'c' })];
    const deps = [
      { projectId: 'a', dependsOnId: 'b' },
      { projectId: 'a', dependsOnId: 'c' },
      { projectId: 'c', dependsOnId: 'a' },
    ];
    expect(openBlockers('a', deps, projects).map((p) => p.id)).toEqual(['c']);
  });
});

describe('dupliquer', () => {
  it('reprend les tâches OUVERTES, le duplicateur en répond', () => {
    const p = project({ status: 'done', teamId: 'team', ownerId: 'autre' });
    const bp = duplicateBlueprint(
      p,
      [task({ id: '1', name: 'ouverte', assigneeIds: ['x'] }), task({ id: '2', completed: true })],
      { name: 'Copie', ownerId: 'moi' },
    );
    expect(bp.input).toMatchObject({ name: 'Copie', ownerId: 'moi', teamId: 'team', status: 'active' });
    expect(bp.tasks.map((t) => t.name)).toEqual(['ouverte']);
    expect(bp.tasks[0].assigneeIds).toEqual(['x']);
  });
});

describe('modèles', () => {
  const p = project({ startDate: '2026-10-01', dueDate: '2026-10-31' });
  const tasks = [
    task({ id: '1', name: 'Cadrage', startDate: '2026-10-01', deadline: '2026-10-03', assigneeIds: ['x'] }),
    task({ id: '2', name: 'Sans date' }),
  ];

  it('stocke des DÉCALAGES, jamais des dates ni des assignés', () => {
    const payload = buildTemplatePayload(p, tasks);
    expect(payload.tasks[0]).toMatchObject({ name: 'Cadrage', startOffset: 0, deadlineOffset: 2 });
    expect(payload.tasks[0]).not.toHaveProperty('assigneeIds');
    expect(payload.tasks[1]).toMatchObject({ startOffset: null, deadlineOffset: null });
    expect(payload.durationDays).toBe(30);
  });

  it('se re-date depuis le nouveau début', () => {
    const inst = instantiateTemplate(buildTemplatePayload(p, tasks), '2027-01-10');
    expect(inst.tasks[0]).toMatchObject({ startDate: '2027-01-10', deadline: '2027-01-12' });
    expect(inst.tasks[1].deadline).toBeUndefined();
    expect(inst.dueDate).toBe('2027-02-09');
  });

  it('ne fabrique jamais un début après l’échéance (CHECK serveur)', () => {
    const inst = instantiateTemplate({ tasks: [{ name: 'x', startOffset: 5, deadlineOffset: 2 }] }, '2027-01-01');
    expect(inst.tasks[0].startDate! <= inst.tasks[0].deadline!).toBe(true);
  });
});

// « Mes projets » (audit du 2026-09-24, une personne sur plusieurs projets).
import { isMyProject } from './portfolio.helpers';

describe('isMyProject', () => {
  it('responsable, ou au moins une tâche OUVERTE assignée', () => {
    expect(isMyProject(project({ ownerId: 'me' }), 'me', [])).toBe(true);
    expect(isMyProject(project({}), 'me', [task({ assigneeIds: ['me'] })])).toBe(true);
    expect(isMyProject(project({}), 'me', [task({ assigneeIds: ['me'], completed: true })])).toBe(false);
    expect(isMyProject(project({}), 'me', [task({ assigneeIds: ['me'], projectId: 'other' })])).toBe(false);
    expect(isMyProject(project({ ownerId: 'me' }), undefined, [])).toBe(false);
  });
});
