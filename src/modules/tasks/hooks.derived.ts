// ═══════════════════════════════════════════════════════════════════
// TASKS MODULE - Derived/Computed Hooks (Performance Optimized)
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useCallback } from 'react';
import { useTasks } from './hooks';
import { Task, TaskStatus } from './types';

// ═══════════════════════════════════════════════════════════════════
// SELECTORS - Memoized data transformations
// ═══════════════════════════════════════════════════════════════════

/**
 * Get tasks grouped by status with memoization
 * Prevents unnecessary recalculations on re-renders
 */
export const useTasksByStatus = () => {
  const { data: tasks = [], ...rest } = useTasks();

  const grouped = useMemo(() => {
    const result: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      completed: [],
    };

    tasks.forEach((task) => {
      const status = task.status || 'todo';
      if (result[status]) {
        result[status].push(task);
      }
    });

    return result;
  }, [tasks]);

  return { data: grouped, ...rest };
};

/**
 * Get tasks grouped by category with memoization
 */
export const useTasksByCategory = () => {
  const { data: tasks = [], ...rest } = useTasks();

  const grouped = useMemo(() => {
    const result: Record<string, Task[]> = {};

    tasks.forEach((task) => {
      const categoryId = task.categoryId || 'uncategorized';
      if (!result[categoryId]) {
        result[categoryId] = [];
      }
      result[categoryId].push(task);
    });

    return result;
  }, [tasks]);

  return { data: grouped, ...rest };
};

/**
 * Get tasks grouped by priority with memoization
 */
export const useTasksByPriority = () => {
  const { data: tasks = [], ...rest } = useTasks();

  const grouped = useMemo(() => {
    const result: Record<number, Task[]> = {
      1: [], 2: [], 3: [], 4: [], 5: [],
    };

    tasks.forEach((task) => {
      const priority = task.priority || 3;
      if (result[priority]) {
        result[priority].push(task);
      }
    });

    return result;
  }, [tasks]);

  return { data: grouped, ...rest };
};

// ═══════════════════════════════════════════════════════════════════
// STATISTICS - Computed metrics
// ═══════════════════════════════════════════════════════════════════

/**
 * Get task statistics with memoization
 */
export const useTaskStats = () => {
  const { data: tasks = [], ...rest } = useTasks();

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const todo = tasks.filter((t) => t.status === 'todo').length;
    const bookmarked = tasks.filter((t) => t.isBookmarked).length;
    const overdue = tasks.filter((t) => {
      if (!t.dueDate || t.status === 'completed') return false;
      return new Date(t.dueDate) < new Date();
    }).length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Priority distribution
    const byPriority = tasks.reduce((acc, t) => {
      const p = t.priority || 3;
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return {
      total,
      completed,
      inProgress,
      todo,
      bookmarked,
      overdue,
      completionRate,
      byPriority,
    };
  }, [tasks]);

  return { data: stats, ...rest };
};

// ═══════════════════════════════════════════════════════════════════
// SEARCH & FILTER - Client-side filtering
// ═══════════════════════════════════════════════════════════════════

/**
 * Search tasks by title/description with debounced memoization
 */
export const useSearchTasks = (searchTerm: string) => {
  const { data: tasks = [], ...rest } = useTasks();

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return tasks;

    const term = searchTerm.toLowerCase();
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(term) ||
        task.description?.toLowerCase().includes(term)
    );
  }, [tasks, searchTerm]);

  return { data: filtered, ...rest };
};

/**
 * Filter tasks by priority range
 */
export const useTasksInPriorityRange = (min: number, max: number) => {
  const { data: tasks = [], ...rest } = useTasks();

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      const priority = task.priority || 3;
      return priority >= min && priority <= max;
    });
  }, [tasks, min, max]);

  return { data: filtered, ...rest };
};

/**
 * Filter tasks due within N days
 */
export const useTasksDueWithinDays = (days: number) => {
  const { data: tasks = [], ...rest } = useTasks();

  const filtered = useMemo(() => {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + days);

    return tasks.filter((task) => {
      if (!task.dueDate || task.status === 'completed') return false;
      const dueDate = new Date(task.dueDate);
      return dueDate >= now && dueDate <= futureDate;
    });
  }, [tasks, days]);

  return { data: filtered, ...rest };
};

// ═══════════════════════════════════════════════════════════════════
// LOOKUP - Fast ID-based access
// ═══════════════════════════════════════════════════════════════════

/**
 * Get a memoized lookup function for tasks by ID
 * Useful for components that need to look up multiple tasks
 */
export const useTaskLookup = () => {
  const { data: tasks = [] } = useTasks();

  const lookup = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((task) => map.set(task.id, task));
    return map;
  }, [tasks]);

  const getTask = useCallback(
    (id: string): Task | undefined => lookup.get(id),
    [lookup]
  );

  return { lookup, getTask };
};
