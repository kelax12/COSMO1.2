import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getTasksRepository } from '@/lib/repository.factory';
import { ITasksRepository } from './repository';
import { Task, CreateTaskInput, UpdateTaskInput, TaskFilters } from './types';
import { taskKeys } from './constants';
import { PaginationParams } from '@/lib/pagination.types';

// ═══════════════════════════════════════════════════════════════════
// Repository - Via centralized factory (demo/production mode)
// ═══════════════════════════════════════════════════════════════════
const useTasksRepository = (): ITasksRepository => {
  return useMemo(() => getTasksRepository(), []);
};

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS (Phase 1)
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch all tasks
 */
export const useTasks = (options?: { enabled?: boolean }) => {
  const repository = useTasksRepository();
  return useQuery({
    queryKey: taskKeys.lists(),
    queryFn: () => repository.getAll(),
    enabled: options?.enabled ?? true,
  });
};

/**
 * Fetch a single task by ID
 */
export const useTask = (id: string, options?: { enabled?: boolean }) => {
  const repository = useTasksRepository();
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => repository.getById(id),
    enabled: (options?.enabled ?? true) && !!id,
  });
};

/**
 * Fetch tasks by date (deadline)
 */
export const useTasksByDate = (date: string, options?: { enabled?: boolean }) => {
  const repository = useTasksRepository();
  return useQuery({
    queryKey: taskKeys.byDate(date),
    queryFn: () => repository.getByDate(date),
    enabled: (options?.enabled ?? true) && !!date,
  });
};

/**
 * Fetch tasks with filters
 */
export const useFilteredTasks = (filters: TaskFilters, options?: { enabled?: boolean }) => {
  const repository = useTasksRepository();
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => repository.getFiltered(filters),
    enabled: options?.enabled ?? true,
  });
};

// ═══════════════════════════════════════════════════════════════════
// Computed Hooks (derived data)
// ═══════════════════════════════════════════════════════════════════

/**
 * Get today's tasks
 */
export const useTodaysTasks = () => {
  const today = new Date().toISOString().split('T')[0];
  return useTasksByDate(today);
};

/**
 * Get pending tasks (not completed)
 */
export const usePendingTasks = () => {
  return useFilteredTasks({ completed: false });
};

/**
 * Get bookmarked tasks
 */
export const useBookmarkedTasks = () => {
  return useFilteredTasks({ bookmarked: true });
};

/**
 * Get completed tasks
 */
export const useCompletedTasks = () => {
  return useFilteredTasks({ completed: true });
};

// ═══════════════════════════════════════════════════════════════════
// WRITE HOOKS (Phase 2) - Mutations
// ═══════════════════════════════════════════════════════════════════

/**
 * Helper to invalidate all task-related queries
 */
const invalidateAllTaskQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  // Invalidate all queries that start with ['tasks']
  queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
};

/**
 * Create a new task
 */
export const useCreateTask = () => {
  const queryClient = useQueryClient();
  const repository = useTasksRepository();

  return useMutation({
    mutationFn: (input: CreateTaskInput) => repository.create(input),
    onSuccess: (newTask) => {
      // Injecte directement dans le cache sans refetch réseau
      queryClient.setQueryData<Task[]>(taskKeys.lists(), (old) => {
        if (!old) return [newTask];
        return [newTask, ...old]; // La nouvelle tâche en tête de liste
      });
      // Invalide en arrière-plan pour synchroniser les queries filtrées
      queryClient.invalidateQueries({
        queryKey: taskKeys.lists(),
        refetchType: 'none',
      });
    },
  });
};

/**
 * Update an existing task
 */
export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  const repository = useTasksRepository();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateTaskInput }) =>
      repository.update(id, updates),
    onSuccess: (updatedTask) => {
      // Update specific task in cache
      queryClient.setQueryData(taskKeys.detail(updatedTask.id), updatedTask);
      // Invalidate all list queries
      invalidateAllTaskQueries(queryClient);
    },
  });
};

/**
 * Delete a task
 */
export const useDeleteTask = () => {
  const queryClient = useQueryClient();
  const repository = useTasksRepository();

  return useMutation({
    mutationFn: (id: string) => repository.delete(id),
    onSuccess: (_result, deletedId) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: taskKeys.detail(deletedId) });
      // Invalidate all list queries
      invalidateAllTaskQueries(queryClient);
    },
  });
};

/**
 * Toggle task completion status with optimistic update
 */
export const useToggleTaskComplete = () => {
  const queryClient = useQueryClient();
  const repository = useTasksRepository();

  return useMutation({
    mutationFn: (id: string) => repository.toggleComplete(id),
    
    // Optimistic update
    onMutate: async (id: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskKeys.all });

      // Snapshot current state
      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.lists());

      // Optimistically update
      if (previousTasks) {
        queryClient.setQueryData<Task[]>(taskKeys.lists(), (old) =>
          old?.map((task) =>
            task.id === id
              ? {
                  ...task,
                  completed: !task.completed,
                  completedAt: !task.completed ? new Date().toISOString() : undefined,
                }
              : task
          )
        );
      }

      return { previousTasks };
    },

    // Rollback on error
    onError: (_error, _id, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.lists(), context.previousTasks);
      }
    },

    // Invalidation sélective post-toggle
    onSettled: (_data, _error, id) => {
      // Ne refetch pas immédiatement, attend le prochain focus
      queryClient.invalidateQueries({
        queryKey: taskKeys.lists(),
        refetchType: 'none',
      });
      // Invalide uniquement le détail de la tâche modifiée
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) });
    },
  });
};

/**
 * Toggle task bookmark status with optimistic update
 */
export const useToggleTaskBookmark = () => {
  const queryClient = useQueryClient();
  const repository = useTasksRepository();

  return useMutation({
    mutationFn: (id: string) => repository.toggleBookmark(id),

    // Optimistic update
    onMutate: async (id: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });

      // Snapshot current state
      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.lists());

      // Optimistically update
      if (previousTasks) {
        queryClient.setQueryData<Task[]>(taskKeys.lists(), (old) =>
          old?.map((task) =>
            task.id === id ? { ...task, bookmarked: !task.bookmarked } : task
          )
        );
      }

      return { previousTasks };
    },

    // Rollback on error
    onError: (_error, _id, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.lists(), context.previousTasks);
      }
    },

    // Invalidation sélective post-toggle
    onSettled: (_data, _error, id) => {
      // Ne refetch pas immédiatement, attend le prochain focus
      queryClient.invalidateQueries({
        queryKey: taskKeys.lists(),
        refetchType: 'none',
      });
      // Invalide uniquement le détail de la tâche modifiée
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) });
    },
  });
};

/**
 * Hook de pagination infinie pour les tâches
 * Utilise cursor-based pagination pour des performances optimales
 */
export const useTasksInfinite = (pageSize = 50) => {
  const repository = useTasksRepository();

  return useInfiniteQuery({
    queryKey: [...taskKeys.all, 'infinite', pageSize],
    queryFn: ({ pageParam }) => {
      const params: PaginationParams = { limit: pageSize };
      if (pageParam) {
        params.cursor = (pageParam as { cursor: string; cursorDate: string }).cursor;
        params.cursorDate = (pageParam as { cursor: string; cursorDate: string }).cursorDate;
      }
      return repository.getPage(params);
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || !lastPage.nextCursor) return undefined;
      return { cursor: lastPage.nextCursor, cursorDate: lastPage.nextCursorDate };
    },
  });
};
