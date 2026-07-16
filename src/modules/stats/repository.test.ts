import { describe, it, expect } from 'vitest';
import { LocalStatsRepository } from './repository';
import type { ITasksRepository } from '@/modules/tasks/repository';
import type { IEventsRepository } from '@/modules/events/repository';
import type { IHabitsRepository } from '@/modules/habits/repository';
import type { IOKRsRepository } from '@/modules/okrs/repository';
import type { Task } from '@/modules/tasks';
import type { CalendarEvent } from '@/modules/events';
import type { Habit } from '@/modules/habits';
import type { OKR } from '@/modules/okrs';

// Stubs minimaux : seuls les champs lus par calculateWorkTimeForPeriod comptent.
const task = (over: Partial<Task>): Task => ({
  id: 't1', name: 'T', priority: 3, category: '', deadline: '2026-07-10',
  estimatedTime: 30, bookmarked: false, completed: true,
  completedAt: '2026-07-10', createdAt: '2026-07-01', updatedAt: '2026-07-01',
  ...over,
} as Task);

const habit = (completions: Record<string, boolean>, estimatedTime = 10): Habit => ({
  id: 'h1', name: 'H', frequency: 'daily', estimatedTime,
  color: '#000', icon: '⭐', completions, createdAt: '2026-01-01',
} as unknown as Habit);

const fakeRepos = (data: { tasks?: Task[]; events?: CalendarEvent[]; habits?: Habit[]; okrs?: OKR[] }) => ({
  tasks: { getAll: async () => data.tasks ?? [] } as unknown as ITasksRepository,
  events: { getAll: async () => data.events ?? [] } as unknown as IEventsRepository,
  habits: { fetchHabits: async () => data.habits ?? [] } as unknown as IHabitsRepository,
  okrs: { getAll: async () => data.okrs ?? [] } as unknown as IOKRsRepository,
});

const makeRepo = (data: Parameters<typeof fakeRepos>[0]) => {
  const r = fakeRepos(data);
  return new LocalStatsRepository(r.tasks, r.events, r.habits, r.okrs);
};

describe('LocalStatsRepository', () => {
  it('[] sans lecture quand aucune plage', async () => {
    const repo = makeRepo({});
    expect(await repo.getWorkTimeStats([])).toEqual([]);
  });

  it('agrège tâches complétées + complétions d’habitudes dans la plage, exclut hors plage', async () => {
    const repo = makeRepo({
      tasks: [
        task({ id: 't1', completedAt: '2026-07-10', estimatedTime: 30 }),
        task({ id: 't2', completedAt: '2026-06-01', estimatedTime: 999 }), // hors plage
        task({ id: 't3', completed: false, completedAt: undefined, estimatedTime: 999 }),
      ],
      habits: [habit({ '2026-07-09': true, '2026-07-10': true, '2026-06-01': true, '2026-07-08': false }, 10)],
    });

    const [b] = await repo.getWorkTimeStats([{ start: '2026-07-07', end: '2026-07-13' }]);

    expect(b.tasksTime).toBe(30);
    expect(b.habitsTime).toBe(20); // 2 complétions × 10 min
    expect(b.eventsTime).toBe(0);
    expect(b.okrTime).toBe(0);
    expect(b.totalTime).toBe(50);
  });

  it('retourne un bucket par plage, dans l’ordre', async () => {
    const repo = makeRepo({
      tasks: [task({ completedAt: '2026-07-10', estimatedTime: 45 })],
    });

    const buckets = await repo.getWorkTimeStats([
      { start: '2026-07-10', end: '2026-07-10' }, // contient la tâche
      { start: '2026-07-11', end: '2026-07-11' }, // vide
    ]);

    expect(buckets.map(b => b.tasksTime)).toEqual([45, 0]);
  });
});
