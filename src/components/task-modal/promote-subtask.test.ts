import { describe, it, expect } from 'vitest';
import { buildPromotion, restoreSubtask } from './promote-subtask';
import type { Task } from '@/modules/tasks';

const parent: Task = {
  id: 'p', name: 'Parent', priority: 2, category: 'cat-1',
  deadline: '2026-10-09T22:00:00.000Z', estimatedTime: 30,
  bookmarked: true, completed: false, recurrence: 'weekly', krId: 'kr-1',
  status: 'blocked', health: 'at_risk',
  subtasks: [
    { id: 's1', name: 'Un', completed: false },
    { id: 's2', name: 'Deux', completed: false },
    { id: 's3', name: 'Trois', completed: true },
  ],
};

describe('buildPromotion', () => {
  it('hérite catégorie et priorité, rien d autre', () => {
    const r = buildPromotion(parent, 's2');
    expect(r?.input).toEqual({
      name: 'Deux', priority: 2, category: 'cat-1', deadline: '',
      estimatedTime: 0, bookmarked: false, completed: false, status: 'todo',
    });
  });

  it('retire la sous-tâche et dit où elle était', () => {
    const r = buildPromotion(parent, 's2');
    expect(r?.remaining.map((s) => s.id)).toEqual(['s1', 's3']);
    expect(r?.index).toBe(1);
    expect(r?.subtask).toEqual({ id: 's2', name: 'Deux', completed: false });
  });

  it('refuse une sous-tâche cochée ou inconnue', () => {
    expect(buildPromotion(parent, 's3')).toBeNull();
    expect(buildPromotion(parent, 'nope')).toBeNull();
    expect(buildPromotion({ ...parent, subtasks: undefined }, 's1')).toBeNull();
  });
});

describe('restoreSubtask', () => {
  it('la remet à sa place', () => {
    const r = buildPromotion(parent, 's2')!;
    expect(restoreSubtask(r.remaining, r.subtask, r.index).map((s) => s.id)).toEqual(['s1', 's2', 's3']);
  });

  it('borne la position si la liste a raccourci entre-temps', () => {
    expect(restoreSubtask([], { id: 'x', name: 'X', completed: false }, 4).map((s) => s.id)).toEqual(['x']);
  });

  it('ne la double pas si elle est déjà revenue', () => {
    const list = [{ id: 's2', name: 'Deux', completed: false }];
    expect(restoreSubtask(list, list[0], 0)).toHaveLength(1);
  });
});
