import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { groupEventsByDay } from './agenda-events.helpers';
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
