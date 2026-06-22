import { describe, it, expect } from 'vitest';
import { getInitialScrollTime, buildCalendarEvents, defaultEventsWindow, bufferedWindow } from './calendar-events';
import type { CalendarEvent } from '@/modules/events';

describe('getInitialScrollTime', () => {
  it('returns 4 hours before the current hour, zero-padded', () => {
    expect(getInitialScrollTime(new Date('2026-01-01T14:30:00'))).toBe('10:00:00');
    expect(getInitialScrollTime(new Date('2026-01-01T09:00:00'))).toBe('05:00:00');
  });
  it('clamps to 00:00:00 before 04:00', () => {
    expect(getInitialScrollTime(new Date('2026-01-01T02:00:00'))).toBe('00:00:00');
  });
});

describe('buildCalendarEvents', () => {
  const now = new Date('2026-06-09T12:00:00');
  const ev = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
    id: 'e1',
    title: 'Réunion',
    start: '2026-06-09T10:00:00.000Z',
    end: '2026-06-09T11:00:00.000Z',
    color: '#3B82F6',
    recurrence: 'none',
    ...over,
  } as CalendarEvent);

  it('maps a non-recurring event to the FullCalendar shape (editable)', () => {
    const [out] = buildCalendarEvents([ev()], now);
    expect(out).toMatchObject({
      id: 'e1',
      title: 'Réunion',
      backgroundColor: '#3B82F6',
      borderColor: '#3B82F6',
      textColor: '#ffffff',
      editable: true,
    });
    expect(out.extendedProps.isRecurringInstance).toBe(false);
  });

  it('carries notes and taskId into extendedProps', () => {
    const [out] = buildCalendarEvents([ev({ notes: 'hello', taskId: 't9' })], now);
    expect(out.extendedProps).toEqual({ notes: 'hello', taskId: 't9', isRecurringInstance: false });
  });

  it('returns an array', () => {
    expect(Array.isArray(buildCalendarEvents([], now))).toBe(true);
  });
});

describe('defaultEventsWindow', () => {
  it('couvre -1 mois à +2 mois autour de now (1er paint sans flash)', () => {
    const w = defaultEventsWindow(new Date('2026-06-15T12:00:00.000Z'));
    expect(w.start).toBe(new Date('2026-05-15T12:00:00.000Z').toISOString());
    expect(w.end).toBe(new Date('2026-08-15T12:00:00.000Z').toISOString());
    expect(w.start < w.end).toBe(true);
  });
});

describe('bufferedWindow', () => {
  it('élargit la plage visible de ±1 mois par défaut', () => {
    const w = bufferedWindow(new Date('2026-06-01T00:00:00.000Z'), new Date('2026-07-01T00:00:00.000Z'));
    expect(w.start).toBe(new Date('2026-05-01T00:00:00.000Z').toISOString());
    expect(w.end).toBe(new Date('2026-08-01T00:00:00.000Z').toISOString());
  });

  it('respecte un buffer personnalisé', () => {
    const w = bufferedWindow(new Date('2026-06-10T00:00:00.000Z'), new Date('2026-06-17T00:00:00.000Z'), 2);
    expect(w.start).toBe(new Date('2026-04-10T00:00:00.000Z').toISOString());
    expect(w.end).toBe(new Date('2026-08-17T00:00:00.000Z').toISOString());
  });
});
