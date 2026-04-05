// ═══════════════════════════════════════════════════════════════════
// TASKS MODULE - Unit Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalTasksRepository } from '@/modules/tasks/local.repository';
import { Task, TaskStatus, CreateTaskInput } from '@/modules/tasks/types';
import { taskKeys, TASKS_STORAGE_KEY } from '@/modules/tasks/constants';

// ═══════════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════════

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

// ═══════════════════════════════════════════════════════════════════
// TYPES TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Tasks Types', () => {
  it('should have correct TaskStatus values', () => {
    const statuses: TaskStatus[] = ['todo', 'in_progress', 'completed'];
    expect(statuses).toContain('todo');
    expect(statuses).toContain('in_progress');
    expect(statuses).toContain('completed');
  });

  it('should create valid Task object', () => {
    const task: Task = {
      id: '1',
      title: 'Test Task',
      description: 'A test task',
      status: 'todo',
      priority: 3,
      dueDate: '2026-01-15',
      categoryId: 'cat-1',
      isBookmarked: false,
    };

    expect(task.id).toBe('1');
    expect(task.title).toBe('Test Task');
    expect(task.status).toBe('todo');
    expect(task.priority).toBe(3);
    expect(task.isBookmarked).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Tasks Constants', () => {
  it('should have correct storage key', () => {
    expect(TASKS_STORAGE_KEY).toBe('cosmo_tasks');
  });

  it('should have correct query keys structure', () => {
    expect(taskKeys.all).toEqual(['tasks']);
    expect(taskKeys.lists()).toEqual(['tasks', 'list']);
    expect(taskKeys.detail('123')).toEqual(['tasks', 'detail', '123']);
  });
});

// ═══════════════════════════════════════════════════════════════════
// LOCAL REPOSITORY TESTS
// ═══════════════════════════════════════════════════════════════════

describe('LocalTasksRepository', () => {
  let repository: LocalTasksRepository;

  beforeEach(() => {
    mockLocalStorage.clear();
    repository = new LocalTasksRepository();
  });

  describe('getAll', () => {
    it('should return empty array when no tasks exist', async () => {
      const tasks = await repository.getAll();
      expect(tasks).toEqual([]);
    });

    it('should return tasks from localStorage', async () => {
      const mockTasks: Task[] = [
        { id: '1', title: 'Task 1', status: 'todo', priority: 3 },
        { id: '2', title: 'Task 2', status: 'completed', priority: 1 },
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const tasks = await repository.getAll();
      expect(tasks).toHaveLength(2);
      expect(tasks[0].title).toBe('Task 1');
    });
  });

  describe('getById', () => {
    it('should return null for non-existent task', async () => {
      const task = await repository.getById('non-existent');
      expect(task).toBeNull();
    });

    it('should return task by id', async () => {
      const mockTasks: Task[] = [
        { id: '1', title: 'Task 1', status: 'todo', priority: 3 },
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const task = await repository.getById('1');
      expect(task).not.toBeNull();
      expect(task?.title).toBe('Task 1');
    });
  });

  describe('create', () => {
    it('should create a new task with generated id', async () => {
      const input: CreateTaskInput = {
        title: 'New Task',
        description: 'A new task',
        status: 'todo',
        priority: 2,
      };

      const task = await repository.create(input);

      expect(task.id).toBeDefined();
      expect(task.title).toBe('New Task');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe(2);
    });

    it('should persist task to localStorage', async () => {
      const input: CreateTaskInput = {
        title: 'Persisted Task',
        status: 'todo',
        priority: 1,
      };

      await repository.create(input);

      const stored = JSON.parse(mockLocalStorage.getItem(TASKS_STORAGE_KEY) || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].title).toBe('Persisted Task');
    });
  });

  describe('update', () => {
    it('should update existing task', async () => {
      const mockTasks: Task[] = [
        { id: '1', title: 'Original', status: 'todo', priority: 3 },
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const updated = await repository.update('1', { title: 'Updated' });

      expect(updated.title).toBe('Updated');
      expect(updated.status).toBe('todo'); // Unchanged
    });

    it('should throw error for non-existent task', async () => {
      await expect(repository.update('non-existent', { title: 'Test' }))
        .rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete existing task', async () => {
      const mockTasks: Task[] = [
        { id: '1', title: 'Task 1', status: 'todo', priority: 3 },
        { id: '2', title: 'Task 2', status: 'completed', priority: 1 },
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      await repository.delete('1');

      const remaining = JSON.parse(mockLocalStorage.getItem(TASKS_STORAGE_KEY) || '[]');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('2');
    });
  });

  describe('toggleComplete', () => {
    it('should toggle task from todo to completed', async () => {
      const mockTasks: Task[] = [
        { id: '1', title: 'Task', status: 'todo', priority: 3 },
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const toggled = await repository.toggleComplete('1');

      expect(toggled.status).toBe('completed');
    });

    it('should toggle task from completed to todo', async () => {
      const mockTasks: Task[] = [
        { id: '1', title: 'Task', status: 'completed', priority: 3 },
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const toggled = await repository.toggleComplete('1');

      expect(toggled.status).toBe('todo');
    });
  });

  describe('toggleBookmark', () => {
    it('should toggle bookmark status', async () => {
      const mockTasks: Task[] = [
        { id: '1', title: 'Task', status: 'todo', priority: 3, isBookmarked: false },
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const toggled = await repository.toggleBookmark('1');

      expect(toggled.isBookmarked).toBe(true);
    });
  });
});
