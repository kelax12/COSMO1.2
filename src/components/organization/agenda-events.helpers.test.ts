import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dayTimeline, groupEventsByDay } from './agenda-events.helpers';
import type { CalendarEvent } from '@/modules/events';

const event = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: over.id ?? 'e1',
  title: 'Événement',
  start: '2026-08-27T10:00:00.000Z',
  end: '2026-08-27T11:00:00.000Z',
  ...over,
});

describe('groupEventsByDay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 27, 8, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('ne produit aucun groupe pour une liste vide', () => {
    expect(groupEventsByDay([])).toEqual([]);
  });

  it('regroupe deux événements du même jour local, ordre préservé', () => {
    const groups = groupEventsByDay([
      event({ id: 'a', start: '2026-08-27T08:30:00.000Z' }),
      event({ id: 'b', start: '2026-08-27T13:00:00.000Z' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].events.map((e) => e.id)).toEqual(['a', 'b']);
    expect(groups[0].isToday).toBe(true);
  });

  it("marque le jour courant, pas les suivants", () => {
    const groups = groupEventsByDay([
      event({ id: 'today', start: '2026-08-27T08:30:00.000Z' }),
      event({ id: 'later', start: '2026-09-04T09:00:00.000Z' }),
    ]);
    expect(groups.map((g) => g.isToday)).toEqual([true, false]);
  });

  it('ouvre un nouveau groupe à chaque changement de jour, même non consécutifs dans la liste triée', () => {
    const groups = groupEventsByDay([
      event({ id: 'a', start: '2026-08-27T08:00:00.000Z' }),
      event({ id: 'b', start: '2026-08-28T08:00:00.000Z' }),
      event({ id: 'c', start: '2026-08-28T20:00:00.000Z' }),
      event({ id: 'd', start: '2026-09-01T08:00:00.000Z' }),
    ]);
    expect(groups.map((g) => g.dayKey)).toEqual(['2026-08-27', '2026-08-28', '2026-09-01']);
    expect(groups[1].events.map((e) => e.id)).toEqual(['b', 'c']);
  });
});

describe('dayTimeline (maquette 5 B)', () => {
  // Dates LOCALES : la frise lit l'heure murale de la personne.
  const at = (h: number, m = 0) => new Date(2026, 9, 2, h, m).toISOString();

  it('fenêtre 8 h à 19 h par défaut, positions en pourcentage, maintenant placé', () => {
    const out = dayTimeline([event({ start: at(10), end: at(11) })], new Date(2026, 9, 2, 13, 30));
    expect([out.fromHour, out.toHour]).toEqual([8, 19]);
    expect(out.blocks[0]!.left).toBeCloseTo((2 / 11) * 100);
    expect(out.blocks[0]!.width).toBeCloseTo((1 / 11) * 100);
    expect(out.now).toBeCloseTo((5.5 / 11) * 100);
  });

  it("s'élargit pour un rendez-vous matinal ou tardif, et masque « maintenant » hors fenêtre", () => {
    const out = dayTimeline([event({ start: at(6, 30), end: at(7) }), event({ id: 'e2', start: at(20), end: at(21, 15) })], new Date(2026, 9, 2, 23, 30));
    expect([out.fromHour, out.toHour]).toEqual([6, 22]);
    expect(out.now).toBeNull();
  });

  it('un événement sans durée garde une largeur minimale', () => {
    const out = dayTimeline([event({ start: at(12), end: at(12) })], new Date(2026, 9, 2, 9));
    expect(out.blocks[0]!.width).toBeGreaterThanOrEqual(3);
  });
});