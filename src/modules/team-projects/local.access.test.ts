// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { TeamProject, TeamTask } from './types';
import {
  computeMemberWorkload, computeProjectTaskStats, getProjectMembers, removeProjectMember, setProjectMember,
} from './local.access';

const task = (over: Partial<TeamTask>): TeamTask => ({
  id: 't', orgId: 'org', projectId: 'p1', name: 'T', priority: 3, assigneeIds: [], createdBy: 'u',
  completed: false, status: 'todo', createdAt: '2026-01-01T00:00:00Z', ...over,
} as TeamTask);

const project = (id: string, orgId = 'org'): TeamProject => ({
  id, orgId, name: id, color: 'blue', createdBy: 'u', createdAt: '2026-01-01',
});

describe('team-projects · local.access (démo, miroir des mig. 190 et 191)', () => {
  beforeEach(() => localStorage.clear());

  it('avancement compté sur TOUTES les tâches, comme le serveur', () => {
    const stats = computeProjectTaskStats([
      task({ id: 'a', completed: true, status: 'done' }),
      task({ id: 'b', deadline: '2026-09-01' }),
      task({ id: 'c', deadline: '2026-10-01', status: 'review' }),
      task({ id: 'd', projectId: 'p2' }),
    ], '2026-09-25');
    const p1 = stats.find((s) => s.projectId === 'p1');
    expect(p1).toEqual({ projectId: 'p1', total: 3, completed: 1, overdue: 1, inReview: 1, nextDeadline: '2026-10-01' });
    expect(stats.find((s) => s.projectId === 'p2')?.total).toBe(1);
  });

  it('charge : ouvertes seulement, retard, 7 jours, minutes estimées', () => {
    const w = computeMemberWorkload([
      task({ id: 'a', assigneeIds: ['u1', 'u2'], deadline: '2026-09-20', estimatedTime: 30 }),
      task({ id: 'b', assigneeIds: ['u1'], deadline: '2026-09-28', estimatedTime: 15 }),
      task({ id: 'c', assigneeIds: ['u1'], deadline: '2026-10-10' }),
      task({ id: 'd', assigneeIds: ['u1'], completed: true }),
    ], '2026-09-25');
    expect(w.find((x) => x.userId === 'u1')).toEqual({ userId: 'u1', openTasks: 3, overdue: 1, dueIn7Days: 1, estimatedMinutes: 45 });
    expect(w.find((x) => x.userId === 'u2')?.openTasks).toBe(1);
  });

  it('membres de projet : org déduite du projet, un rôle par personne, retrait', () => {
    const projects = [project('p1', 'orgA')];
    setProjectMember('p1', 'u1', 'viewer', projects);
    setProjectMember('p1', 'u1', 'lead', projects);
    expect(getProjectMembers('orgA')).toEqual([
      expect.objectContaining({ projectId: 'p1', userId: 'u1', orgId: 'orgA', role: 'lead' }),
    ]);
    removeProjectMember('p1', 'u1');
    expect(getProjectMembers('orgA')).toEqual([]);
  });

  it('refuse un projet inconnu et un rôle hors des trois', () => {
    expect(() => setProjectMember('nope', 'u1', 'viewer', [])).toThrow();
    // @ts-expect-error rôle hors énumération, comme le CHECK de la mig. 190
    expect(() => setProjectMember('p1', 'u1', 'owner', [project('p1')])).toThrow();
  });
});
