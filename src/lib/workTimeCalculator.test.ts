import { describe, it, expect } from 'vitest';
import { calculateWorkTimeForPeriod, parseLocalDate, getLocalDateString } from './workTimeCalculator';
import type { Task } from '@/modules/tasks';
import type { CalendarEvent } from '@/modules/events';
import type { Habit } from '@/modules/habits';
import type { OKR } from '@/modules/okrs';

const task = (o: Partial<Task>): Task => ({
  id: 't', name: 't', priority: 3, category: '', deadline: '', estimatedTime: 0,
  bookmarked: false, completed: false, ...o,
});
const event = (o: Partial<CalendarEvent>): CalendarEvent => ({ id: 'e', title: 'e', start: '', end: '', ...o });
const habit = (o: Partial<Habit>): Habit => ({
  id: 'h', name: 'h', frequency: 'daily', estimatedTime: 0, color: '', icon: '', completions: {}, ...o,
});

const start = new Date(2026, 5, 1);  // 2026-06-01 local
const end = new Date(2026, 5, 30);   // 2026-06-30 local

describe('parseLocalDate / getLocalDateString', () => {
  it('round-trips a YYYY-MM-DD string at local midnight', () => {
    const d = parseLocalDate('2026-06-15');
    expect(d.getHours()).toBe(0);
    expect(getLocalDateString(d)).toBe('2026-06-15');
  });
});

describe('calculateWorkTimeForPeriod', () => {
  it('counts only completed tasks within the period', () => {
    const r = calculateWorkTimeForPeriod(start, end, {
      tasks: [
        task({ completed: true, completedAt: '2026-06-15', estimatedTime: 30 }),
        task({ completed: true, completedAt: '2026-06-20', estimatedTime: 20 }),
        task({ completed: false, completedAt: '2026-06-10', estimatedTime: 99 }), // not completed
        task({ completed: true, completedAt: '2026-07-15', estimatedTime: 99 }),  // out of range
      ],
      events: [], habits: [], okrs: [],
    });
    expect(r.tasksTime).toBe(50);
    expect(r.completedTasks).toHaveLength(2);
  });

  it('sums event durations in minutes within the period', () => {
    const r = calculateWorkTimeForPeriod(start, end, {
      tasks: [],
      events: [
        event({ start: '2026-06-15T09:00:00', end: '2026-06-15T10:30:00' }), // 90 min
        event({ start: '2026-07-01T09:00:00', end: '2026-07-01T10:00:00' }), // out of range
      ],
      habits: [], okrs: [],
    });
    expect(r.eventsTime).toBe(90);
    expect(r.events).toHaveLength(1);
  });

  it('counts habit completions in range times estimatedTime', () => {
    const r = calculateWorkTimeForPeriod(start, end, {
      tasks: [], events: [],
      habits: [habit({ estimatedTime: 10, completions: { '2026-06-05': true, '2026-06-25': true, '2026-07-05': true } })],
      okrs: [],
    });
    expect(r.habitsTime).toBe(20); // 2 in-range completions * 10
    expect(r.habits[0].periodCompletions).toBe(2);
  });

  it('counts OKR key-result increments in range times estimatedTime', () => {
    // history/estimatedTime are read off KeyResult via cast in the impl, so we
    // build a minimal shape and assert only the okrTime aggregation.
    const okr = {
      keyResults: [
        {
          history: [
            { date: '2026-06-10', increment: 2 },
            { date: '2026-07-15', increment: 9 }, // out of range
          ],
          estimatedTime: 10,
        },
      ],
    } as unknown as OKR;
    const r = calculateWorkTimeForPeriod(start, end, { tasks: [], events: [], habits: [], okrs: [okr] });
    expect(r.okrTime).toBe(20); // 2 in-range increments * 10
  });

  it('handles missing optional numeric/array fields without crashing', () => {
    const okrNoKrs = {} as unknown as OKR;            // keyResults undefined → []
    const okrEmptyKr = { keyResults: [{}] } as unknown as OKR; // kr without history/estimatedTime
    const r = calculateWorkTimeForPeriod(start, end, {
      tasks: [task({ completed: true, completedAt: '2026-06-10', estimatedTime: 0 })], // estimatedTime falsy
      events: [],
      habits: [habit({ completions: { '2026-06-10': true } })], // estimatedTime 0 (default)
      okrs: [okrNoKrs, okrEmptyKr],
    });
    expect(r.okrTime).toBe(0);
    expect(r.tasksTime).toBe(0);
    expect(r.habitsTime).toBe(0);
    expect(r.totalTime).toBe(0);
  });

  it('totalTime is the sum of all sources', () => {
    const r = calculateWorkTimeForPeriod(start, end, {
      tasks: [task({ completed: true, completedAt: '2026-06-10', estimatedTime: 15 })],
      events: [event({ start: '2026-06-10T09:00:00', end: '2026-06-10T09:30:00' })],
      habits: [habit({ estimatedTime: 5, completions: { '2026-06-10': true } })],
      okrs: [],
    });
    expect(r.totalTime).toBe(15 + 30 + 5);
  });
});
