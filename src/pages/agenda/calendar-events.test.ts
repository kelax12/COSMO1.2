import { describe, it, expect } from 'vitest';
import { getInitialScrollTime, buildCalendarEvents } from './calendar-events';
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
