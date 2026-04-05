// ═══════════════════════════════════════════════════════════════════
// TASKS MODULE - React Query Integration Tests
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
  useTasksByStatus,
  useTaskStats,
  useSearchTasks,
} from '@/modules/tasks';
import { TASKS_STORAGE_KEY } from '@/modules/tasks/constants';
import { Task } from '@/modules/tasks/types';

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

      // Initial state
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('should fetch tasks from localStorage', async () => {
      const mockTasks: Task[] = [
        { id: '1', title: 'Task 1', status: 'todo', priority: 3 },
        { id: '2', title: 'Task 2', status: 'completed', priority: 1 },
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTasks(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].title).toBe('Task 1');
    });
  });

  describe('useTask', () => {
    it('should fetch single task by ID', async () => {
      const mockTasks: Task[] = [
        { id: 'task-123', title: 'Specific Task', status: 'todo', priority: 2 },
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTask('task-123'), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.title).toBe('Specific Task');
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

      // Should not be loading because query is disabled
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
      const { Wrapper, queryClient } = createWrapper();
      const { result } = renderHook(() => useCreateTask(), { wrapper: Wrapper });

      await act(async () => {
        result.current.mutate({
          title: 'New Task',
          status: 'todo',
          priority: 3,
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Verify task was created
      const stored = JSON.parse(mockLocalStorage.getItem(TASKS_STORAGE_KEY) || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].title).toBe('New Task');
    });

    it('should generate unique ID for new task', async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useCreateTask(), { wrapper: Wrapper });

      await act(async () => {
        result.current.mutate({ title: 'Task 1', status: 'todo', priority: 1 });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      await act(async () => {
        result.current.mutate({ title: 'Task 2', status: 'todo', priority: 2 });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const stored = JSON.parse(mockLocalStorage.getItem(TASKS_STORAGE_KEY) || '[]');
      expect(stored[0].id).not.toBe(stored[1].id);
    });
  });

  describe('useUpdateTask', () => {
    it('should update existing task', async () => {
      const mockTasks: Task[] = [
        { id: '1', title: 'Original', status: 'todo', priority: 3 },
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateTask(), { wrapper: Wrapper });

      await act(async () => {
        result.current.mutate({ id: '1', updates: { title: 'Updated' } });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const stored = JSON.parse(mockLocalStorage.getItem(TASKS_STORAGE_KEY) || '[]');
      expect(stored[0].title).toBe('Updated');
      expect(stored[0].status).toBe('todo'); // Unchanged
    });
  });

  describe('useDeleteTask', () => {
    it('should delete task by ID', async () => {
      const mockTasks: Task[] = [
        { id: '1', title: 'Task 1', status: 'todo', priority: 1 },
        { id: '2', title: 'Task 2', status: 'todo', priority: 2 },
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useDeleteTask(), { wrapper: Wrapper });

      await act(async () => {
        result.current.mutate('1');
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const stored = JSON.parse(mockLocalStorage.getItem(TASKS_STORAGE_KEY) || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('2');
    });
  });

  describe('useToggleTaskComplete', () => {
    it('should toggle task from todo to completed', async () => {
      const mockTasks: Task[] = [
        { id: '1', title: 'Task', status: 'todo', priority: 3 },
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useToggleTaskComplete(), { wrapper: Wrapper });

      await act(async () => {
        result.current.mutate('1');
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const stored = JSON.parse(mockLocalStorage.getItem(TASKS_STORAGE_KEY) || '[]');
      expect(stored[0].status).toBe('completed');
    });

    it('should toggle task from completed to todo', async () => {
      const mockTasks: Task[] = [
        { id: '1', title: 'Task', status: 'completed', priority: 3 },
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useToggleTaskComplete(), { wrapper: Wrapper });

      await act(async () => {
        result.current.mutate('1');
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const stored = JSON.parse(mockLocalStorage.getItem(TASKS_STORAGE_KEY) || '[]');
      expect(stored[0].status).toBe('todo');
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

  describe('useTasksByStatus', () => {
    it('should group tasks by status', async () => {
      const mockTasks: Task[] = [
        { id: '1', title: 'Todo 1', status: 'todo', priority: 1 },
        { id: '2', title: 'Todo 2', status: 'todo', priority: 2 },
        { id: '3', title: 'In Progress', status: 'in_progress', priority: 3 },
        { id: '4', title: 'Completed', status: 'completed', priority: 4 },
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTasksByStatus(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.todo).toHaveLength(2);
      expect(result.current.data?.in_progress).toHaveLength(1);
      expect(result.current.data?.completed).toHaveLength(1);
    });
  });

  describe('useTaskStats', () => {
    it('should calculate task statistics', async () => {
      const mockTasks: Task[] = [
        { id: '1', title: 'T1', status: 'todo', priority: 1 },
        { id: '2', title: 'T2', status: 'todo', priority: 2 },
        { id: '3', title: 'T3', status: 'completed', priority: 3 },
        { id: '4', title: 'T4', status: 'completed', priority: 3 },
        { id: '5', title: 'T5', status: 'in_progress', priority: 5, isBookmarked: true },
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTaskStats(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.total).toBe(5);
      expect(result.current.data?.completed).toBe(2);
      expect(result.current.data?.todo).toBe(2);
      expect(result.current.data?.inProgress).toBe(1);
      expect(result.current.data?.bookmarked).toBe(1);
      expect(result.current.data?.completionRate).toBe(40); // 2/5 = 40%
    });
  });

  describe('useSearchTasks', () => {
    it('should filter tasks by search term', async () => {
      const mockTasks: Task[] = [
        { id: '1', title: 'Buy groceries', status: 'todo', priority: 1 },
        { id: '2', title: 'Call dentist', status: 'todo', priority: 2 },
        { id: '3', title: 'Buy birthday gift', status: 'todo', priority: 3 },
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useSearchTasks('buy'), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].title).toContain('Buy');
    });

    it('should return all tasks when search term is empty', async () => {
      const mockTasks: Task[] = [
        { id: '1', title: 'Task 1', status: 'todo', priority: 1 },
        { id: '2', title: 'Task 2', status: 'todo', priority: 2 },
      ];
      mockLocalStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mockTasks));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useSearchTasks(''), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
    });
  });
});
