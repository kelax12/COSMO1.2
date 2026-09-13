import { describe, it, expect } from 'vitest';
import { getProgress, filterObjectivesByCategories } from './okr-page-logic';
import type { KeyResult } from '@/modules/okrs';

const kr = (currentValue: number, targetValue: number): KeyResult =>
  ({ id: 'k', title: 't', currentValue, targetValue } as KeyResult);

describe('getProgress', () => {
  it('returns 0 for no key results', () => {
    expect(getProgress([])).toBe(0);
  });
  it('averages the per-KR percentages and rounds', () => {
    expect(getProgress([kr(5, 10), kr(10, 10)])).toBe(75); // (50 + 100) / 2
  });
  it('guards against zero targetValue (counts as 0%)', () => {
    expect(getProgress([kr(3, 0), kr(10, 10)])).toBe(50); // (0 + 100) / 2
  });
  it('caps are not applied (raw average) — over-100 KR contributes its raw %', () => {
    expect(getProgress([kr(20, 10)])).toBe(200);
  });
});

describe('filterObjectivesByCategories', () => {
  const objs = [
    { id: 'a', completed: false, category: 'work' },
    { id: 'b', completed: true, category: 'work' },
    { id: 'c', completed: false, category: 'home' },
  ];

  it('an empty set returns every non-completed objective', () => {
    expect(filterObjectivesByCategories(objs, new Set()).map(o => o.id)).toEqual(['a', 'c']);
  });
  it('a completed objective is excluded even if its category is active', () => {
    expect(filterObjectivesByCategories(objs, new Set(['work'])).map(o => o.id)).toEqual(['a']);
  });
  it('several active categories act as an OR', () => {
    expect(filterObjectivesByCategories(objs, new Set(['work', 'home'])).map(o => o.id)).toEqual(['a', 'c']);
  });
  it('a category absent from the active set is excluded', () => {
    expect(filterObjectivesByCategories(objs, new Set(['home'])).map(o => o.id)).toEqual(['c']);
  });
});
