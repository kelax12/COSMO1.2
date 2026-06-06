import { describe, it, expect } from 'vitest';
import { SMART_PRESETS, tasksInList, tasksDueToday } from './smart-rules';
import type { TaskList } from './types';
import type { Task } from '@/modules/tasks';

// `now` figé pour des tests déterministes (mardi 10 juin 2026, midi).
const NOW = new Date('2026-06-10T12:00:00.000Z');

const iso = (daysFromNow: number, hour = 12): string => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

let seq = 0;
const task = (overrides: Partial<Task> = {}): Task => ({
  id: `t${seq++}`,
  name: 'task',
  priority: 3,
  category: 'cat',
  deadline: iso(0),
  estimatedTime: 30,
  bookmarked: false,
  completed: false,
  ...overrides,
});

const preset = (p: string) => SMART_PRESETS.find((x) => x.preset === p)!;

describe('SMART_PRESETS.overdue', () => {
  const matches = (t: Task) => preset('overdue').matches(t, NOW);

  it('match une tâche en retard non complétée', () => {
    expect(matches(task({ deadline: iso(-1) }))).toBe(true);
  });
  it('ne match pas une tâche en retard mais complétée', () => {
    expect(matches(task({ deadline: iso(-1), completed: true }))).toBe(false);
  });
  it('ne match pas une tâche due aujourd’hui', () => {
    expect(matches(task({ deadline: iso(0) }))).toBe(false);
  });
  it('ne match pas une tâche sans deadline', () => {
    expect(matches(task({ deadline: '' }))).toBe(false);
  });
});

describe('SMART_PRESETS.this-week', () => {
  const matches = (t: Task) => preset('this-week').matches(t, NOW);

  it('match une tâche due dans 3 jours', () => {
    expect(matches(task({ deadline: iso(3) }))).toBe(true);
  });
  it('match une tâche due aujourd’hui', () => {
    expect(matches(task({ deadline: iso(0) }))).toBe(true);
  });
  it('ne match pas une tâche due dans 8 jours', () => {
    expect(matches(task({ deadline: iso(8) }))).toBe(false);
  });
  it('ne match pas une tâche déjà en retard', () => {
    expect(matches(task({ deadline: iso(-1) }))).toBe(false);
  });
});

describe('SMART_PRESETS.high-priority', () => {
  const matches = (t: Task) => preset('high-priority').matches(t, NOW);

  it('match priorité 1 et 2', () => {
    expect(matches(task({ priority: 1 }))).toBe(true);
    expect(matches(task({ priority: 2 }))).toBe(true);
  });
  it('ne match pas priorité 3+', () => {
    expect(matches(task({ priority: 3 }))).toBe(false);
  });
  it('ne match pas une tâche complétée même prioritaire', () => {
    expect(matches(task({ priority: 1, completed: true }))).toBe(false);
  });
});

describe('tasksInList', () => {
  const list = (over: Partial<TaskList>): TaskList => ({
    id: 'l1',
    name: 'Liste',
    color: 'blue',
    taskIds: [],
    ...over,
  } as TaskList);

  it('liste manuelle → intersection par taskIds', () => {
    const a = task();
    const b = task();
    const result = tasksInList(list({ taskIds: [a.id] }), [a, b], NOW);
    expect(result).toEqual([a]);
  });

  it('liste smart → applique le preset', () => {
    const overdue = task({ deadline: iso(-2) });
    const fresh = task({ deadline: iso(5) });
    const result = tasksInList(
      list({ type: 'smart', smartRule: 'overdue' }),
      [overdue, fresh],
      NOW,
    );
    expect(result).toEqual([overdue]);
  });

  it('liste smart avec preset inconnu → vide', () => {
    const result = tasksInList(
      // @ts-expect-error preset volontairement invalide
      list({ type: 'smart', smartRule: 'does-not-exist' }),
      [task()],
      NOW,
    );
    expect(result).toEqual([]);
  });
});

describe('tasksDueToday', () => {
  it('inclut une tâche due aujourd’hui non complétée', () => {
    const t = task({ deadline: iso(0) });
    expect(tasksDueToday([t], NOW)).toEqual([t]);
  });
  it('exclut complétée, sans deadline, hier et demain', () => {
    const tasks = [
      task({ deadline: iso(0), completed: true }),
      task({ deadline: '' }),
      task({ deadline: iso(-1) }),
      task({ deadline: iso(1) }),
    ];
    expect(tasksDueToday(tasks, NOW)).toEqual([]);
  });
});
