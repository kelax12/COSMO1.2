import { describe, expect, it } from 'vitest';
import {
  buildHighlights, dailySeries, eventMinutes, previousPeriod, sortKrsByGain, sortProjectsByGain, trendOf,
} from './insights';
import { aggregateReports } from './aggregate';
import type { DailyActivityReport, ReportKr, ReportProject } from './types';

const project = (id: string, before: number, after: number): ReportProject => ({
  id, name: id, color: null, done: 0, total: 0, completedToday: 0, before, after,
});
const kr = (id: string, before: number | null, after: number, completed = false): ReportKr => ({
  id, title: id, okrTitle: 'O', unit: null, value: 0, target: 1, before, after, completed,
});
const day = (key: string, tasks: number, events: { start: string; end: string }[] = []): DailyActivityReport => ({
  day: key,
  payload: {
    version: 1,
    tasks: Array.from({ length: tasks }, (_, i) => ({
      id: `${key}-${i}`, name: 't', projectId: null, projectName: null, projectColor: null, byId: 'u', byName: 'U', at: `${key}T10:00:00Z`,
    })),
    projects: [], krs: [], teams: [], truncated: false,
    events: events.map((e) => ({ userId: 'u', userName: 'U', title: 'e', ...e })),
  },
});

describe('previousPeriod', () => {
  it('rend la période de même longueur juste avant', () => {
    expect(previousPeriod('2026-10-12', '2026-10-18')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
    expect(previousPeriod('2026-10-01', '2026-10-01')).toEqual({ from: '2026-09-30', to: '2026-09-30' });
  });
});

describe('trendOf', () => {
  it('ne compare rien sans période précédente', () => {
    expect(trendOf(5, null)).toBeNull();
  });
  it('rend un pourcentage arrondi, et null en partant de zéro', () => {
    expect(trendOf(42, 35)).toEqual({ delta: 7, percent: 20 });
    expect(trendOf(3, 0)).toEqual({ delta: 3, percent: null });
  });
});

describe('eventMinutes', () => {
  it('ne rend jamais une durée négative', () => {
    expect(eventMinutes({ start: '2026-10-01T10:00:00Z', end: '2026-10-01T11:30:00Z' })).toBe(90);
    expect(eventMinutes({ start: '2026-10-01T11:00:00Z', end: '2026-10-01T10:00:00Z' })).toBe(0);
  });
});

describe('dailySeries', () => {
  it('rend une valeur par jour, zéro les jours sans rapport', () => {
    const s = dailySeries([day('2026-10-01', 2), day('2026-10-03', 1, [{ start: '2026-10-03T09:00:00Z', end: '2026-10-03T10:00:00Z' }])], '2026-10-01', '2026-10-03');
    expect(s.tasks).toEqual([2, 0, 1]);
    expect(s.eventMinutes).toEqual([0, 0, 60]);
  });
});

describe('tri par gain', () => {
  it('met les projets terminés d abord, puis le plus gros gain', () => {
    const sorted = sortProjectsByGain([project('a', 10, 20), project('b', 60, 100), project('c', 0, 40)]);
    expect(sorted.map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });
  it('met les résultats clés atteints d abord', () => {
    const sorted = sortKrsByGain([kr('a', 10, 50), kr('b', null, 30, true), kr('c', 0, 5)]);
    expect(sorted.map((k) => k.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('buildHighlights', () => {
  it('ne compte comme terminé qu un projet qui a passé 100 % dans la période', () => {
    const report = { ...aggregateReports([], '2026-10-01', '2026-10-07'), projects: [project('a', 100, 100), project('b', 80, 100)] };
    expect(buildHighlights(report, null).projectsDone.map((p) => p.id)).toEqual(['b']);
  });
  it('rend la part de l équipe la plus active, seulement s il y en a plusieurs', () => {
    const base = aggregateReports([], '2026-10-01', '2026-10-07');
    const teams = [{ id: '1', name: 'Design', color: null, tasksDone: 3 }, { id: '2', name: 'Produit', color: null, tasksDone: 1 }];
    expect(buildHighlights({ ...base, teams }, null).topTeam).toEqual({ name: 'Design', share: 75 });
    expect(buildHighlights({ ...base, teams: teams.slice(0, 1) }, null).topTeam).toBeNull();
  });
});
