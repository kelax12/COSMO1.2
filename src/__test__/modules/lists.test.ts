// ═══════════════════════════════════════════════════════════════════
// LISTS MODULE - Unit Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskList, CreateListInput } from '@/modules/lists/types';
import { listKeys, LISTS_STORAGE_KEY } from '@/modules/lists/constants';

// ═══════════════════════════════════════════════════════════════════
// TYPES TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Lists Types', () => {
  it('should create valid TaskList object', () => {
    const list: TaskList = {
      id: 'list-1',
      name: 'Work Tasks',
      color: '#3B82F6',
      taskIds: ['task-1', 'task-2', 'task-3'],
    };

    expect(list.id).toBe('list-1');
    expect(list.name).toBe('Work Tasks');
    expect(list.color).toBe('#3B82F6');
    expect(list.taskIds).toHaveLength(3);
  });

  it('should create TaskList with empty taskIds', () => {
    const list: TaskList = {
      id: 'list-2',
      name: 'Empty List',
      color: '#10B981',
      taskIds: [],
    };

    expect(list.taskIds).toEqual([]);
  });

  it('should create valid CreateListInput', () => {
    const input: CreateListInput = {
      name: 'New List',
      color: '#EF4444',
    };

    expect(input.name).toBe('New List');
    expect(input.color).toBe('#EF4444');
  });
});

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Lists Constants', () => {
  it('should have correct storage key', () => {
    expect(LISTS_STORAGE_KEY).toBe('cosmo_lists');
  });

  it('should have correct query keys structure', () => {
    expect(listKeys.all).toEqual(['lists']);
    expect(listKeys.lists()).toEqual(['lists', 'list']);
    expect(listKeys.detail('list-1')).toEqual(['lists', 'detail', 'list-1']);
    expect(listKeys.byTask('task-1')).toEqual(['lists', 'byTask', 'task-1']);
  });
});

// ═══════════════════════════════════════════════════════════════════
// LIST OPERATIONS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('List Operations', () => {
  it('should add task to list', () => {
    const addTaskToList = (list: TaskList, taskId: string): TaskList => {
      if (list.taskIds.includes(taskId)) return list;
      return { ...list, taskIds: [...list.taskIds, taskId] };
    };

    const list: TaskList = { id: '1', name: 'List', color: '#000', taskIds: ['a', 'b'] };
    const updated = addTaskToList(list, 'c');

    expect(updated.taskIds).toEqual(['a', 'b', 'c']);
  });

  it('should not duplicate task in list', () => {
    const addTaskToList = (list: TaskList, taskId: string): TaskList => {
      if (list.taskIds.includes(taskId)) return list;
      return { ...list, taskIds: [...list.taskIds, taskId] };
    };

    const list: TaskList = { id: '1', name: 'List', color: '#000', taskIds: ['a', 'b'] };
    const updated = addTaskToList(list, 'a');

    expect(updated.taskIds).toEqual(['a', 'b']);
  });

  it('should remove task from list', () => {
    const removeTaskFromList = (list: TaskList, taskId: string): TaskList => {
      return { ...list, taskIds: list.taskIds.filter(id => id !== taskId) };
    };

    const list: TaskList = { id: '1', name: 'List', color: '#000', taskIds: ['a', 'b', 'c'] };
    const updated = removeTaskFromList(list, 'b');

    expect(updated.taskIds).toEqual(['a', 'c']);
  });

  it('should check if task is in list', () => {
    const isTaskInList = (list: TaskList, taskId: string): boolean => {
      return list.taskIds.includes(taskId);
    };

    const list: TaskList = { id: '1', name: 'List', color: '#000', taskIds: ['a', 'b'] };

    expect(isTaskInList(list, 'a')).toBe(true);
    expect(isTaskInList(list, 'c')).toBe(false);
  });

  it('should count tasks in list', () => {
    const list: TaskList = { id: '1', name: 'List', color: '#000', taskIds: ['a', 'b', 'c'] };
    expect(list.taskIds.length).toBe(3);
  });
});
