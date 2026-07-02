import { describe, it, expect } from 'vitest';
import { findNextFreeSlot } from './free-slot';

const at = (h: number, m = 0) => new Date(2026, 6, 1, h, m, 0, 0); // 1er juillet 2026
const iso = (h: number, m = 0) => at(h, m).toISOString();

describe('findNextFreeSlot', () => {
  it('sans événement → maintenant arrondi au quart d\'heure suivant', () => {
    const slot = findNextFreeSlot([], at(10, 7));
    expect(slot.start).toBe(iso(10, 15));
    expect(slot.end).toBe(iso(11, 15));
  });

  it('saute un événement en cours', () => {
    const slot = findNextFreeSlot(
      [{ start: iso(10, 0), end: iso(11, 30) }],
      at(10, 15)
    );
    expect(slot.start).toBe(iso(11, 30));
  });

  it('se glisse dans un trou suffisant entre deux événements', () => {
    const slot = findNextFreeSlot(
      [
        { start: iso(10, 0), end: iso(11, 0) },
        { start: iso(12, 30), end: iso(13, 0) },
      ],
      at(9, 50),
      60
    );
    // 10:00-11:00 occupé ; le trou 11:00-12:30 (90 min) suffit pour 60 min
    expect(slot.start).toBe(iso(11, 0));
  });

  it('trou trop petit → continue après l\'événement suivant', () => {
    const slot = findNextFreeSlot(
      [
        { start: iso(10, 0), end: iso(11, 0) },
        { start: iso(11, 30), end: iso(12, 0) },
      ],
      at(9, 55),
      60
    );
    // 11:00-11:30 = 30 min < 60 min → prochain créneau après 12:00
    expect(slot.start).toBe(iso(12, 0));
  });

  it('journée pleine → demain 9h', () => {
    const slot = findNextFreeSlot(
      [{ start: iso(8, 0), end: iso(23, 0) }],
      at(21, 45)
    );
    const start = new Date(slot.start);
    expect(start.getDate()).toBe(2);
    expect(start.getHours()).toBe(9);
  });
});
