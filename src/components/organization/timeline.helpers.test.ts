import { describe, it, expect } from 'vitest';
import {
  timelineRange, timelineWeeks, timelineRows, todayOffsetPercent,
  timelineWindow, timelineMonths, timelineRowsByAssignee, inWindowOrUnscheduled,
  UNASSIGNED_ID,
} from './timeline.helpers';
import type { TeamTask, TeamProject } from '@/modules/team-projects';

// Horloge figée : sans `now` injecté, ces cas pourriraient avec le temps
// (leçon de team-stats.helpers, audit archi 2026-08-07 H6).
const NOW = new Date(2026, 6, 15); // mercredi 15 juillet 2026

const task = (over: Partial<TeamTask>): TeamTask => ({
  id: 't1', orgId: 'o', projectId: 'p1', name: 'T', priority: 3,
  deadline: '', assigneeIds: [], createdBy: 'u1', completed: false, status: 'todo',
  createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
  ...over,
});

const project = (over: Partial<TeamProject>): TeamProject => ({
  id: 'p1', orgId: 'o', name: 'Projet', color: 'blue',
  createdBy: 'u1', createdAt: '2026-07-01T00:00:00Z', ...over,
});

const differenceInWeeks = (range: { start: Date; end: Date }): number =>
  Math.round((range.end.getTime() - range.start.getTime()) / (7 * 24 * 60 * 60 * 1000));

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

  it('garde un projet dont toutes les tâches ouvertes sont sans date (point 1)', () => {
    const rows = timelineRows(
      [task({ id: 'a', deadline: '' }), task({ id: 'b', deadline: '' })],
      [project({})],
      range,
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].markers).toHaveLength(0);
    expect(rows[0].unscheduled.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('sépare jalons datés et tâches sans date sur le même projet', () => {
    const rows = timelineRows(
      [task({ id: 'dated', deadline: '2026-07-20' }), task({ id: 'nodate', deadline: '' })],
      [project({})],
      range,
      NOW,
    );
    expect(rows[0].markers.map((m) => m.task.id)).toEqual(['dated']);
    expect(rows[0].unscheduled.map((t) => t.id)).toEqual(['nodate']);
  });
});

describe('timelineWindow', () => {
  const full = timelineRange([task({ deadline: '2027-03-01' })], NOW);

  it('« all » renvoie la fenêtre complète telle quelle', () => {
    expect(timelineWindow(full, 'all', NOW)).toEqual(full);
  });

  it('« default » couvre 8 semaines, « month » 4, « quarter » 13', () => {
    expect(timelineWindow(full, 'default', NOW).days).toBe(8 * 7);
    expect(timelineWindow(full, 'month', NOW).days).toBe(4 * 7);
    expect(timelineWindow(full, 'quarter', NOW).days).toBe(13 * 7);
  });

  it('reste ancré près d\'aujourd\'hui même si la fenêtre complète part loin dans le passé', () => {
    const past = timelineRange([task({ deadline: '2025-01-01' })], NOW);
    const win = timelineWindow(past, 'default', NOW);
    // Aujourd'hui (15 juillet 2026) doit rester dans la fenêtre bornée.
    expect(win.start.getTime()).toBeLessThanOrEqual(NOW.getTime());
    expect(win.end.getTime()).toBeGreaterThanOrEqual(NOW.getTime());
    expect(differenceInWeeks(win)).toBeLessThanOrEqual(9);
  });
});

describe('inWindowOrUnscheduled', () => {
  const win = timelineWindow(timelineRange([], NOW), 'default', NOW);

  it('garde toujours une tâche sans date', () => {
    expect(inWindowOrUnscheduled(task({ deadline: '' }), win)).toBe(true);
  });

  it('garde une tâche datée dans la fenêtre', () => {
    expect(inWindowOrUnscheduled(task({ deadline: '2026-07-20' }), win)).toBe(true);
  });

  it('écarte une tâche datée hors fenêtre', () => {
    expect(inWindowOrUnscheduled(task({ deadline: '2030-01-01' }), win)).toBe(false);
  });
});

describe('timelineMonths', () => {
  it('ne produit rien sous ~6 semaines', () => {
    expect(timelineMonths(timelineRange([], NOW))).toHaveLength(0);
  });

  it('produit un bandeau par mois couvert au-delà de 6 semaines', () => {
    const wide = timelineWindow(timelineRange([], NOW), 'quarter', NOW);
    const months = timelineMonths(wide);
    expect(months.length).toBeGreaterThan(1);
    expect(months[0].offsetPercent).toBe(0);
  });
});

describe('timelineRowsByAssignee', () => {
  const activeIds = new Set(['p1']);
  const range = timelineRange([task({ deadline: '2026-07-20' })], NOW);

  it('place une tâche datée sur la ligne de son assigné', () => {
    const rows = timelineRowsByAssignee(
      [task({ id: 'a', deadline: '2026-07-20', assigneeIds: ['u1'] })],
      activeIds,
      range,
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].assigneeId).toBe('u1');
    expect(rows[0].markers[0].task.id).toBe('a');
  });

  it('duplique une tâche multi-assignée sur chaque ligne, comme le Tableau', () => {
    const rows = timelineRowsByAssignee(
      [task({ id: 'a', deadline: '2026-07-20', assigneeIds: ['u1', 'u2'] })],
      activeIds,
      range,
      NOW,
    );
    expect(rows.map((r) => r.assigneeId).sort()).toEqual(['u1', 'u2']);
  });

  it('regroupe les tâches sans assigné sous UNASSIGNED_ID', () => {
    const rows = timelineRowsByAssignee(
      [task({ id: 'a', deadline: '2026-07-20', assigneeIds: [] })],
      activeIds,
      range,
      NOW,
    );
    expect(rows[0].assigneeId).toBe(UNASSIGNED_ID);
  });

  it('ignore les tâches de projets hors périmètre', () => {
    const rows = timelineRowsByAssignee(
      [task({ id: 'a', projectId: 'other', deadline: '2026-07-20', assigneeIds: ['u1'] })],
      activeIds,
      range,
      NOW,
    );
    expect(rows).toHaveLength(0);
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
