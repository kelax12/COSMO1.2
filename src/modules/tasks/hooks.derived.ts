// ═══════════════════════════════════════════════════════════════════
// TASKS MODULE - Derived/Computed Hooks (Performance Optimized)
//
// All hooks consume the canonical Task shape: `name`, `category`, `deadline`,
// `bookmarked`, `completed`. The previous version of this file referenced
// `title`, `categoryId`, `dueDate`, `isBookmarked`, and a `status` enum that
// don't exist on Task — every hook returned wrong data, and `useSearchTasks`
// crashed on first run. Faille B6.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useCallback } from 'react';
import { useTasks } from './hooks';
import { Task, TaskStatus } from './types';

const statusOf = (task: Task): TaskStatus => (task.completed ? 'completed' : 'todo');

// ═══════════════════════════════════════════════════════════════════
// SELECTORS
// ═══════════════════════════════════════════════════════════════════

export const useTasksByStatus = () => {
  const { data: tasks = [], ...rest } = useTasks();

  const grouped = useMemo(() => {
    const result: Record<TaskStatus, Task[]> = { todo: [], completed: [] };
    tasks.forEach((task) => {
      result[statusOf(task)].push(task);
    });
    return result;
  }, [tasks]);

  return { data: grouped, ...rest };
};

export const useTasksByCategory = () => {
  const { data: tasks = [], ...rest } = useTasks();

  const grouped = useMemo(() => {
    const result: Record<string, Task[]> = {};
    tasks.forEach((task) => {
      const categoryId = task.category || 'uncategorized';
      if (!result[categoryId]) result[categoryId] = [];
      result[categoryId].push(task);
    });
    return result;
  }, [tasks]);

  return { data: grouped, ...rest };
};

export const useTasksByPriority = () => {
  const { data: tasks = [], ...rest } = useTasks();

  const grouped = useMemo(() => {
    const result: Record<number, Task[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    tasks.forEach((task) => {
      const priority = task.priority || 3;
      if (result[priority]) result[priority].push(task);
    });
    return result;
  }, [tasks]);

  return { data: grouped, ...rest };
};

// ═══════════════════════════════════════════════════════════════════
// STATISTICS
// ═══════════════════════════════════════════════════════════════════

export const useTaskStats = () => {
  const { data: tasks = [], ...rest } = useTasks();

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const todo = total - completed;
    const bookmarked = tasks.filter((t) => t.bookmarked).length;
    const now = new Date();
    const overdue = tasks.filter((t) => {
      if (!t.deadline || t.completed) return false;
      return new Date(t.deadline) < now;
    }).length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const byPriority = tasks.reduce((acc, t) => {
      const p = t.priority || 3;
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return {
      total,
      completed,
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
// SEARCH & FILTER
// ═══════════════════════════════════════════════════════════════════

export const useSearchTasks = (searchTerm: string) => {
  const { data: tasks = [], ...rest } = useTasks();

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return tasks;
    const term = searchTerm.toLowerCase();
    return tasks.filter(
      (task) =>
        (task.name || '').toLowerCase().includes(term) ||
        (task.description || '').toLowerCase().includes(term)
    );
  }, [tasks, searchTerm]);

  return { data: filtered, ...rest };
};

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

export const useTasksDueWithinDays = (days: number) => {
  const { data: tasks = [], ...rest } = useTasks();

  const filtered = useMemo(() => {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + days);

    return tasks.filter((task) => {
      if (!task.deadline || task.completed) return false;
      const dueDate = new Date(task.deadline);
      return dueDate >= now && dueDate <= futureDate;
    });
  }, [tasks, days]);

  return { data: filtered, ...rest };
};

// ═══════════════════════════════════════════════════════════════════
// LOOKUP
// ═══════════════════════════════════════════════════════════════════

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
