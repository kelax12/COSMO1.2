import { describe, it, expect } from 'vitest';
import type { TeamTask, TeamProject } from '@/modules/team-projects';
import type { TeamOKR } from '@/modules/team-okrs';
import type { OrgMember } from '@/modules/organizations';
import {
  periodStart, isCreatedWithin, filterByPeriod, isOverdue,
  summarize, overallOkrProgress, okrProgress,
  memberLoad, overdueByMember, projectBreakdown,
  velocityByWeek, completionTrend, okrBreakdown,
} from './team-stats.helpers';

const NOW = new Date('2026-07-18T12:00:00Z');
const iso = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86400000).toISOString();
const dateStr = (daysFromNow: number) => {
  const d = new Date(NOW.getTime() + daysFromNow * 86400000);
  return d.toISOString().slice(0, 10);
};

const task = (over: Partial<TeamTask>): TeamTask => ({
  id: 't1', orgId: 'o', projectId: 'p1', name: 'T', priority: 3,
  deadline: '', estimatedTime: 30, assigneeIds: ['u1'], createdBy: 'u1',
  completed: false, completedAt: null, createdAt: iso(5), updatedAt: iso(1),
  ...over,
});

const members: OrgMember[] = [
  { userId: 'u1', displayName: 'Marie Dupont', role: 'member', managerId: null } as OrgMember,
  { userId: 'u2', displayName: 'Jean Martin', role: 'member', managerId: null } as OrgMember,
];

describe('periodStart', () => {
  it('renvoie null pour « Tout »', () => {
    expect(periodStart('all', NOW)).toBeNull();
  });
  it('recule du bon nombre de jours (minuit)', () => {
    const s = periodStart('7', NOW)!;
    expect(s.getHours()).toBe(0);
    // 7 jours avant le 18 → autour du 11
    expect(s.getDate()).toBe(11);
  });
});

describe('isCreatedWithin / filterByPeriod', () => {
  it('exclut ce qui est créé avant la fenêtre', () => {
    const start = periodStart('7', NOW);
    expect(isCreatedWithin(task({ createdAt: iso(3) }), start)).toBe(true);
    expect(isCreatedWithin(task({ createdAt: iso(20) }), start)).toBe(false);
  });
  it('start null = tout passe', () => {
    expect(isCreatedWithin(task({ createdAt: iso(999) }), null)).toBe(true);
  });
  it('date illisible : ne pas exclure', () => {
    expect(isCreatedWithin(task({ createdAt: 'pas-une-date' }), periodStart('7', NOW))).toBe(true);
  });
  it('filterByPeriod garde les récents', () => {
    const tasks = [task({ id: 'a', createdAt: iso(2) }), task({ id: 'b', createdAt: iso(40) })];
    expect(filterByPeriod(tasks, periodStart('30', NOW)).map((t) => t.id)).toEqual(['a']);
    expect(filterByPeriod(tasks, null)).toHaveLength(2);
  });
});

describe('isOverdue', () => {
  it('vrai si deadline passée et non terminée', () => {
    expect(isOverdue(task({ deadline: dateStr(-3) }))).toBe(true);
  });
  it('faux si terminée', () => {
    expect(isOverdue(task({ deadline: dateStr(-3), completed: true }))).toBe(false);
  });
  it('faux si pas de deadline ou deadline future', () => {
    expect(isOverdue(task({ deadline: '' }))).toBe(false);
    expect(isOverdue(task({ deadline: dateStr(3) }))).toBe(false);
  });
});

describe('summarize', () => {
  it('compte total, complétées, taux et retards', () => {
    const tasks = [
      task({ id: 'a', completed: true }),
      task({ id: 'b', completed: false, deadline: dateStr(-2) }),
      task({ id: 'c', completed: false }),
      task({ id: 'd', completed: true }),
    ];
    const s = summarize(tasks);
    expect(s.total).toBe(4);
    expect(s.completed).toBe(2);
    expect(s.completionRate).toBe(50);
    expect(s.overdueCount).toBe(1);
  });
  it('taux 0 sans tâche', () => {
    expect(summarize([]).completionRate).toBe(0);
  });
});

describe('OKR progress', () => {
  const okr = (over: Partial<TeamOKR>): TeamOKR => ({
    id: 'o1', orgId: 'o', title: 'Obj', createdBy: 'u1', createdAt: iso(10),
    teamIds: [], keyResults: [], ...over,
  });
  it('progression pondérée par le coefficient', () => {
    const o = okr({
      keyResults: [
        { id: 'k1', okrId: 'o1', orgId: 'o', title: 'A', currentValue: 10, targetValue: 10, completed: false, weight: 3 },
        { id: 'k2', okrId: 'o1', orgId: 'o', title: 'B', currentValue: 0, targetValue: 10, completed: false, weight: 1 },
      ],
    });
    // (1*3 + 0*1) / 4 = 0.75
    expect(okrProgress(o)).toBeCloseTo(0.75);
  });
  it('targetValue 0 → 0 (garde B17)', () => {
    const o = okr({ keyResults: [{ id: 'k', okrId: 'o1', orgId: 'o', title: 'X', currentValue: 5, targetValue: 0, completed: false }] });
    expect(okrProgress(o)).toBe(0);
  });
  it('overallOkrProgress agrège plusieurs objectifs', () => {
    const o1 = okr({ id: 'o1', keyResults: [{ id: 'k', okrId: 'o1', orgId: 'o', title: 'X', currentValue: 10, targetValue: 10, completed: true }] });
    const o2 = okr({ id: 'o2', keyResults: [{ id: 'k2', okrId: 'o2', orgId: 'o', title: 'Y', currentValue: 0, targetValue: 10, completed: false }] });
    expect(overallOkrProgress([o1, o2])).toBe(50);
  });
  it('okrBreakdown trie du moins avancé au plus avancé', () => {
    const o1 = okr({ id: 'o1', title: 'Avancé', keyResults: [{ id: 'k', okrId: 'o1', orgId: 'o', title: 'X', currentValue: 10, targetValue: 10, completed: true }] });
    const o2 = okr({ id: 'o2', title: 'Retard', keyResults: [{ id: 'k2', okrId: 'o2', orgId: 'o', title: 'Y', currentValue: 0, targetValue: 10, completed: false }] });
    const b = okrBreakdown([o1, o2]);
    expect(b.map((x) => x.title)).toEqual(['Retard', 'Avancé']);
    expect(b[1].progress).toBe(100);
  });
});

describe('memberLoad', () => {
  it('compte ouvertes/terminées par assigné (multi-assignation)', () => {
    const tasks = [
      task({ id: 'a', assigneeIds: ['u1'], completed: false }),
      task({ id: 'b', assigneeIds: ['u1'], completed: true }),
      task({ id: 'c', assigneeIds: ['u1', 'u2'], completed: false }),
    ];
    const load = memberLoad(tasks, members);
    const marie = load.find((m) => m.userId === 'u1')!;
    expect(marie.open).toBe(2);
    expect(marie.done).toBe(1);
    expect(marie.total).toBe(3);
    expect(marie.completionRate).toBe(33);
    const jean = load.find((m) => m.userId === 'u2')!;
    expect(jean.open).toBe(1);
    expect(jean.total).toBe(1);
  });
});

describe('overdueByMember', () => {
  it('ne garde que les membres avec des retards, triés desc', () => {
    const tasks = [
      task({ id: 'a', assigneeIds: ['u1'], deadline: dateStr(-2) }),
      task({ id: 'b', assigneeIds: ['u1'], deadline: dateStr(-5) }),
      task({ id: 'c', assigneeIds: ['u2'], deadline: dateStr(3) }), // future → pas en retard
    ];
    const res = overdueByMember(tasks, members);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ userId: 'u1', count: 2 });
  });
});

describe('projectBreakdown', () => {
  const projects: TeamProject[] = [
    { id: 'p1', orgId: 'o', name: 'Site', color: 'blue', createdBy: 'u1', createdAt: iso(30), archivedAt: null },
    { id: 'p2', orgId: 'o', name: 'Archivé', color: 'red', createdBy: 'u1', createdAt: iso(30), archivedAt: iso(1) },
    { id: 'p3', orgId: 'o', name: 'Vide', color: 'green', createdBy: 'u1', createdAt: iso(30), archivedAt: null },
  ];
  it('exclut projets archivés et sans tâche', () => {
    const tasks = [
      task({ id: 'a', projectId: 'p1', completed: false, deadline: dateStr(-1) }),
      task({ id: 'b', projectId: 'p1', completed: true }),
      task({ id: 'c', projectId: 'p2', completed: false }),
    ];
    const res = projectBreakdown(tasks, projects);
    expect(res.map((p) => p.id)).toEqual(['p1']);
    expect(res[0]).toMatchObject({ open: 1, overdue: 1, total: 2 });
  });
});

describe('velocityByWeek', () => {
  it('compte les complétions dans chaque semaine', () => {
    const tasks = [
      task({ id: 'a', completed: true, completedAt: iso(3) }),
      task({ id: 'b', completed: true, completedAt: iso(4) }),
      task({ id: 'c', completed: true, completedAt: iso(10) }),
      task({ id: 'd', completed: false, completedAt: null }),
    ];
    const v = velocityByWeek(tasks, periodStart('30', NOW), NOW);
    const totalCompleted = v.reduce((s, w) => s + w.completed, 0);
    expect(totalCompleted).toBe(3);
    expect(v.length).toBeGreaterThan(0);
  });
});

describe('completionTrend', () => {
  it('progresse vers le taux courant', () => {
    const tasks = [
      task({ id: 'a', createdAt: iso(20), completed: true, completedAt: iso(2) }),
      task({ id: 'b', createdAt: iso(20), completed: false }),
    ];
    const trend = completionTrend(tasks, periodStart('30', NOW), NOW);
    expect(trend.length).toBeGreaterThan(0);
    // Dernière semaine : 1 terminée / 2 créées = 50 %
    expect(trend[trend.length - 1].rate).toBe(50);
    // Première semaine (avant toute création) : 0 %
    expect(trend[0].rate).toBe(0);
  });
});
