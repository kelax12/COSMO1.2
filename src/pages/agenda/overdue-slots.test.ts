import { describe, it, expect } from 'vitest';
import { findOverdueTaskSlots } from './overdue-slots';
import type { CalendarEvent } from '@/modules/events';
import type { Task } from '@/modules/tasks';

const NOW = new Date('2026-07-21T12:00:00.000Z');

function ev(partial: Partial<CalendarEvent> & { id: string }): CalendarEvent {
  return {
    title: 'Créneau',
    start: '2026-07-21T09:00:00.000Z',
    end: '2026-07-21T10:00:00.000Z',
    ...partial,
  } as CalendarEvent;
}

function task(partial: Partial<Task> & { id: string }): Task {
  return {
    name: 'Tâche',
    priority: 3,
    category: 'cat-1',
    deadline: '2026-07-21',
    estimatedTime: 60,
    bookmarked: false,
    completed: false,
    ...partial,
  } as Task;
}

describe('findOverdueTaskSlots', () => {
  it('détecte un créneau de tâche terminé et non validé', () => {
    const events = [ev({ id: 'e1', taskId: 't1' })];
    const tasks = [task({ id: 't1' })];
    const res = findOverdueTaskSlots(events, tasks, NOW);
    expect(res).toHaveLength(1);
    expect(res[0].task.id).toBe('t1');
  });

  it('ignore un créneau dans le futur', () => {
    const events = [ev({ id: 'e1', taskId: 't1', start: '2026-07-21T13:00:00.000Z', end: '2026-07-21T14:00:00.000Z' })];
    expect(findOverdueTaskSlots(events, [task({ id: 't1' })], NOW)).toHaveLength(0);
  });

  it('ignore une tâche déjà validée', () => {
    const events = [ev({ id: 'e1', taskId: 't1' })];
    expect(findOverdueTaskSlots(events, [task({ id: 't1', completed: true })], NOW)).toHaveLength(0);
  });

  it('ignore un événement sans tâche liée', () => {
    expect(findOverdueTaskSlots([ev({ id: 'e1' })], [], NOW)).toHaveLength(0);
  });

  it('ignore une tâche inexistante', () => {
    expect(findOverdueTaskSlots([ev({ id: 'e1', taskId: 'ghost' })], [], NOW)).toHaveLength(0);
  });

  it('ignore les événements récurrents (master et instance)', () => {
    const events = [
      ev({ id: 'master', taskId: 't1', recurrence: 'weekly' }),
      ev({ id: 'master::2026-07-14', taskId: 't1' }),
    ];
    expect(findOverdueTaskSlots(events, [task({ id: 't1' })], NOW)).toHaveLength(0);
  });

  it('ignore les créneaux plus anciens que la fenêtre', () => {
    const events = [ev({ id: 'e1', taskId: 't1', start: '2026-07-01T09:00:00.000Z', end: '2026-07-01T10:00:00.000Z' })];
    expect(findOverdueTaskSlots(events, [task({ id: 't1' })], NOW, { windowDays: 14 })).toHaveLength(0);
  });

  it('trie du plus ancien au plus récent', () => {
    const events = [
      ev({ id: 'recent', taskId: 't2', start: '2026-07-21T10:30:00.000Z', end: '2026-07-21T11:00:00.000Z' }),
      ev({ id: 'older', taskId: 't1', start: '2026-07-20T10:00:00.000Z', end: '2026-07-20T11:00:00.000Z' }),
    ];
    const tasks = [task({ id: 't1' }), task({ id: 't2' })];
    const res = findOverdueTaskSlots(events, tasks, NOW);
    expect(res.map((r) => r.event.id)).toEqual(['older', 'recent']);
  });
});
