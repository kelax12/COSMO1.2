import { describe, it, expect } from 'vitest';
import { calculateWorkTimeForPeriod, okrTimeByObjective, parseLocalDate, getLocalDateString } from './workTimeCalculator';
import type { Task } from '@/modules/tasks';
import type { CalendarEvent } from '@/modules/events';
import type { Habit } from '@/modules/habits';
import type { OKR } from '@/modules/okrs';
import type { KRCompletion } from '@/modules/kr-completions/types';

const task = (o: Partial<Task>): Task => ({
  id: 't', name: 't', priority: 3, category: '', deadline: '', estimatedTime: 0,
  bookmarked: false, completed: false, ...o,
});
const event = (o: Partial<CalendarEvent>): CalendarEvent => ({ id: 'e', title: 'e', start: '', end: '', ...o });
const habit = (o: Partial<Habit>): Habit => ({
  id: 'h', name: 'h', frequency: 'daily', estimatedTime: 0, color: '', icon: '', completions: {}, ...o,
});

const completion = (o: Partial<KRCompletion>): KRCompletion => ({
  id: 'c', krId: 'kr-1', okrId: 'okr-1', userId: 'u', completedAt: '2026-06-10T09:00:00',
  krTitle: '', okrTitle: '', ...o,
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
      events: [], habits: [], okrs: [], krCompletions: []
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
      habits: [], okrs: [], krCompletions: []
    });
    expect(r.eventsTime).toBe(90);
    expect(r.events).toHaveLength(1);
  });

  it('counts habit completions in range times estimatedTime', () => {
    const r = calculateWorkTimeForPeriod(start, end, {
      tasks: [], events: [],
      habits: [habit({ estimatedTime: 10, completions: { '2026-06-05': true, '2026-06-25': true, '2026-07-05': true } })],
      okrs: [], krCompletions: []
    });
    expect(r.habitsTime).toBe(20); // 2 in-range completions * 10
    expect(r.habits[0].periodCompletions).toBe(2);
  });

  // ⚠️ Ce test lisait `kr.history`, un champ qu'il FABRIQUAIT lui-meme via
  // `as unknown as OKR`. Aucun ecrivain du produit ne le pose (verifie :
  // `grep "history:" src` rend zero resultat), donc `okrTime` valait
  // structurellement 0 en production pendant que ce test passait au vert. La
  // source reelle est le journal `kr_completions`.
  it('compte une minute estimee par completion de KR tombant dans la plage', () => {
    const okr = { keyResults: [{ id: 'kr-1', estimatedTime: 10 }] } as unknown as OKR;
    const r = calculateWorkTimeForPeriod(start, end, {
      tasks: [], events: [], habits: [], okrs: [okr],
      krCompletions: [
        completion({ krId: 'kr-1', completedAt: '2026-06-10T09:00:00' }),
        completion({ krId: 'kr-1', completedAt: '2026-06-20T09:00:00' }),
        completion({ krId: 'kr-1', completedAt: '2026-07-15T09:00:00' }), // hors plage
      ],
    });
    expect(r.okrTime).toBe(20);
  });

  it('ne compte rien pour une completion dont le KR n existe plus', () => {
    const okr = { keyResults: [{ id: 'kr-1', estimatedTime: 10 }] } as unknown as OKR;
    const r = calculateWorkTimeForPeriod(start, end, {
      tasks: [], events: [], habits: [], okrs: [okr],
      krCompletions: [completion({ krId: 'kr-disparu', completedAt: '2026-06-10T09:00:00' })],
    });
    expect(r.okrTime).toBe(0);
  });

  it('handles missing optional numeric/array fields without crashing', () => {
    const okrNoKrs = {} as unknown as OKR;            // keyResults undefined → []
    const okrEmptyKr = { keyResults: [{}] } as unknown as OKR; // kr without history/estimatedTime
    const r = calculateWorkTimeForPeriod(start, end, {
      tasks: [task({ completed: true, completedAt: '2026-06-10', estimatedTime: 0 })], // estimatedTime falsy
      events: [],
      habits: [habit({ completions: { '2026-06-10': true } })], // estimatedTime 0 (default)
      okrs: [okrNoKrs, okrEmptyKr], krCompletions: []
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
      okrs: [], krCompletions: []
    });
    expect(r.totalTime).toBe(15 + 30 + 5);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Le detail par objectif somme au total (revue du 2026-09-02)
//
// La page Statistiques affiche un total ET une repartition par OKR. Les deux
// sortent du meme parcours, pour qu'ils ne puissent pas se contredire : c'est
// exactement la divergence qui avait laisse trois implementations coexister,
// dont une morte.
// ═══════════════════════════════════════════════════════════════════
describe('okrTimeByObjective', () => {
  const okrs = [
    { id: 'okr-a', keyResults: [{ id: 'kr-1', estimatedTime: 10 }, { id: 'kr-2', estimatedTime: 25 }] },
    { id: 'okr-b', keyResults: [{ id: 'kr-3', estimatedTime: 5 }] },
  ] as unknown as OKR[];

  it('ventile les minutes par objectif', () => {
    const byObjective = okrTimeByObjective(start, end, [
      completion({ okrId: 'okr-a', krId: 'kr-1', completedAt: '2026-06-05T08:00:00' }),
      completion({ okrId: 'okr-a', krId: 'kr-2', completedAt: '2026-06-06T08:00:00' }),
      completion({ okrId: 'okr-b', krId: 'kr-3', completedAt: '2026-06-07T08:00:00' }),
    ], okrs);

    expect(byObjective.get('okr-a')).toBe(35);
    expect(byObjective.get('okr-b')).toBe(5);
  });

  it('exclut les completions hors plage', () => {
    const byObjective = okrTimeByObjective(start, end, [
      completion({ okrId: 'okr-a', krId: 'kr-1', completedAt: '2026-05-31T23:59:00' }),
      completion({ okrId: 'okr-a', krId: 'kr-1', completedAt: '2026-07-01T00:00:00' }),
    ], okrs);
    expect(byObjective.size).toBe(0);
  });

  it('ignore une date de completion illisible au lieu de rendre NaN', () => {
    const byObjective = okrTimeByObjective(start, end, [
      completion({ okrId: 'okr-a', krId: 'kr-1', completedAt: 'pas-une-date' }),
    ], okrs);
    expect(byObjective.size).toBe(0);
  });

  it('garde l objectif visible meme quand son KR a disparu, a zero minute', () => {
    const byObjective = okrTimeByObjective(start, end, [
      completion({ okrId: 'okr-a', krId: 'kr-supprime', completedAt: '2026-06-05T08:00:00' }),
    ], okrs);
    expect(byObjective.get('okr-a')).toBe(0);
  });
});
