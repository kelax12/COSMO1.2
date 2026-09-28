import { describe, expect, it } from 'vitest';
import {
  aggregateReports,
  groupTasksByProject,
  normalizePayload,
  periodBounds,
  shiftPeriod,
  lastReportDay,
} from './aggregate';
import type { ActivityReportPayload, DailyActivityReport } from './types';

const payload = (over: Partial<ActivityReportPayload>): ActivityReportPayload => ({
  version: 1, tasks: [], projects: [], krs: [], events: [], teams: [], truncated: false, ...over,
});

const task = (id: string, at: string, projectId: string | null = 'p1') => ({
  id, name: id, projectId, projectName: projectId ? `Projet ${projectId}` : null, projectColor: 'blue',
  byId: 'u1', byName: 'Chloé', at,
});

describe('aggregateReports', () => {
  it('garde le « avant » du premier jour et le « après » du dernier, et additionne les tâches du jour', () => {
    const days: DailyActivityReport[] = [
      { day: '2026-09-22', payload: payload({ projects: [{ id: 'p1', name: 'A', color: 'blue', done: 2, total: 10, completedToday: 2, before: 0, after: 20 }] }) },
      { day: '2026-09-24', payload: payload({ projects: [{ id: 'p1', name: 'A', color: 'blue', done: 5, total: 10, completedToday: 3, before: 20, after: 50 }] }) },
    ];
    const r = aggregateReports(days, '2026-09-22', '2026-09-28');
    expect(r.projects).toEqual([{ id: 'p1', name: 'A', color: 'blue', done: 5, total: 10, completedToday: 5, before: 0, after: 50 }]);
    expect(r.daysCovered).toBe(2);
  });

  it('ignore les journées hors période et trie les tâches dans le temps', () => {
    const days: DailyActivityReport[] = [
      { day: '2026-09-21', payload: payload({ tasks: [task('hors', '2026-09-21T10:00:00Z')] }) },
      { day: '2026-09-23', payload: payload({ tasks: [task('b', '2026-09-23T15:00:00Z')] }) },
      { day: '2026-09-22', payload: payload({ tasks: [task('a', '2026-09-22T09:00:00Z')] }) },
    ];
    expect(aggregateReports(days, '2026-09-22', '2026-09-28').tasks.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('un KR sans « avant » connu reprend celui d’un jour suivant, et reste atteint une fois atteint', () => {
    const kr = { id: 'k', title: 'K', okrTitle: 'O', unit: null, value: 1, target: 10 };
    const days: DailyActivityReport[] = [
      { day: '2026-09-22', payload: payload({ krs: [{ ...kr, before: null, after: 100, completed: true }] }) },
      { day: '2026-09-23', payload: payload({ krs: [{ ...kr, before: 40, after: 60, completed: false }] }) },
    ];
    const [k] = aggregateReports(days, '2026-09-22', '2026-09-23').krs;
    expect(k.before).toBe(40);
    expect(k.completed).toBe(true);
  });

  it('additionne les tâches de chaque équipe', () => {
    const team = { id: 't', name: 'Design', color: '#6366f1' };
    const days: DailyActivityReport[] = [
      { day: '2026-09-22', payload: payload({ teams: [{ ...team, tasksDone: 2 }] }) },
      { day: '2026-09-23', payload: payload({ teams: [{ ...team, tasksDone: 3 }] }) },
    ];
    expect(aggregateReports(days, '2026-09-22', '2026-09-23').teams[0].tasksDone).toBe(5);
  });
});

describe('groupTasksByProject', () => {
  it('met le projet le plus actif en tête et « sans projet » en dernier', () => {
    const groups = groupTasksByProject([
      task('x', '2026-09-22T09:00:00Z', null),
      task('a', '2026-09-22T09:00:00Z', 'p1'),
      task('b', '2026-09-22T10:00:00Z', 'p2'),
      task('c', '2026-09-22T11:00:00Z', 'p2'),
    ]);
    expect(groups.map((g) => g.projectId)).toEqual(['p2', 'p1', null]);
  });
});

describe('normalizePayload', () => {
  it('rend une journée vide pour un payload illisible, jamais une exception', () => {
    expect(normalizePayload(null)).toEqual(payload({}));
    expect(normalizePayload({ tasks: 'x', truncated: 'oui' }).tasks).toEqual([]);
  });
});

describe('périodes', () => {
  it('une semaine va du lundi au dimanche', () => {
    expect(periodBounds('week', '2026-09-27')).toEqual({ from: '2026-09-21', to: '2026-09-27' });
    expect(periodBounds('week', '2026-09-21')).toEqual({ from: '2026-09-21', to: '2026-09-27' });
  });

  it('un mois couvre ses jours, février compris', () => {
    expect(periodBounds('month', '2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('décale d’un cran sans déborder sur le mois suivant', () => {
    expect(shiftPeriod('month', '2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftPeriod('day', '2026-03-01', -1)).toBe('2026-02-28');
  });

  it('la dernière journée générée est hier', () => {
    expect(lastReportDay(new Date(2026, 8, 28, 0, 30))).toBe('2026-09-27');
  });
});
