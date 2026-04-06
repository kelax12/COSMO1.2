// ═══════════════════════════════════════════════════════════════════
// TASKS MODULE - Unit Tests
// Synchronisé avec src/modules/tasks/types.ts
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalTasksRepository } from '@/modules/tasks/local.repository';
import { Task, CreateTaskInput } from '@/modules/tasks/types';
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
// Corrected: Task uses `name` (not `title`), `completed: boolean` (not `status`),
//            `bookmarked` (not `isBookmarked`), `deadline` (not `dueDate`)
// ═══════════════════════════════════════════════════════════════════

describe('Tasks Types', () => {
  it('should create a valid Task object with real fields', () => {
    const task: Task = {
      id: '1',
      name: 'Test Task',
      description: 'A test task',
      completed: false,
      bookmarked: false,
      priority: 3,
      category: 'Personnel',
      deadline: '2026-01-15T00:00:00.000Z',
      estimatedTime: 30,
    };

    expect(task.id).toBe('1');
    expect(task.name).toBe('Test Task');
    expect(task.completed).toBe(false);
    expect(task.bookmarked).toBe(false);
    expect(task.priority).toBe(3);
  });

  it('should allow optional fields to be undefined', () => {
    const minimalTask: Task = {
      id: '2',
      name: 'Minimal Task',
      completed: false,
      bookmarked: false,
      priority: 1,
      category: '',
      deadline: '2026-06-01T00:00:00.000Z',
      estimatedTime: 0,
    };

    expect(minimalTask.description).toBeUndefined();
    expect(minimalTask.completedAt).toBeUndefined();
    expect(minimalTask.isCollaborative).toBeUndefined();
    expect(minimalTask.collaborators).toBeUndefined();
  });

  it('should support collaborative task fields', () => {
    const collaborativeTask: Task = {
      id: '3',
      name: 'Collab Task',
      completed: false,
      bookmarked: false,
      priority: 2,
      category: 'Travail',
      deadline: '2026-03-01T00:00:00.000Z',
      estimatedTime: 60,
      isCollaborative: true,
      collaborators: ['user-1@example.com', 'user-2@example.com'],
      pendingInvites: ['user-3@example.com'],
    };

    expect(collaborativeTask.isCollaborative).toBe(true);
    expect(collaborativeTask.collaborators).toHaveLength(2);
    expect(collaborativeTask.pendingInvites).toHaveLength(1);
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

  // Données de test alignées sur les vrais types Task
  const makeTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'default-id',
    name: 'Default Task',
    completed: false,
    bookmarked: false,
    priority: 3,
    category: 'Personnel',
    deadline: '2026-01-15T00:00:00.000Z',
    estimatedTime: 30,
    ...overrides,
  });

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
        makeTask({ id: '1', name: 'Task 1' }),
        makeTask({ id: '2', name: 'Task 2', completed: true }),
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const tasks = await repository.getAll();
      expect(tasks).toHaveLength(2);
      expect(tasks[0].name).toBe('Task 1');
    });
  });

  describe('getById', () => {
    it('should return null for non-existent task', async () => {
      const task = await repository.getById('non-existent');
      expect(task).toBeNull();
    });

    it('should return task by id', async () => {
      const mockTasks: Task[] = [makeTask({ id: '1', name: 'Task 1' })];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const task = await repository.getById('1');
      expect(task).not.toBeNull();
      expect(task?.name).toBe('Task 1');
    });
  });

  describe('create', () => {
    it('should create a new task with generated id', async () => {
      const input: CreateTaskInput = {
        name: 'New Task',
        description: 'A new task',
        completed: false,
        bookmarked: false,
        priority: 2,
        category: 'Travail',
        deadline: '2026-02-01T00:00:00.000Z',
        estimatedTime: 45,
      };

      const task = await repository.create(input);

      expect(task.id).toBeDefined();
      expect(task.name).toBe('New Task');
      expect(task.completed).toBe(false);
      expect(task.priority).toBe(2);
    });

    it('should persist task to localStorage', async () => {
      const input: CreateTaskInput = {
        name: 'Persisted Task',
        completed: false,
        bookmarked: false,
        priority: 1,
        category: '',
        deadline: '2026-03-01T00:00:00.000Z',
        estimatedTime: 0,
      };

      await repository.create(input);

      const stored = JSON.parse(mockLocalStorage.getItem(TASKS_STORAGE_KEY) || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Persisted Task');
    });
  });

  describe('update', () => {
    it('should update existing task', async () => {
      const mockTasks: Task[] = [makeTask({ id: '1', name: 'Original' })];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const updated = await repository.update('1', { name: 'Updated' });

      expect(updated.name).toBe('Updated');
      expect(updated.completed).toBe(false); // Unchanged
    });

    it('should throw error for non-existent task', async () => {
      await expect(repository.update('non-existent', { name: 'Test' }))
        .rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete existing task', async () => {
      const mockTasks: Task[] = [
        makeTask({ id: '1', name: 'Task 1' }),
        makeTask({ id: '2', name: 'Task 2', completed: true }),
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      await repository.delete('1');

      const remaining = JSON.parse(mockLocalStorage.getItem(TASKS_STORAGE_KEY) || '[]');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('2');
    });
  });

  describe('toggleComplete', () => {
    it('should toggle task from not completed to completed', async () => {
      const mockTasks: Task[] = [makeTask({ id: '1', completed: false })];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const toggled = await repository.toggleComplete('1');

      expect(toggled.completed).toBe(true);
      expect(toggled.completedAt).toBeDefined();
    });

    it('should toggle task from completed to not completed', async () => {
      const mockTasks: Task[] = [
        makeTask({ id: '1', completed: true, completedAt: new Date().toISOString() }),
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const toggled = await repository.toggleComplete('1');

      expect(toggled.completed).toBe(false);
      expect(toggled.completedAt).toBeUndefined();
    });
  });

  describe('toggleBookmark', () => {
    it('should toggle bookmark from false to true', async () => {
      const mockTasks: Task[] = [makeTask({ id: '1', bookmarked: false })];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const toggled = await repository.toggleBookmark('1');

      expect(toggled.bookmarked).toBe(true);
    });

    it('should toggle bookmark from true to false', async () => {
      const mockTasks: Task[] = [makeTask({ id: '1', bookmarked: true })];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const toggled = await repository.toggleBookmark('1');

      expect(toggled.bookmarked).toBe(false);
    });
  });
});
