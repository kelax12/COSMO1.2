import { describe, it, expect } from 'vitest';
import {
  horizonOf,
  groupByHorizon,
  computeBlocking,
  dependentIdsOf,
  reviewsForMe,
  unreadMentions,
  summarizeMyProjects,
  myKeyResults,
  buildActivityItems,
  activityDigest,
  weekLoad,
  waitingOnOthers,
  dependencyIdsOf,
  projectPeople,
  projectElapsed,
} from './my-work.helpers';
import type { TeamProject, TeamTask, TeamTaskActivity } from '@/modules/team-projects';
import type { TeamOKR } from '@/modules/team-okrs';
import type { OrgNotification } from '@/modules/organizations';

// Mercredi 24 septembre 2026, 10 h, heure locale.
const NOW = new Date(2026, 8, 24, 10, 0);
const ME = 'me';

const task = (over: Partial<TeamTask>): TeamTask => ({
  id: 't1',
  orgId: 'o1',
  projectId: 'p1',
  name: 'Tâche',
  priority: 3,
  completed: false,
  status: 'todo',
  assigneeIds: [ME],
  createdBy: 'boss',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
  ...over,
});

const project = (over: Partial<TeamProject>): TeamProject => ({
  id: 'p1', orgId: 'o1', name: 'Site', color: 'blue', createdBy: 'boss', createdAt: '2026-01-01', ...over,
});

describe('horizonOf / groupByHorizon', () => {
  it('range par échéance locale : retard, aujourd hui, 7 jours, plus tard, sans date', () => {
    expect(horizonOf(task({ deadline: '2026-09-23' }), NOW)).toBe('overdue');
    expect(horizonOf(task({ deadline: '2026-09-24' }), NOW)).toBe('today');
    expect(horizonOf(task({ deadline: '2026-09-30' }), NOW)).toBe('week');
    expect(horizonOf(task({ deadline: '2026-10-01' }), NOW)).toBe('later');
    expect(horizonOf(task({ deadline: '' }), NOW)).toBe('undated');
  });

  it('ne rend que les groupes non vides, dans l ordre d urgence', () => {
    const groups = groupByHorizon(
      [task({ id: 'a', deadline: '2026-10-09' }), task({ id: 'b', deadline: '2026-09-20' })],
      NOW,
    );
    expect(groups.map((g) => g.horizon)).toEqual(['overdue', 'later']);
  });
});

describe('computeBlocking', () => {
  const mine = task({ id: 'm1' });
  const deps = [
    { taskId: 'x1', dependsOnId: 'm1' },
    { taskId: 'x2', dependsOnId: 'm1' },
    { taskId: 'x3', dependsOnId: 'm1' },
    { taskId: 'x4', dependsOnId: 'other' },
  ];
  const dependents = [
    task({ id: 'x1', assigneeIds: ['bob'] }),
    task({ id: 'x2', assigneeIds: ['bob'], completed: true }),
    task({ id: 'x3', assigneeIds: [ME, 'bob'] }),
  ];

  it('nomme les tâches ouvertes des AUTRES qui attendent la mienne', () => {
    const out = computeBlocking([mine], deps, dependents, ME);
    expect(out).toHaveLength(1);
    expect(out[0].mine.id).toBe('m1');
    // x2 terminée, x3 aussi à moi : ni l une ni l autre ne m attend.
    expect(out[0].waiting.map((t) => t.id)).toEqual(['x1']);
  });

  it('les ids à lire sont triés et dédoublonnés (clé de cache stable)', () => {
    expect(dependentIdsOf([mine], [...deps, { taskId: 'x1', dependsOnId: 'm1' }])).toEqual(['x1', 'x2', 'x3']);
  });
});

describe('reviewsForMe', () => {
  it('garde les tâches en revue que j ai créées pour quelqu un d autre', () => {
    const out = reviewsForMe(
      [
        task({ id: 'r1', status: 'review', createdBy: ME, assigneeIds: ['bob'] }),
        task({ id: 'r2', status: 'review', createdBy: ME, assigneeIds: [ME] }),
        task({ id: 'r3', status: 'in_progress', createdBy: ME, assigneeIds: ['bob'] }),
      ],
      ME,
    );
    expect(out.map((t) => t.id)).toEqual(['r1']);
  });
});

describe('unreadMentions', () => {
  const n = (over: Partial<OrgNotification>): OrgNotification => ({
    id: 'n', orgId: 'o1', actorId: 'bob', kind: 'mention', taskId: 't1', readAt: null, createdAt: '2026-09-20', ...over,
  });
  it('une par tâche, la plus récente, non lues seulement', () => {
    const out = unreadMentions([
      n({ id: 'a', createdAt: '2026-09-20' }),
      n({ id: 'b', createdAt: '2026-09-22' }),
      n({ id: 'c', taskId: 't2', readAt: '2026-09-23' }),
      n({ id: 'd', taskId: 't3', kind: 'comment' }),
    ]);
    expect(out.map((x) => x.id)).toEqual(['b']);
  });
});

describe('summarizeMyProjects', () => {
  it('trie par retards puis échéance, ignore les projets archivés', () => {
    const out = summarizeMyProjects(
      [
        task({ id: 'a', projectId: 'p1', deadline: '2026-10-10' }),
        task({ id: 'b', projectId: 'p2', deadline: '2026-09-01' }),
        task({ id: 'c', projectId: 'p3' }),
      ],
      [project({ id: 'p1' }), project({ id: 'p2' }), project({ id: 'p3', archivedAt: '2026-09-01' })],
      NOW,
    );
    expect(out.map((s) => s.project.id)).toEqual(['p2', 'p1']);
    expect(out[0]).toMatchObject({ open: 1, overdue: 1, nextDeadline: null });
    expect(out[1]).toMatchObject({ open: 1, overdue: 0, nextDeadline: '2026-10-10' });
  });
});

describe('myKeyResults', () => {
  it('KR ouverts qui me sont assignés, progression bornée, cible nulle = 0 % (B17)', () => {
    const okr = {
      id: 'o', orgId: 'o1', title: 'Obj', createdBy: 'boss', createdAt: '', teamIds: [],
      keyResults: [
        { id: 'k1', okrId: 'o', orgId: 'o1', title: 'A', currentValue: 150, targetValue: 100, assigneeId: ME, completed: false },
        { id: 'k2', okrId: 'o', orgId: 'o1', title: 'B', currentValue: 5, targetValue: 0, assigneeId: ME, completed: false },
        { id: 'k3', okrId: 'o', orgId: 'o1', title: 'C', currentValue: 1, targetValue: 2, assigneeId: 'bob', completed: false },
        { id: 'k4', okrId: 'o', orgId: 'o1', title: 'D', currentValue: 2, targetValue: 2, assigneeId: ME, completed: true },
      ],
    } as TeamOKR;
    const out = myKeyResults([okr], ME);
    expect(out.map((x) => [x.kr.id, x.percent])).toEqual([['k2', 0], ['k1', 100]]);
  });
});

describe('buildActivityItems', () => {
  const e = (over: Partial<TeamTaskActivity>): TeamTaskActivity => ({
    id: 'e', taskId: 't1', orgId: 'o1', actorId: 'bob', field: 'status', oldValue: 'todo', newValue: 'done',
    createdAt: '2026-09-20T10:00:00.000Z', ...over,
  });

  it('lit le journal : terminée, rouverte, réassignée, reportée ; écarte le bruit', () => {
    const items = buildActivityItems(
      [
        e({ id: '1', createdAt: '2026-09-20T01:00:00.000Z' }),
        e({ id: '2', oldValue: 'done', newValue: 'todo', createdAt: '2026-09-20T02:00:00.000Z' }),
        e({ id: '3', field: 'assignees', oldValue: 'a', newValue: 'a,b', createdAt: '2026-09-20T03:00:00.000Z' }),
        e({ id: '4', field: 'assignees', oldValue: 'a,b', newValue: 'a', createdAt: '2026-09-20T04:00:00.000Z' }),
        e({ id: '5', field: 'deadline', oldValue: '2026-09-20', newValue: '2026-09-27', createdAt: '2026-09-20T05:00:00.000Z' }),
        e({ id: '6', field: 'priority', oldValue: '3', newValue: '1', createdAt: '2026-09-20T06:00:00.000Z' }),
        // Création : une ligne du journal (mig. 181), plus une tâche relue.
        e({ id: '7', taskId: 'new', field: 'created', oldValue: null, newValue: null, createdAt: '2026-09-20T07:00:00.000Z' }),
      ],
    );
    expect(items.map((i) => i.kind)).toEqual(['created', 'postponed', 'assigned', 'reopened', 'completed']);
    expect(items.find((i) => i.kind === 'assigned')?.addedIds).toEqual(['b']);
    expect(items[0]).toMatchObject({ taskId: 'new', actorId: 'bob' });
  });

  // TÉMOIN : une seule source. Sans ligne de journal, aucune création n'apparaît,
  // même si une tâche récente existe quelque part.
  it("n'invente aucune création hors du journal", () => {
    expect(buildActivityItems([])).toEqual([]);
  });
});

describe('activityDigest (maquette 8 C)', () => {
  const e = (over: Partial<TeamTaskActivity>): TeamTaskActivity => ({
    id: Math.random().toString(36), taskId: 't1', orgId: 'o1', actorId: 'bob', field: 'status', oldValue: 'todo', newValue: 'done',
    createdAt: '2026-09-24T08:00:00.000Z', ...over,
  });
  it('compte sur le journal brut des 24 h, et ce que d autres ont fait sur mes tâches', () => {
    const since = new Date('2026-09-23T10:00:00.000Z');
    const out = activityDigest(
      [
        e({ taskId: 'mine' }),
        e({ taskId: 'other' }),
        e({ field: 'created', oldValue: null, newValue: null, taskId: 'mine', actorId: ME }),
        e({ createdAt: '2026-09-20T08:00:00.000Z' }),
      ],
      new Set(['mine']),
      ME,
      since,
    );
    expect(out).toEqual({ completed: 2, created: 1, aboutMe: 1 });
  });
  it('ne tronque pas à 8 comme le fil', () => {
    const many = Array.from({ length: 12 }, () => e({}));
    expect(activityDigest(many, new Set(), ME, new Date('2026-09-23T00:00:00.000Z')).completed).toBe(12);
  });
});

describe('weekLoad (N1)', () => {
  it('somme les estimations des retards et des sept jours, signale les tâches sans estimation', () => {
    const out = weekLoad(
      [
        task({ id: 'a', deadline: '2026-09-23', estimatedTime: 60 }),
        task({ id: 'b', deadline: '2026-09-26', estimatedTime: 30 }),
        task({ id: 'c', deadline: '2026-09-25' }),
        task({ id: 'd', deadline: '2026-10-20', estimatedTime: 600 }),
        task({ id: 'e', estimatedTime: 600 }),
      ],
      NOW,
    );
    expect(out).toEqual({ minutes: 90, unestimated: 1, tasks: 3 });
  });
});

describe('waitingOnOthers (N2)', () => {
  // Relatif à NOW (heure LOCALE) : une date UTC écrite en dur décale d'un jour selon le fuseau.
  const daysBefore = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
  const mine = task({ id: 'm1' });
  it('remonte la tâche d autrui dont la mienne dépend, et ce que j ai confié qui dort', () => {
    const theirs = task({ id: 'x1', assigneeIds: ['bob'], updatedAt: daysBefore(1) });
    const stale = task({ id: 'd1', assigneeIds: ['ann'], createdBy: ME, updatedAt: daysBefore(7) });
    const fresh = task({ id: 'd2', assigneeIds: ['ann'], createdBy: ME, updatedAt: daysBefore(1) });
    const out = waitingOnOthers([mine], [{ taskId: 'm1', dependsOnId: 'x1' } as never], [theirs], [stale, fresh], ME, NOW);
    expect(out.map((w) => [w.task.id, w.reason, w.idleDays])).toEqual([['x1', 'blocked', 1], ['d1', 'delegated', 7]]);
  });
  it('exclut ce qui est en revue (la balle est chez moi), terminé, ou à moi', () => {
    const review = task({ id: 'r', assigneeIds: ['ann'], createdBy: ME, status: 'review' });
    const done = task({ id: 'f', assigneeIds: ['ann'], createdBy: ME, completed: true });
    const self = task({ id: 's', createdBy: ME });
    const unassigned = task({ id: 'u', assigneeIds: [], createdBy: ME });
    expect(waitingOnOthers([], [], [], [review, done, self, unassigned], ME, NOW)).toEqual([]);
  });
  it('dependencyIdsOf lit l arête dans le sens « ma tâche dépend de »', () => {
    expect(dependencyIdsOf([mine], [{ taskId: 'm1', dependsOnId: 'z' }, { taskId: 'z', dependsOnId: 'm1' }] as never)).toEqual(['z']);
  });
});

describe('projectPeople / projectElapsed (maquette 7 C)', () => {
  it('autres assignés par projet, moi exclu, trois au plus', () => {
    const out = projectPeople(
      [task({ assigneeIds: [ME, 'a', 'b'] }), task({ id: 't2', assigneeIds: ['c', 'd'] }), task({ id: 't3', projectId: 'p2' })],
      ME,
    );
    expect(out.get('p1')).toEqual(['a', 'b', 'c']);
    expect(out.get('p2')).toEqual([]);
  });
  it('part du calendrier écoulée, bornée ; null sans dates ou dates incohérentes', () => {
    expect(projectElapsed('2026-09-14', '2026-10-04', NOW)).toBe(52);
    expect(projectElapsed('2026-10-01', '2026-10-04', NOW)).toBe(0);
    expect(projectElapsed('2026-01-01', '2026-02-01', NOW)).toBe(100);
    expect(projectElapsed(null, '2026-10-04', NOW)).toBeNull();
    expect(projectElapsed('2026-10-04', '2026-10-01', NOW)).toBeNull();
  });
});