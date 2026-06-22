import { describe, it, expect } from 'vitest';
import {
  isRecurringEvent,
  eventInWindow,
  selectEventsInWindow,
  buildWindowOrFilter,
} from './window';
import { CalendarEvent } from './types';

const WIN_START = '2026-06-01T00:00:00.000Z';
const WIN_END = '2026-06-30T23:59:59.999Z';

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'e', title: 't', start: '2026-06-15T10:00:00.000Z', end: '2026-06-15T11:00:00.000Z', ...over,
});

describe('isRecurringEvent', () => {
  it('vrai pour daily/weekly/custom, faux pour none/undefined', () => {
    expect(isRecurringEvent({ recurrence: 'daily' })).toBe(true);
    expect(isRecurringEvent({ recurrence: 'weekly' })).toBe(true);
    expect(isRecurringEvent({ recurrence: 'custom' })).toBe(true);
    expect(isRecurringEvent({ recurrence: 'none' })).toBe(false);
    expect(isRecurringEvent({ recurrence: undefined })).toBe(false);
  });
});

describe('eventInWindow', () => {
  it('inclut TOUJOURS un récurrent, même hors fenêtre (piège 42-récurrence)', () => {
    const weeklyBefore = ev({ recurrence: 'weekly', start: '2026-01-05T10:00:00.000Z', end: '2026-01-05T11:00:00.000Z' });
    expect(eventInWindow(weeklyBefore, WIN_START, WIN_END)).toBe(true);
  });

  it('inclut un non-récurrent qui chevauche la fenêtre', () => {
    expect(eventInWindow(ev({}), WIN_START, WIN_END)).toBe(true);
  });

  it('exclut un non-récurrent entièrement avant la fenêtre', () => {
    const before = ev({ start: '2026-05-01T10:00:00.000Z', end: '2026-05-01T11:00:00.000Z' });
    expect(eventInWindow(before, WIN_START, WIN_END)).toBe(false);
  });

  it('exclut un non-récurrent entièrement après la fenêtre', () => {
    const after = ev({ start: '2026-07-10T10:00:00.000Z', end: '2026-07-10T11:00:00.000Z' });
    expect(eventInWindow(after, WIN_START, WIN_END)).toBe(false);
  });

  it('inclut un événement multi-jours qui enjambe la fenêtre', () => {
    const spanning = ev({ start: '2026-05-28T10:00:00.000Z', end: '2026-06-02T11:00:00.000Z' });
    expect(eventInWindow(spanning, WIN_START, WIN_END)).toBe(true);
  });
});

describe('selectEventsInWindow', () => {
  it('garde récurrents + chevauchants, retire les hors-fenêtre', () => {
    const events = [
      ev({ id: 'in' }),
      ev({ id: 'rec', recurrence: 'weekly', start: '2025-01-01T10:00:00.000Z', end: '2025-01-01T11:00:00.000Z' }),
      ev({ id: 'before', start: '2026-04-01T10:00:00.000Z', end: '2026-04-01T11:00:00.000Z' }),
    ];
    const kept = selectEventsInWindow(events, WIN_START, WIN_END).map((e) => e.id);
    expect(kept).toContain('in');
    expect(kept).toContain('rec');
    expect(kept).not.toContain('before');
  });
});

describe('buildWindowOrFilter', () => {
  it('reflète eventInWindow : branche récurrents + branche plage (overlap)', () => {
    const f = buildWindowOrFilter(WIN_START, WIN_END);
    expect(f).toBe(
      `recurrence.in.(daily,weekly,custom),and(start_time.lte.${WIN_END},end_time.gte.${WIN_START})`,
    );
    // pas de virgule parasite dans les bornes (casserait le parsing .or())
    expect(WIN_START.includes(',')).toBe(false);
    expect(WIN_END.includes(',')).toBe(false);
  });
});
