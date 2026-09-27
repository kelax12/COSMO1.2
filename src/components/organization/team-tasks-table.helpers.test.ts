// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import type { TeamTask } from '@/modules/team-projects';
import {
  groupTasks, flattenGroups, buildTasksCsv, readTaskColumns, writeTaskColumns, DEFAULT_TASK_COLUMNS, UNASSIGNED_GROUP,
} from './team-tasks-table.helpers';

const task = (id: string, over: Partial<TeamTask> = {}): TeamTask => ({
  id, orgId: 'o', projectId: 'p1', name: id, priority: 3, assigneeIds: [], createdBy: 'u',
  completed: false, status: 'todo', createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z', ...over,
});

describe('groupTasks', () => {
  it('par assigné, une tâche à deux personnes figure sous chacune, « personne » en dernier', () => {
    const groups = groupTasks([task('a', { assigneeIds: ['u2', 'u1'] }), task('b')], 'assignee', (k) => ({ u1: 'Alice', u2: 'Bob' }[k] ?? k));
    expect(groups.map((g) => g.key)).toEqual(['u1', 'u2', UNASSIGNED_GROUP]);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['a']);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(['a']);
  });

  it('par statut, l ordre est celui du flux, et l ordre interne du tri est conservé', () => {
    const groups = groupTasks([task('x', { status: 'done' }), task('y'), task('z')], 'status');
    expect(groups.map((g) => g.key)).toEqual(['todo', 'done']);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['y', 'z']);
  });

  it('flattenGroups : clé unique par ligne, un groupe replié ne montre que son en-tête', () => {
    const groups = groupTasks([task('a', { assigneeIds: ['u1', 'u2'] })], 'assignee');
    const lines = flattenGroups(groups, true, new Set(['u2']));
    expect(lines.map((l) => l.key)).toEqual(['u1', 'u1:a', 'u2']);
    expect(new Set(lines.map((l) => l.key)).size).toBe(lines.length);
  });
});

describe('groupTasks — échéance (fusion tri/regroupement du 2026-09-27)', () => {
  it('range en retard / aujourd hui / cette semaine / plus tard / sans date, dans cet ordre', () => {
    const groups = groupTasks([
      task('later', { deadline: '2026-09-20' }),
      task('overdue', { deadline: '2026-09-01' }),
      task('none', { deadline: '' }),
      task('today', { deadline: '2026-09-10' }),
      task('week', { deadline: '2026-09-14' }),
    ], 'deadline', undefined, '2026-09-10');
    expect(groups.map((g) => g.key)).toEqual(['overdue', 'today', 'thisWeek', 'later', 'noDue']);
  });

  it('nom et durée restent une liste plate, comme l ancien « none »', () => {
    expect(groupTasks([task('a'), task('b')], 'name').map((g) => g.key)).toEqual(['all']);
    expect(groupTasks([task('a'), task('b')], 'estimatedTime').map((g) => g.key)).toEqual(['all']);
  });
});

describe('colonnes, préférence locale', () => {
  beforeEach(() => localStorage.clear());
  it('une valeur corrompue rend les colonnes par défaut, une valeur inconnue est ignorée', () => {
    localStorage.setItem('cosmo_org_task_columns_o', '{pas du json');
    expect(readTaskColumns('o')).toEqual([...DEFAULT_TASK_COLUMNS]);
    localStorage.setItem('cosmo_org_task_columns_o', JSON.stringify(['category', 'hack', 'category', 'project']));
    expect(readTaskColumns('o')).toEqual(['project', 'category']);
  });
  it('relit ce qu elle écrit, dans l ordre canonique', () => {
    writeTaskColumns('o', ['deadline', 'assignees']);
    expect(readTaskColumns('o')).toEqual(['assignees', 'deadline']);
  });
});

describe('buildTasksCsv', () => {
  it('exporte ce que le tableau montre, sans identifiant interne', () => {
    const { headers, rows } = buildTasksCsv([task('Devis', { assigneeIds: ['u1'], deadline: '2026-09-30', priority: 1, estimatedTime: 45 })], {
      headers: { name: 'N', project: 'P', status: 'S', priority: 'Pr', start: 'D', deadline: 'E', duration: 'Du', assignees: 'A', category: 'C', createdAt: 'Cr' },
      statusOf: () => 'À faire', projectOf: () => 'Site', personOf: () => 'Alice', categoryOf: () => '',
    });
    expect(headers).toHaveLength(10);
    expect(rows[0]).toEqual(['Devis', 'Site', 'À faire', 'P1', '', '2026-09-30', '45', 'Alice', '', '2026-09-01']);
    expect(rows[0].join('|')).not.toContain('p1');
  });
});
