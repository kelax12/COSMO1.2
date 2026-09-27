import { describe, it, expect } from 'vitest';
import type { TeamTask, TeamProject } from '@/modules/team-projects';
import type { TeamOKR } from '@/modules/team-okrs';
import type { OrgTeamMember } from '@/modules/org-teams';
import {
  averageOkrProgress,
  canManageTeam,
  computeTeamLoad,
  loadBucketOf,
  computeTeamStats,
  sortTeamMembers,
  teamOkrsOf,
  teamProjectsOf,
} from './team-page.helpers';

const NOW = new Date('2026-09-25T10:00:00');

const task = (over: Partial<TeamTask>): TeamTask =>
  ({
    id: Math.random().toString(36).slice(2),
    orgId: 'o',
    projectId: 'p1',
    name: 't',
    assigneeIds: [],
    completed: false,
    status: 'todo',
    createdAt: '2026-09-01T00:00:00Z',
    ...over,
  }) as TeamTask;

describe('computeTeamStats', () => {
  const ids = new Set(['p1', 'p2']);

  it('compte ouvertes, retards et terminées dans la fenêtre', () => {
    const stats = computeTeamStats(
      [
        task({}),
        task({ deadline: '2026-09-20' }),
        task({ deadline: '2026-09-25' }), // aujourd'hui : pas en retard
        task({ completed: true, status: 'done', completedAt: '2026-09-20T12:00:00Z' }),
        task({ completed: true, status: 'done', completedAt: '2026-07-01T12:00:00Z' }), // hors fenêtre
      ],
      ids,
      NOW,
    );
    expect(stats).toEqual({ open: 3, overdue: 1, doneInWindow: 1, completionRate: 25 });
  });

  it("ignore les tâches d'un projet qui n'est pas à l'équipe", () => {
    const stats = computeTeamStats([task({ projectId: 'autre' })], ids, NOW);
    expect(stats.open).toBe(0);
  });

  it("ne dit pas 0 % quand il n'y a rien à mesurer", () => {
    expect(computeTeamStats([], ids, NOW).completionRate).toBeNull();
  });
});

describe('teamProjectsOf / teamOkrsOf', () => {
  it("un projet d'organisation n'appartient à aucune équipe", () => {
    const projects = [
      { id: 'a', teamId: 't1' },
      { id: 'b', teamId: null },
      { id: 'c', teamId: 't2' },
    ] as TeamProject[];
    expect(teamProjectsOf({ id: 't1' }, projects).map((p) => p.id)).toEqual(['a']);
  });

  it('un OKR partagé compte pour chacune de ses équipes', () => {
    const okrs = [{ id: 'x', teamIds: ['t1', 't2'] }, { id: 'y', teamIds: [] }] as unknown as TeamOKR[];
    expect(teamOkrsOf({ id: 't2' }, okrs).map((o) => o.id)).toEqual(['x']);
  });
});

describe('averageOkrProgress', () => {
  it('null sans OKR, moyenne arrondie sinon', () => {
    expect(averageOkrProgress([])).toBeNull();
    const kr = (current: number, target: number) => ({ currentValue: current, targetValue: target, weight: 1 });
    const okrs = [
      { keyResults: [kr(5, 10)] },
      { keyResults: [kr(10, 10)] },
    ] as unknown as TeamOKR[];
    expect(averageOkrProgress(okrs)).toBe(75);
  });
});

describe('sortTeamMembers', () => {
  it('responsables en tête, puis alphabétique', () => {
    const memberships = [{ teamId: 't', orgId: 'o', userId: 'z', isLead: true }] as OrgTeamMember[];
    const sorted = sortTeamMembers(
      [
        { userId: 'b', displayName: 'Bruno' },
        { userId: 'z', displayName: 'Zoé' },
        { userId: 'a', displayName: 'Alice' },
      ],
      memberships,
    );
    expect(sorted.map((m) => m.userId)).toEqual(['z', 'a', 'b']);
  });
});

describe('canManageTeam (miroir de can_manage_team)', () => {
  const team = { id: 't', createdBy: 'creator' };
  const memberships = [
    { teamId: 't', orgId: 'o', userId: 'lead', isLead: true },
    { teamId: 't', orgId: 'o', userId: 'plain', isLead: false },
    { teamId: 'autre', orgId: 'o', userId: 'lead-ailleurs', isLead: true },
  ] as OrgTeamMember[];

  it('admin, créateur et responsable de CETTE équipe', () => {
    expect(canManageTeam(team, memberships, 'x', true)).toBe(true);
    expect(canManageTeam(team, memberships, 'creator', false)).toBe(true);
    expect(canManageTeam(team, memberships, 'lead', false)).toBe(true);
  });

  it("ni un simple membre, ni le responsable d'une autre équipe, ni un anonyme", () => {
    expect(canManageTeam(team, memberships, 'plain', false)).toBe(false);
    expect(canManageTeam(team, memberships, 'lead-ailleurs', false)).toBe(false);
    expect(canManageTeam(team, memberships, undefined, false)).toBe(false);
  });
});

describe('loadBucketOf', () => {
  it('range une échéance passée, proche, lointaine ou absente', () => {
    expect(loadBucketOf({ deadline: '2026-09-24' }, NOW)).toBe('overdue');
    expect(loadBucketOf({ deadline: '2026-09-25' }, NOW)).toBe('thisWeek');
    expect(loadBucketOf({ deadline: '2026-10-01' }, NOW)).toBe('thisWeek');
    expect(loadBucketOf({ deadline: '2026-10-02' }, NOW)).toBe('later');
    expect(loadBucketOf({ deadline: '' }, NOW)).toBe('noDate');
  });
});

describe('computeTeamLoad', () => {
  const projects = new Set(['p1']);
  it('compte les ouvertes par membre, les non assignées à part, et ignore le reste', () => {
    const rows = computeTeamLoad(
      [
        task({ assigneeIds: ['a', 'b'], deadline: '2026-09-20' }),
        task({ assigneeIds: ['a'], deadline: '' }),
        task({ assigneeIds: ['a'], deadline: '2026-09-26' }),
        task({ assigneeIds: [] }),
        task({ assigneeIds: ['x'] }),
        task({ assigneeIds: ['a'], completed: true }),
        task({ assigneeIds: ['a'], projectId: 'autre' }),
      ],
      projects,
      ['a', 'b'],
      NOW,
    );
    expect(rows.map((r) => [r.userId, r.total])).toEqual([['a', 3], ['b', 1], [null, 1]]);
    expect(rows[0].counts).toEqual({ overdue: 1, thisWeek: 1, later: 0, noDate: 1 });
    expect(rows[0].tasks.map((t) => t.deadline)).toEqual(['2026-09-20', '2026-09-26', '']);
  });
});
