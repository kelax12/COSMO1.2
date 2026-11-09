import { describe, expect, it } from 'vitest';
import { compareOptionalDeadlines, compareOptionalPriorities, hasPriority, priorityRank } from './task-ordering';
import type { TimezonePref } from './timezone';

const UTC: TimezonePref = { mode: 'manual', offsetHours: 0 };

describe('priorityRank', () => {
  it('garde P1 à P5 et range « aucune » (0, null, hors plage) après P5', () => {
    expect([1, 2, 3, 4, 5].map(priorityRank)).toEqual([1, 2, 3, 4, 5]);
    expect([0, null, undefined, 6, -1].map(priorityRank)).toEqual([6, 6, 6, 6, 6]);
    expect(hasPriority(0)).toBe(false);
    expect(hasPriority(3)).toBe(true);
  });
});

describe('compareOptionalPriorities', () => {
  it('ordonne P1..P5 dans le sens demandé, « aucune » toujours en fin', () => {
    const sort = (dir: 'asc' | 'desc') => [0, 5, 1, 3].sort((a, b) => compareOptionalPriorities(a, b, dir));
    expect(sort('asc')).toEqual([1, 3, 5, 0]);
    expect(sort('desc')).toEqual([5, 3, 1, 0]);
    expect(compareOptionalPriorities(0, 0)).toBe(0);
  });
});

describe('compareOptionalDeadlines', () => {
  it('compare des JOURS et met les échéances absentes en fin dans les deux sens', () => {
    const values = ['', '2026-07-20T00:00:00.000Z', null, '2026-07-01', undefined];
    const sort = (dir: 'asc' | 'desc') =>
      [...values].sort((a, b) => compareOptionalDeadlines(a, b, dir, UTC)).map((v) => v || '-');
    expect(sort('asc')).toEqual(['2026-07-01', '2026-07-20T00:00:00.000Z', '-', '-', '-']);
    expect(sort('desc')).toEqual(['2026-07-20T00:00:00.000Z', '2026-07-01', '-', '-', '-']);
  });

  it('range une échéance d’équipe (date) et une perso (instant) du même jour à égalité', () => {
    expect(compareOptionalDeadlines('2026-07-01', '2026-07-01T00:00:00.000Z', 'asc', UTC)).toBe(0);
  });

  it('ne rend jamais NaN', () => {
    for (const [a, b] of [['', ''], ['', '2026-07-01'], ['2026-07-01', null]] as const) {
      expect(Number.isNaN(compareOptionalDeadlines(a, b, 'asc', UTC))).toBe(false);
    }
  });
});
