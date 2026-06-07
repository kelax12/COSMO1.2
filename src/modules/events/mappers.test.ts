import { describe, it, expect } from 'vitest';
import { mapEventFromDb, mapEventToDb, EventRow } from './mappers';
import type { CalendarEvent } from './types';

const baseRow: EventRow = {
  id: 'e1',
  title: 'Event',
  start_time: '2026-06-07T09:00:00Z',
  end_time: '2026-06-07T10:00:00Z',
};

describe('mapEventFromDb', () => {
  it('maps start_time/end_time to start/end and defaults recurrence', () => {
    const e = mapEventFromDb(baseRow);
    expect(e.start).toBe('2026-06-07T09:00:00Z');
    expect(e.end).toBe('2026-06-07T10:00:00Z');
    expect(e.recurrence).toBe('none');
    expect(e.recurrenceDays).toEqual([]);
    expect(e.exceptions).toEqual([]);
  });

  it('preserves recurrence fields when present', () => {
    const e = mapEventFromDb({ ...baseRow, recurrence: 'weekly', recurrence_days: [1, 3], exceptions: ['2026-06-14'] });
    expect(e.recurrence).toBe('weekly');
    expect(e.recurrenceDays).toEqual([1, 3]);
    expect(e.exceptions).toEqual(['2026-06-14']);
  });
});

describe('mapEventToDb (whitelist / anti-mass-assignment)', () => {
  it('NEVER emits user_id, even if forged (faille V1)', () => {
    const forged = { title: 'x', user_id: 'evil' } as Partial<CalendarEvent> & { user_id?: string };
    const out = mapEventToDb(forged);
    expect('user_id' in out).toBe(false);
    expect(out).toEqual({ title: 'x' });
  });

  it('maps start/end to start_time/end_time', () => {
    expect(mapEventToDb({ start: 's', end: 'e', taskId: 't' })).toEqual({ start_time: 's', end_time: 'e', task_id: 't' });
  });

  it('maps every whitelisted field (full coverage)', () => {
    const out = mapEventToDb({
      title: 't', start: 's', end: 'e', color: '#fff', description: 'd', notes: 'n',
      taskId: 'tid', recurrence: 'custom', recurrenceDays: [1, 2], exceptions: ['2026-06-14'],
    });
    expect(out).toEqual({
      title: 't', start_time: 's', end_time: 'e', color: '#fff', description: 'd', notes: 'n',
      task_id: 'tid', recurrence: 'custom', recurrence_days: [1, 2], exceptions: ['2026-06-14'],
    });
  });
});
