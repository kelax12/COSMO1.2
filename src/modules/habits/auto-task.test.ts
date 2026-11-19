// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { autoTaskInput, dueAutoTasks } from './auto-task';
import { LocalStorageHabitAutoTaskRepository, HABIT_AUTO_TASKS_KEY } from './auto-task.local.repository';
import type { Habit } from './types';

const habit = (id: string, extra: Partial<Habit> = {}): Habit => ({
  id, name: `H ${id}`, frequency: 'daily', estimatedTime: 25, color: '#3B82F6', icon: '✓', completions: {}, ...extra,
});

// 2026-11-19 est un jeudi (4).
const DAY = '2026-11-19';

describe('dueAutoTasks', () => {
  it('garde les habitudes actives, prévues ce jour et pas encore réservées', () => {
    const habits = [habit('a'), habit('b'), habit('c', { scheduledDays: [1] }), habit('d')];
    const settings = [
      { habitId: 'a', category: 'cat', lastDay: null },
      { habitId: 'b', category: null, lastDay: DAY },
      { habitId: 'c', category: null, lastDay: null },
      { habitId: 'zz', category: null, lastDay: null },
    ];
    expect(dueAutoTasks(habits, settings, DAY).map((d) => d.habit.id)).toEqual(['a']);
  });

  it('reprend le lendemain du dernier jour réservé', () => {
    expect(dueAutoTasks([habit('a')], [{ habitId: 'a', category: null, lastDay: '2026-11-18' }], DAY)).toHaveLength(1);
  });
});

describe('autoTaskInput', () => {
  it('nom, durée, échéance du jour et catégorie', () => {
    expect(autoTaskInput(habit('a'), { habitId: 'a', category: 'cat-1', lastDay: null }, DAY)).toMatchObject({
      name: 'H a', estimatedTime: 25, deadline: DAY, category: 'cat-1', completed: false,
    });
  });
});

describe('LocalStorageHabitAutoTaskRepository', () => {
  beforeEach(() => localStorage.removeItem(HABIT_AUTO_TASKS_KEY));

  it('active, réserve un jour une seule fois, désactive', async () => {
    const repo = new LocalStorageHabitAutoTaskRepository();
    expect(await repo.claimDay('a', DAY)).toBe(false);
    await repo.enable('a', 'cat');
    expect(await repo.claimDay('a', DAY)).toBe(true);
    expect(await repo.claimDay('a', DAY)).toBe(false);
    await repo.enable('a', 'autre');
    expect(await repo.list()).toEqual([{ habitId: 'a', category: 'autre', lastDay: DAY }]);
    await repo.disable('a');
    expect(await repo.list()).toEqual([]);
  });
});
