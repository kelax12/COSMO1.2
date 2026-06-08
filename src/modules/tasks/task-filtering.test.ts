import { describe, it, expect } from 'vitest';
import { applyQuickFilter, withinPriorityRange, compareTasks, filterAndSortTasks } from './task-filtering';
import type { Task } from './types';

const t = (o: Partial<Task>): Task => ({
  id: Math.random().toString(36).slice(2), name: 't', priority: 3, category: '', deadline: '',
  estimatedTime: 0, bookmarked: false, completed: false, ...o,
});

const NOW = new Date('2026-06-07T12:00:00Z');

describe('applyQuickFilter', () => {
  const tasks = [
    t({ id: 'a', bookmarked: true, completed: false }),
    t({ id: 'b', completed: true }),
    t({ id: 'c', completed: false, deadline: '2026-01-01T00:00:00Z' }), // overdue
    t({ id: 'd', isCollaborative: true, completed: false }),
    t({ id: 'e', completed: false, deadline: '2027-01-01T00:00:00Z' }),
  ];

  it('favoris: bookmarked & not completed', () => {
    expect(applyQuickFilter(tasks, 'favoris', false, NOW).map(x => x.id)).toEqual(['a']);
  });
  it('terminées: completed only', () => {
    expect(applyQuickFilter(tasks, 'terminées', false, NOW).map(x => x.id)).toEqual(['b']);
  });
  it('retard: not completed & deadline in past', () => {
    expect(applyQuickFilter(tasks, 'retard', false, NOW).map(x => x.id)).toEqual(['c']);
  });
  it('collaboration: collaborative & not completed', () => {
    expect(applyQuickFilter(tasks, 'collaboration', false, NOW).map(x => x.id)).toEqual(['d']);
  });
  it('none: active tasks when showCompleted=false, completed when true', () => {
    expect(applyQuickFilter(tasks, 'none', false, NOW).map(x => x.id)).toEqual(['a', 'c', 'd', 'e']);
    expect(applyQuickFilter(tasks, 'none', true, NOW).map(x => x.id)).toEqual(['b']);
  });
});

describe('withinPriorityRange', () => {
  it('keeps priority 0 (unset) regardless of range', () => {
    expect(withinPriorityRange(t({ priority: 0 }), [2, 4])).toBe(true);
  });
  it('respects the inclusive range', () => {
    expect(withinPriorityRange(t({ priority: 2 }), [2, 4])).toBe(true);
    expect(withinPriorityRange(t({ priority: 4 }), [2, 4])).toBe(true);
    expect(withinPriorityRange(t({ priority: 1 }), [2, 4])).toBe(false);
    expect(withinPriorityRange(t({ priority: 5 }), [2, 4])).toBe(false);
  });
});

describe('compareTasks', () => {
  it('sorts by name asc/desc', () => {
    const a = t({ name: 'Alpha' }); const b = t({ name: 'Beta' });
    expect(compareTasks(a, b, 'name', 'asc', false)).toBeLessThan(0);
    expect(compareTasks(a, b, 'name', 'desc', false)).toBeGreaterThan(0);
  });
  it('sorts by priority numerically', () => {
    expect(compareTasks(t({ priority: 1 }), t({ priority: 5 }), 'priority', 'asc', false)).toBeLessThan(0);
  });
  it('ignores completedAt unless showCompleted', () => {
    const a = t({ completedAt: '2026-01-01T00:00:00Z' });
    const b = t({ completedAt: '2026-02-01T00:00:00Z' });
    expect(compareTasks(a, b, 'completedAt', 'asc', false)).toBe(0); // not active
    expect(compareTasks(a, b, 'completedAt', 'asc', true)).toBeLessThan(0);
  });
  it('without a field, bookmarked tasks sort first', () => {
    expect(compareTasks(t({ bookmarked: true }), t({ bookmarked: false }), undefined, 'asc', false)).toBe(-1);
    expect(compareTasks(t({ bookmarked: false }), t({ bookmarked: true }), undefined, 'asc', false)).toBe(1);
    expect(compareTasks(t({ bookmarked: false }), t({ bookmarked: false }), undefined, 'asc', false)).toBe(0);
  });
});

describe('filterAndSortTasks', () => {
  it('composes quick-filter → priority range → sort without mutating input', () => {
    const input = [
      t({ id: 'a', name: 'Zeta', priority: 3, completed: false }),
      t({ id: 'b', name: 'Alpha', priority: 1, completed: false }), // filtered out by range
      t({ id: 'c', name: 'Mu', priority: 4, completed: false }),
      t({ id: 'd', name: 'Done', priority: 3, completed: true }),   // filtered out by view
    ];
    const snapshot = [...input];
    const out = filterAndSortTasks({
      tasks: input, quickFilter: 'none', showCompleted: false,
      priorityRange: [2, 5], sortField: 'name', sortDirection: 'asc', now: NOW,
    });
    expect(out.map(x => x.id)).toEqual(['c', 'a']); // Mu < Zeta, priority 1 & completed excluded
    expect(input).toEqual(snapshot); // input not mutated
  });
});
