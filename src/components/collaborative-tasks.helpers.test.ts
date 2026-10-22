import { describe, it, expect } from 'vitest';
import { selectCollaborativeTasks } from './collaborative-tasks.helpers';
import type { Task } from '@/modules/tasks';

const makeTask = (overrides: Partial<Task>): Task => ({
  id: 'task-1',
  name: 'Tache',
  category: 'cat-1',
  priority: 1,
  completed: false,
  isCollaborative: false,
  ...overrides,
} as Task);

describe('selectCollaborativeTasks', () => {
  it('inclut une tâche collaborative dont je suis propriétaire (pas de sharedBy)', () => {
    const tasks = [makeTask({ id: 't1', isCollaborative: true, sharedBy: undefined })];
    expect(selectCollaborativeTasks(tasks, 'Axel').map(t => t.id)).toEqual(['t1']);
  });

  it('inclut une tâche partagée par moi-même', () => {
    const tasks = [makeTask({ id: 't2', isCollaborative: true, sharedBy: 'Axel' })];
    expect(selectCollaborativeTasks(tasks, 'Axel').map(t => t.id)).toEqual(['t2']);
  });

  it('exclut une tâche partagée par quelqu\'un d\'autre (en attente d\'acceptation)', () => {
    const tasks = [makeTask({ id: 't3', isCollaborative: true, sharedBy: 'Quelqu\'un d\'autre' })];
    expect(selectCollaborativeTasks(tasks, 'Axel')).toEqual([]);
  });

  it('exclut une tâche non collaborative', () => {
    const tasks = [makeTask({ id: 't4', isCollaborative: false, sharedBy: undefined })];
    expect(selectCollaborativeTasks(tasks, 'Axel')).toEqual([]);
  });
});
