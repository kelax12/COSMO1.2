import { describe, it, expect } from 'vitest';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import { buildTeamTaskCommon, initialTeamTaskForm, sameSet, teamTaskHasChanges } from './team-task-form.helpers';

const project = (id: string, categoryId: string | null = null) =>
  ({ id, orgId: 'org', name: id, categoryId }) as unknown as TeamProject;

const task = (over: Partial<TeamTask> = {}) =>
  ({
    id: 't1', orgId: 'org', projectId: 'p1', name: 'Tâche', description: 'desc', priority: 2,
    deadline: '2026-12-01', startDate: '2026-11-20', estimatedTime: 30, assigneeIds: ['u1'],
    status: 'todo', categoryId: 'c1', validatorId: null, ...over,
  }) as unknown as TeamTask;

describe('initialTeamTaskForm', () => {
  const projects = [project('p1', 'cat-1'), project('p2', 'cat-2')];

  it('édition : reprend la tâche, champs absents vidés', () => {
    const f = initialTeamTaskForm({ task: task({ description: undefined, estimatedTime: undefined }), projects, requireProjectChoice: false });
    expect(f).toMatchObject({ status: 'todo', name: 'Tâche', description: '', priority: 2, estimatedTime: '', projectId: 'p1', categoryId: 'c1' });
  });

  it('édition : une tâche sans catégorie ne prend pas celle du projet', () => {
    expect(initialTeamTaskForm({ task: task({ categoryId: undefined }), projects, requireProjectChoice: false }).categoryId).toBeNull();
  });

  it('création : premier projet, sa catégorie, aucune priorité, statut par défaut', () => {
    expect(initialTeamTaskForm({ projects, requireProjectChoice: false })).toMatchObject({
      status: 'in_progress', priority: null, projectId: 'p1', categoryId: 'cat-1', assigneeIds: [],
    });
  });

  it('création : projet, statut et assignés présélectionnés', () => {
    expect(initialTeamTaskForm({ projects, defaultProjectId: 'p2', defaultStatus: 'done', defaultAssigneeIds: ['u9'], requireProjectChoice: false }))
      .toMatchObject({ status: 'done', projectId: 'p2', categoryId: 'cat-2', assigneeIds: ['u9'] });
  });

  it('création avec choix exigé : aucun projet, aucune catégorie', () => {
    expect(initialTeamTaskForm({ projects, requireProjectChoice: true })).toMatchObject({ projectId: '', categoryId: null });
  });
});

describe('teamTaskHasChanges', () => {
  const ref = task();
  const form = initialTeamTaskForm({ task: ref, projects: [], requireProjectChoice: false });
  const lists = { listIds: [], baseListIds: [] };

  it('rien de touché : pas de changement', () => {
    expect(teamTaskHasChanges(form, ref, lists)).toBe(false);
  });

  it('un champ, les assignés (ensemble), ou les listes connues : changement', () => {
    expect(teamTaskHasChanges({ ...form, name: 'Autre' }, ref, lists)).toBe(true);
    expect(teamTaskHasChanges({ ...form, estimatedTime: '45' }, ref, lists)).toBe(true);
    expect(teamTaskHasChanges({ ...form, assigneeIds: ['u2'] }, ref, lists)).toBe(true);
    expect(teamTaskHasChanges(form, ref, { listIds: ['l1'], baseListIds: [] })).toBe(true);
  });

  it('listes pas encore lues : ignorées ; durée vide = 0', () => {
    expect(teamTaskHasChanges(form, ref, { listIds: ['l1'], baseListIds: null })).toBe(false);
    const sansDuree = task({ estimatedTime: undefined });
    expect(teamTaskHasChanges({ ...initialTeamTaskForm({ task: sansDuree, projects: [], requireProjectChoice: false }), estimatedTime: '  ' }, sansDuree, lists)).toBe(false);
  });
});

describe('buildTeamTaskCommon', () => {
  const base = initialTeamTaskForm({ task: task(), projects: [], requireProjectChoice: false });

  it('nom et description rognés, durée en nombre', () => {
    expect(buildTeamTaskCommon({ ...base, name: '  A  ', description: ' d ', estimatedTime: '15' }))
      .toMatchObject({ name: 'A', description: 'd', estimatedTime: 15, priority: 2 });
  });

  it('priorité et durée vides non envoyées', () => {
    const out = buildTeamTaskCommon({ ...base, priority: null, estimatedTime: '' });
    expect(out).not.toHaveProperty('priority');
    expect(out).not.toHaveProperty('estimatedTime');
    expect(buildTeamTaskCommon({ ...base, estimatedTime: 'abc' })).not.toHaveProperty('estimatedTime');
  });

  it('début ramené à l échéance quand elle passe avant', () => {
    expect(buildTeamTaskCommon({ ...base, startDate: '2026-12-10', deadline: '2026-12-01' }).startDate).toBe('2026-12-01');
    expect(buildTeamTaskCommon({ ...base, startDate: '2026-11-10', deadline: '2026-12-01' }).startDate).toBe('2026-11-10');
    expect(buildTeamTaskCommon({ ...base, startDate: '2026-12-10', deadline: '' }).startDate).toBe('2026-12-10');
  });
});

describe('sameSet', () => {
  it('compare sans l ordre', () => {
    expect(sameSet(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameSet(['a'], ['a', 'b'])).toBe(false);
  });
});
