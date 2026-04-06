// ═══════════════════════════════════════════════════════════════════
// TASKS MODULE - React Query Integration Tests
// Synchronisé avec src/modules/tasks/types.ts
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode } from 'react';

import {
  useTasks,
  useTask,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useToggleTaskComplete,
  useTaskStats,
  useSearchTasks,
} from '@/modules/tasks';
import { TASKS_STORAGE_KEY } from '@/modules/tasks/constants';
import { Task, CreateTaskInput } from '@/modules/tasks/types';

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

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  return { Wrapper, queryClient };
};

// Helper — crée une Task valide selon les vrais types
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

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Tasks React Query Integration', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('useTasks', () => {
    it('should fetch tasks and return empty array initially', async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTasks(), { wrapper: Wrapper });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('should fetch tasks from localStorage', async () => {
      const mockTasks: Task[] = [
        makeTask({ id: '1', name: 'Task 1' }),
        makeTask({ id: '2', name: 'Task 2', completed: true }),
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTasks(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].name).toBe('Task 1');
    });
  });

  describe('useTask', () => {
    it('should fetch single task by ID', async () => {
      const mockTasks: Task[] = [
        makeTask({ id: 'task-123', name: 'Specific Task', priority: 2 }),
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTask('task-123'), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.name).toBe('Specific Task');
      expect(result.current.data?.priority).toBe(2);
    });

    it('should return null for non-existent task', async () => {
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify([]));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTask('non-existent'), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeNull();
    });

    it('should not fetch when ID is empty (enabled: false)', async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTask(''), { wrapper: Wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// MUTATION HOOKS INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Tasks Mutations Integration', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('useCreateTask', () => {
    it('should create a new task', async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useCreateTask(), { wrapper: Wrapper });

      const input: CreateTaskInput = {
        name: 'New Task',
        completed: false,
        bookmarked: false,
        priority: 3,
        category: 'Travail',
        deadline: '2026-02-01T00:00:00.000Z',
        estimatedTime: 45,
      };

      await act(async () => {
        result.current.mutate(input);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const stored = JSON.parse(mockLocalStorage.getItem(TASKS_STORAGE_KEY) || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('New Task');
    });

    it('should generate unique IDs for each task', async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useCreateTask(), { wrapper: Wrapper });

      const base: CreateTaskInput = {
        name: 'Task',
        completed: false,
        bookmarked: false,
        priority: 1,
        category: '',
        deadline: '2026-01-01T00:00:00.000Z',
        estimatedTime: 0,
      };

      await act(async () => { result.current.mutate({ ...base, name: 'Task 1' }); });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      await act(async () => { result.current.mutate({ ...base, name: 'Task 2' }); });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const stored = JSON.parse(mockLocalStorage.getItem(TASKS_STORAGE_KEY) || '[]');
      expect(stored).toHaveLength(2);
      expect(stored[0].id).not.toBe(stored[1].id);
    });
  });

  describe('useUpdateTask', () => {
    it('should update existing task name', async () => {
      const mockTasks: Task[] = [makeTask({ id: '1', name: 'Original' })];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTask(), { wrapper: Wrapper });

      await act(async () => {
        result.current.mutate({ id: '1', updates: { name: 'Updated' } });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const stored = JSON.parse(mockLocalStorage.getItem(TASKS_STORAGE_KEY) || '[]');
      expect(stored[0].name).toBe('Updated');
      expect(stored[0].completed).toBe(false); // Unchanged
    });
  });

  describe('useDeleteTask', () => {
    it('should delete task by ID', async () => {
      const mockTasks: Task[] = [
        makeTask({ id: '1', name: 'Task 1' }),
        makeTask({ id: '2', name: 'Task 2' }),
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useDeleteTask(), { wrapper: Wrapper });

      await act(async () => { result.current.mutate('1'); });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const stored = JSON.parse(mockLocalStorage.getItem(TASKS_STORAGE_KEY) || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('2');
    });
  });

  describe('useToggleTaskComplete', () => {
    it('should toggle task from not completed to completed', async () => {
      const mockTasks: Task[] = [makeTask({ id: '1', completed: false })];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useToggleTaskComplete(), { wrapper: Wrapper });

      await act(async () => { result.current.mutate('1'); });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const stored = JSON.parse(mockLocalStorage.getItem(TASKS_STORAGE_KEY) || '[]');
      expect(stored[0].completed).toBe(true);
    });

    it('should toggle task from completed to not completed', async () => {
      const mockTasks: Task[] = [
        makeTask({ id: '1', completed: true, completedAt: new Date().toISOString() }),
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useToggleTaskComplete(), { wrapper: Wrapper });

      await act(async () => { result.current.mutate('1'); });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const stored = JSON.parse(mockLocalStorage.getItem(TASKS_STORAGE_KEY) || '[]');
      expect(stored[0].completed).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// DERIVED HOOKS INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Tasks Derived Hooks Integration', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('useTaskStats', () => {
    it('should calculate task statistics with real Task fields', async () => {
      const mockTasks: Task[] = [
        makeTask({ id: '1', completed: false, bookmarked: false }),
        makeTask({ id: '2', completed: false, bookmarked: false }),
        makeTask({ id: '3', completed: true }),
        makeTask({ id: '4', completed: true }),
        makeTask({ id: '5', completed: false, bookmarked: true }),
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTaskStats(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.total).toBe(5);
      expect(result.current.data?.completed).toBe(2);
      expect(result.current.data?.bookmarked).toBe(1);
    });
  });

  describe('useSearchTasks', () => {
    it('should filter tasks by search term against name field', async () => {
      const mockTasks: Task[] = [
        makeTask({ id: '1', name: 'Buy groceries' }),
        makeTask({ id: '2', name: 'Call dentist' }),
        makeTask({ id: '3', name: 'Buy birthday gift' }),
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useSearchTasks('buy'), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.every(t => t.name.toLowerCase().includes('buy'))).toBe(true);
    });

    it('should return all tasks when search term is empty', async () => {
      const mockTasks: Task[] = [
        makeTask({ id: '1', name: 'Task 1' }),
        makeTask({ id: '2', name: 'Task 2' }),
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useSearchTasks(''), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
    });
  });
});
