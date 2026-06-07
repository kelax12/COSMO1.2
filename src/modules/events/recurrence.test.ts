import { describe, it, expect } from 'vitest';
import { expandRecurringEvents, getMasterId, isInstanceId } from './recurrence';
import type { CalendarEvent } from './types';

// Build a CalendarEvent from a partial. Dates are constructed with the LOCAL
// Date constructor and passed as ISO so the iteration (which uses local
// setDate/getDay) and the test windows stay consistent regardless of the
// machine timezone. Assertions are on counts/structure, and exception keys are
// derived from the function's own output — both timezone-robust.
const ev = (p: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'ev',
  title: 'Event',
  start: new Date(2026, 5, 15, 12, 0, 0).toISOString(), // 15 Jun 2026, local noon
  end: new Date(2026, 5, 15, 13, 0, 0).toISOString(),
  ...p,
});

const localDate = (y: number, m: number, d: number, h = 0) => new Date(y, m, d, h);

describe('getMasterId / isInstanceId', () => {
  it('splits an instance id at "::"', () => {
    expect(getMasterId('abc::2026-06-15')).toBe('abc');
  });
  it('returns a master id unchanged', () => {
    expect(getMasterId('abc')).toBe('abc');
  });
  it('detects instance ids', () => {
    expect(isInstanceId('abc::2026-06-15')).toBe(true);
    expect(isInstanceId('abc')).toBe(false);
  });
});

describe('expandRecurringEvents — passthrough cases', () => {
  it('returns non-recurring events untouched', () => {
    const e = ev({ recurrence: 'none' });
    const out = expandRecurringEvents([e], localDate(2026, 5, 1), localDate(2026, 5, 30));
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(e); // same reference, no instance generated
  });

  it('treats a missing recurrence as none', () => {
    const out = expandRecurringEvents([ev({})], localDate(2026, 5, 1), localDate(2026, 5, 30));
    expect(out).toHaveLength(1);
    expect(isInstanceId(out[0].id)).toBe(false);
  });

  it('keeps an event with an invalid date as-is', () => {
    const out = expandRecurringEvents(
      [ev({ recurrence: 'daily', start: 'not-a-date' })],
      localDate(2026, 5, 15),
      localDate(2026, 5, 17),
    );
    expect(out).toHaveLength(1);
    expect(isInstanceId(out[0].id)).toBe(false);
  });

  it('keeps a custom event with no selected days as-is', () => {
    const out = expandRecurringEvents(
      [ev({ recurrence: 'custom', recurrenceDays: [] })],
      localDate(2026, 5, 15),
      localDate(2026, 5, 22),
    );
    expect(out).toHaveLength(1);
    expect(isInstanceId(out[0].id)).toBe(false);
  });
});

describe('expandRecurringEvents — daily / weekly', () => {
  it('expands a daily event across the window inclusively', () => {
    const out = expandRecurringEvents(
      [ev({ recurrence: 'daily' })],
      localDate(2026, 5, 15),
      localDate(2026, 5, 17, 23),
    );
    expect(out).toHaveLength(3); // 15, 16, 17
    expect(out.every((e) => isInstanceId(e.id))).toBe(true);
    expect(out.every((e) => getMasterId(e.id) === 'ev')).toBe(true);
  });

  it('preserves the event duration on each instance', () => {
    const out = expandRecurringEvents(
      [ev({ recurrence: 'daily' })],
      localDate(2026, 5, 15),
      localDate(2026, 5, 16, 23),
    );
    const durMs = new Date(out[0].end).getTime() - new Date(out[0].start).getTime();
    expect(durMs).toBe(60 * 60 * 1000); // 1h, like the master
  });

  it('steps weekly by 7 days', () => {
    const out = expandRecurringEvents(
      [ev({ recurrence: 'weekly' })],
      localDate(2026, 5, 15),
      localDate(2026, 6, 15, 23), // 15 Jun → 15 Jul
    );
    // 15, 22, 29 Jun + 6, 13 Jul = 5
    expect(out).toHaveLength(5);
  });

  it('projects future occurrences when the master starts before the window', () => {
    const out = expandRecurringEvents(
      [ev({ recurrence: 'daily', start: new Date(2026, 0, 1, 12).toISOString() })],
      localDate(2026, 5, 15),
      localDate(2026, 5, 17, 23),
    );
    expect(out).toHaveLength(3); // only the in-window instances
  });
});

describe('expandRecurringEvents — exceptions', () => {
  it('omits an occurrence listed in exceptions', () => {
    const base = ev({ recurrence: 'daily' });
    const full = expandRecurringEvents([base], localDate(2026, 5, 15), localDate(2026, 5, 17, 23));
    expect(full).toHaveLength(3);

    // Derive the real date-key the function uses for the middle instance.
    const middleKey = full[1].id.split('::')[1];
    const withException = expandRecurringEvents(
      [ev({ recurrence: 'daily', exceptions: [middleKey] })],
      localDate(2026, 5, 15),
      localDate(2026, 5, 17, 23),
    );
    expect(withException).toHaveLength(2);
    expect(withException.some((e) => e.id.endsWith(`::${middleKey}`))).toBe(false);
  });
});

describe('expandRecurringEvents — custom weekdays', () => {
  it('emits every day when all weekdays are selected', () => {
    const out = expandRecurringEvents(
      [ev({ recurrence: 'custom', recurrenceDays: [0, 1, 2, 3, 4, 5, 6] })],
      localDate(2026, 5, 15),
      localDate(2026, 5, 17, 23),
    );
    expect(out).toHaveLength(3);
  });

  it('emits only the matching weekday', () => {
    const startWeekday = new Date(2026, 5, 15).getDay();
    const out = expandRecurringEvents(
      [ev({ recurrence: 'custom', recurrenceDays: [startWeekday] })],
      localDate(2026, 5, 15),
      localDate(2026, 5, 21, 23), // exactly one week → one matching weekday
    );
    expect(out).toHaveLength(1);
  });
});
