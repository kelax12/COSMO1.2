import { describe, it, expect } from 'vitest';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import { isProjectOverdue, matchesProjectFilters } from './project-filters';

const project = (patch: Partial<TeamProject>): TeamProject => ({
  id: 'p', orgId: 'o', name: 'Projet', color: 'blue', createdBy: 'u', createdAt: '2026-09-01T10:00:00Z',
  archivedAt: null, teamId: null, categoryId: null, status: 'active', ...patch,
});

const task = (patch: Partial<TeamTask>): TeamTask => ({
  id: 't', orgId: 'o', projectId: 'p', name: 'Tâche', priority: 3, deadline: '', startDate: '',
  assigneeIds: [], createdBy: 'u', completed: false, status: 'todo', completedAt: null,
  createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z', ...patch,
});

const TODAY = '2026-09-27';
const none = { assignee: null, status: 'all' as const, dueFrom: '', dueTo: '' };

describe('matchesProjectFilters', () => {
  it('sans filtre, tout projet passe', () => {
    expect(matchesProjectFilters(project({}), none, [], TODAY)).toBe(true);
  });

  it('personne : responsable du projet ou assignée à une tâche ouverte', () => {
    const tasks = [task({ assigneeIds: ['bob'] })];
    expect(matchesProjectFilters(project({ ownerId: 'ann' }), { ...none, assignee: 'ann' }, tasks, TODAY)).toBe(true);
    expect(matchesProjectFilters(project({}), { ...none, assignee: 'bob' }, tasks, TODAY)).toBe(true);
    expect(matchesProjectFilters(project({}), { ...none, assignee: 'eve' }, tasks, TODAY)).toBe(false);
  });

  it('une tâche d un AUTRE projet ne rend pas le projet « à moi »', () => {
    const tasks = [task({ projectId: 'autre', assigneeIds: ['bob'] })];
    expect(matchesProjectFilters(project({}), { ...none, assignee: 'bob' }, tasks, TODAY)).toBe(false);
  });

  it('plage d échéance : celle du projet ou celle d une tâche ouverte', () => {
    const week = { ...none, dueFrom: TODAY, dueTo: '2026-10-03' };
    expect(matchesProjectFilters(project({ dueDate: '2026-10-01' }), week, [], TODAY)).toBe(true);
    expect(matchesProjectFilters(project({}), week, [task({ deadline: '2026-09-30' })], TODAY)).toBe(true);
    expect(matchesProjectFilters(project({}), week, [task({ deadline: '2026-09-30', completed: true })], TODAY)).toBe(false);
    expect(matchesProjectFilters(project({ dueDate: '2026-12-01' }), week, [], TODAY)).toBe(false);
  });
});

describe('isProjectOverdue', () => {
  it('échéance dépassée avec du travail restant', () => {
    expect(isProjectOverdue(project({ dueDate: '2026-09-01' }), [task({})], TODAY)).toBe(true);
  });

  it('échéance dépassée mais tout est terminé : pas en retard', () => {
    expect(isProjectOverdue(project({ dueDate: '2026-09-01' }), [task({ completed: true })], TODAY)).toBe(false);
  });

  it('une tâche ouverte en retard suffit', () => {
    expect(isProjectOverdue(project({}), [task({ deadline: '2026-09-01' })], TODAY)).toBe(true);
  });
});
