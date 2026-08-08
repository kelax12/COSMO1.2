import { describe, it, expect } from 'vitest';
import {
  timelineRange, timelineWeeks, timelineRows, todayOffsetPercent,
} from './timeline.helpers';
import type { TeamTask, TeamProject } from '@/modules/team-projects';

// Horloge figée : sans `now` injecté, ces cas pourriraient avec le temps
// (leçon de team-stats.helpers, audit archi 2026-08-07 H6).
const NOW = new Date(2026, 6, 15); // mercredi 15 juillet 2026

const task = (over: Partial<TeamTask>): TeamTask => ({
  id: 't1', orgId: 'o', projectId: 'p1', name: 'T', priority: 3,
  deadline: '', assigneeIds: [], createdBy: 'u1', completed: false,
  createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
  ...over,
});

const project = (over: Partial<TeamProject>): TeamProject => ({
  id: 'p1', orgId: 'o', name: 'Projet', color: 'blue',
  createdBy: 'u1', createdAt: '2026-07-01T00:00:00Z', ...over,
});

describe('timelineRange', () => {
  it('couvre au minimum 4 semaines', () => {
    const range = timelineRange([], NOW);
    expect(range.days).toBeGreaterThanOrEqual(28);
  });

  it('commence un lundi', () => {
    expect(timelineRange([], NOW).start.getDay()).toBe(1);
  });

  it("s'étend jusqu'à couvrir l'échéance la plus lointaine", () => {
    const range = timelineRange([task({ deadline: '2026-10-01' })], NOW);
    expect(range.end.getTime()).toBeGreaterThanOrEqual(new Date('2026-10-01').getTime());
  });

  it('remonte avant aujourd\'hui si une échéance est passée', () => {
    const range = timelineRange([task({ deadline: '2026-06-01' })], NOW);
    expect(range.start.getTime()).toBeLessThanOrEqual(new Date(2026, 5, 1).getTime());
  });

  it('ignore les tâches terminées pour dimensionner la fenêtre', () => {
    const withDone = timelineRange(
      [task({ deadline: '2027-12-31', completed: true })],
      NOW,
    );
    expect(withDone.days).toBe(timelineRange([], NOW).days);
  });

  it('ignore une deadline illisible', () => {
    expect(() => timelineRange([task({ deadline: 'pas-une-date' })], NOW)).not.toThrow();
  });
});

describe('timelineWeeks', () => {
  it('produit une colonne par semaine', () => {
    const range = timelineRange([], NOW);
    expect(timelineWeeks(range)).toHaveLength(4);
  });

  it('commence à 0 %', () => {
    const weeks = timelineWeeks(timelineRange([], NOW));
    expect(weeks[0].offsetPercent).toBe(0);
  });

  it('produit des offsets croissants', () => {
    const weeks = timelineWeeks(timelineRange([], NOW));
    const offsets = weeks.map((w) => w.offsetPercent);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
  });
});

describe('timelineRows', () => {
  const range = timelineRange([task({ deadline: '2026-07-20' })], NOW);

  it('place une tâche datée sur la ligne de son projet', () => {
    const rows = timelineRows(
      [task({ id: 'a', deadline: '2026-07-20' })],
      [project({})],
      range,
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].markers).toHaveLength(1);
    expect(rows[0].markers[0].task.id).toBe('a');
  });

  it('écarte les projets sans aucune échéance', () => {
    const rows = timelineRows([], [project({})], range, NOW);
    expect(rows).toHaveLength(0);
  });

  it('écarte les projets archivés', () => {
    const rows = timelineRows(
      [task({ deadline: '2026-07-20' })],
      [project({ archivedAt: '2026-07-01T00:00:00Z' })],
      range,
      NOW,
    );
    expect(rows).toHaveLength(0);
  });

  it('exclut les tâches terminées', () => {
    const rows = timelineRows(
      [task({ deadline: '2026-07-20', completed: true })],
      [project({})],
      range,
      NOW,
    );
    expect(rows).toHaveLength(0);
  });

  it('marque en retard une échéance passée', () => {
    const wide = timelineRange([task({ deadline: '2026-07-01' })], NOW);
    const rows = timelineRows(
      [task({ id: 'late', deadline: '2026-07-01' })],
      [project({})],
      wide,
      NOW,
    );
    expect(rows[0].markers[0].overdue).toBe(true);
  });

  it("ne marque pas en retard une échéance du jour", () => {
    const rows = timelineRows(
      [task({ id: 'today', deadline: '2026-07-15' })],
      [project({})],
      range,
      NOW,
    );
    expect(rows[0].markers[0].overdue).toBe(false);
  });

  it('trie les jalons par date croissante', () => {
    const rows = timelineRows(
      [
        task({ id: 'late', deadline: '2026-07-28' }),
        task({ id: 'early', deadline: '2026-07-16' }),
      ],
      [project({})],
      timelineRange([task({ deadline: '2026-07-28' })], NOW),
      NOW,
    );
    expect(rows[0].markers.map((m) => m.task.id)).toEqual(['early', 'late']);
  });

  it('borne les positions à [0, 100]', () => {
    const rows = timelineRows(
      [task({ id: 'far', deadline: '2030-01-01' })],
      [project({})],
      range,
      NOW,
    );
    expect(rows[0].markers[0].offsetPercent).toBeLessThanOrEqual(100);
    expect(rows[0].markers[0].offsetPercent).toBeGreaterThanOrEqual(0);
  });
});

describe('todayOffsetPercent', () => {
  it("situe aujourd'hui dans la fenêtre", () => {
    const offset = todayOffsetPercent(timelineRange([], NOW), NOW);
    expect(offset).not.toBeNull();
    expect(offset!).toBeGreaterThanOrEqual(0);
    expect(offset!).toBeLessThanOrEqual(100);
  });

  it("renvoie null quand aujourd'hui sort de la fenêtre", () => {
    const range = timelineRange([], NOW);
    expect(todayOffsetPercent(range, new Date(2027, 0, 1))).toBeNull();
  });
});
