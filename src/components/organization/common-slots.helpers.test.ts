import { describe, expect, it } from 'vitest';
import { busyFromEvents, findCommonSlots } from './common-slots.helpers';

// Jeudi 1er octobre 2026, 08:00 locale.
const from = new Date(2026, 9, 1, 8, 0);
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);

describe('findCommonSlots', () => {
  it('propose le début de journée quand personne n est occupé', () => {
    const slots = findCommonSlots([[], []], { from, days: 1, durationMin: 60 });
    expect(slots[0].start).toEqual(at(1, 9));
    expect(slots[0].end).toEqual(at(1, 10));
  });

  it('contourne l occupation de N IMPORTE QUEL participant', () => {
    const slots = findCommonSlots(
      [[{ start: at(1, 9), end: at(1, 10) }], [{ start: at(1, 10), end: at(1, 11, 30) }]],
      { from, days: 1, durationMin: 60 },
    );
    expect(slots[0].start).toEqual(at(1, 11, 30));
  });

  it('saute le week-end', () => {
    // Samedi 3 octobre 2026.
    const slots = findCommonSlots([[]], { from: at(3, 8), days: 2, durationMin: 30 });
    expect(slots).toEqual([]);
  });

  it('ne propose jamais un créneau déjà passé', () => {
    const slots = findCommonSlots([[]], { from: at(1, 14, 10), days: 1, durationMin: 30 });
    expect(slots[0].start).toEqual(at(1, 14, 30));
  });

  it('ne déborde pas de la fin de journée', () => {
    const slots = findCommonSlots([[{ start: at(1, 9), end: at(1, 17, 30) }]], { from, days: 1, durationMin: 60 });
    expect(slots).toEqual([]);
  });

  it('respecte la limite', () => {
    expect(findCommonSlots([[]], { from, days: 10, durationMin: 30, limit: 3 })).toHaveLength(3);
  });
});

describe('busyFromEvents', () => {
  const win = [new Date(2026, 9, 1, 0, 0), new Date(2026, 9, 3, 0, 0)] as const;
  const iso = (d: number, h: number) => new Date(2026, 9, d, h).toISOString();

  it('garde un événement ponctuel qui chevauche la fenêtre, écarte les autres', () => {
    const busy = busyFromEvents([
      { start: iso(1, 9), end: iso(1, 10) },
      { start: iso(5, 9), end: iso(5, 10) },
    ], ...win);
    expect(busy).toHaveLength(1);
  });

  it('déplie une récurrence quotidienne née AVANT la fenêtre', () => {
    const busy = busyFromEvents([{ start: new Date(2026, 8, 1, 9).toISOString(), end: new Date(2026, 8, 1, 10).toISOString(), recurrence: 'daily' }], ...win);
    expect(busy.map((b) => b.start.getDate())).toEqual([1, 2]);
    expect(busy[0].start.getHours()).toBe(9);
  });

  it('respecte les jours cochés et les exceptions', () => {
    // 1er oct. 2026 = jeudi (4), 2 oct. = vendredi (5).
    const ev = { start: new Date(2026, 8, 3, 9).toISOString(), end: new Date(2026, 8, 3, 10).toISOString(), recurrence: 'custom' as const, recurrenceDays: [5] };
    expect(busyFromEvents([ev], ...win).map((b) => b.start.getDate())).toEqual([2]);
    const key = new Date(2026, 9, 2, 9).toISOString().split('T')[0];
    expect(busyFromEvents([{ ...ev, exceptions: [key] }], ...win)).toEqual([]);
  });
});
