// ═══════════════════════════════════════════════════════════════════
// LISTS MODULE - React Query Hooks
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getListsRepository } from '@/lib/repository.factory';
import { IListsRepository } from './repository';
import { TaskList, CreateListInput, UpdateListInput } from './types';
import { listKeys } from './constants';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY FACTORY
// ═══════════════════════════════════════════════════════════════════

/**
 * Factory hook to get the lists repository
 * Selects Supabase or LocalStorage based on environment config
 */
const useListsRepository = (): IListsRepository => {
  return useMemo(() => getListsRepository(), []);
};

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Invalidate all list-related queries
 */
const invalidateAllListQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: listKeys.lists() });
};

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch all lists
 */
export const useLists = (options?: { enabled?: boolean }) => {
  const repository = useListsRepository();
  return useQuery({
    queryKey: listKeys.lists(),
    queryFn: () => repository.getAll(),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 15, // 15 minutes
    gcTime: 1000 * 60 * 30,    // 30 minutes en cache
  });
};

/**
 * Fetch a single list by ID
 */
export const useList = (id: string, options?: { enabled?: boolean }) => {
  const repository = useListsRepository();
  return useQuery({
    queryKey: listKeys.detail(id),
    queryFn: () => repository.getById(id),
    enabled: (options?.enabled ?? true) && !!id,
  });
};

/**
 * Get lists containing a specific task
 */
export const useListsByTask = (taskId: string, options?: { enabled?: boolean }) => {
  const repository = useListsRepository();
  return useQuery({
    queryKey: listKeys.byTask(taskId),
    queryFn: () => repository.getByTaskId(taskId),
    enabled: (options?.enabled ?? true) && !!taskId,
  });
};

// ═══════════════════════════════════════════════════════════════════
// UTILITY HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get list IDs for a specific task
 * Returns a memoized function to look up list IDs
 */
export const useTaskListIds = (taskId: string) => {
  const { data: lists = [] } = useLists();
  
  return useMemo(() => {
    return lists.filter(l => l.taskIds.includes(taskId)).map(l => l.id);
  }, [lists, taskId]);
};

/**
 * Get list by ID lookup function
 */
export const useListLookup = () => {
  const { data: lists = [] } = useLists();
  
  return useMemo(() => {
    return (listId: string): TaskList | undefined => {
      return lists.find(l => l.id === listId);
    };
  }, [lists]);
};

// ═══════════════════════════════════════════════════════════════════
// WRITE HOOKS (Mutations)
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a new list
 */
export const useCreateList = () => {
  const queryClient = useQueryClient();
  const repository = useListsRepository();

  return useMutation({
    mutationFn: (input: CreateListInput) => repository.create(input),
    onSuccess: () => {
      invalidateAllListQueries(queryClient);
    },
  });
};

/**
 * Update an existing list with optimistic update
 */
export const useUpdateList = () => {
  const queryClient = useQueryClient();
  const repository = useListsRepository();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateListInput }) =>
      repository.update(id, updates),

    // Optimistic update
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: listKeys.lists() });

      const previousLists = queryClient.getQueryData<TaskList[]>(listKeys.lists());

      if (previousLists) {
        queryClient.setQueryData<TaskList[]>(listKeys.lists(), (old) =>
          old?.map((list) =>
            list.id === id ? { ...list, ...updates } : list
          )
        );
      }

      return { previousLists };
    },

    onError: (_error, _variables, context) => {
      if (context?.previousLists) {
        queryClient.setQueryData(listKeys.lists(), context.previousLists);
      }
    },

    onSettled: (updatedList) => {
      if (updatedList) {
        queryClient.setQueryData(listKeys.detail(updatedList.id), updatedList);
      }
      invalidateAllListQueries(queryClient);
    },
  });
};

/**
 * Delete a list with optimistic update
 */
export const useDeleteList = () => {
  const queryClient = useQueryClient();
  const repository = useListsRepository();

  return useMutation({
    mutationFn: (id: string) => repository.delete(id),

    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: listKeys.all });

      const previousLists = queryClient.getQueryData<TaskList[]>(listKeys.lists());

      if (previousLists) {
        queryClient.setQueryData<TaskList[]>(listKeys.lists(), (old) =>
          old?.filter((list) => list.id !== id)
        );
      }

      return { previousLists };
    },

    onError: (_error, _id, context) => {
      if (context?.previousLists) {
        queryClient.setQueryData(listKeys.lists(), context.previousLists);
      }
    },

    onSettled: (_result, _error, deletedId) => {
      queryClient.removeQueries({ queryKey: listKeys.detail(deletedId) });
      invalidateAllListQueries(queryClient);
    },
  });
};

/**
 * Add a task to a list with optimistic update
 */
export const useAddTaskToList = () => {
  const queryClient = useQueryClient();
  const repository = useListsRepository();

  return useMutation({
    mutationFn: ({ taskId, listId }: { taskId: string; listId: string }) =>
      repository.addTaskToList(taskId, listId),

    onMutate: async ({ taskId, listId }) => {
      await queryClient.cancelQueries({ queryKey: listKeys.all });

      const previousLists = queryClient.getQueryData<TaskList[]>(listKeys.lists());

      if (previousLists) {
        queryClient.setQueryData<TaskList[]>(listKeys.lists(), (old) =>
          old?.map((list) =>
            list.id === listId && !list.taskIds.includes(taskId)
              ? { ...list, taskIds: [...list.taskIds, taskId] }
              : list
          )
        );
      }

      return { previousLists };
    },

    onError: (_error, _variables, context) => {
      if (context?.previousLists) {
        queryClient.setQueryData(listKeys.lists(), context.previousLists);
      }
    },

    onSettled: () => {
      invalidateAllListQueries(queryClient);
    },
  });
};

/**
 * Remove a task from a list with optimistic update
 */
export const useRemoveTaskFromList = () => {
  const queryClient = useQueryClient();
  const repository = useListsRepository();

  return useMutation({
    mutationFn: ({ taskId, listId }: { taskId: string; listId: string }) =>
      repository.removeTaskFromList(taskId, listId),

    onMutate: async ({ taskId, listId }) => {
      await queryClient.cancelQueries({ queryKey: listKeys.all });

      const previousLists = queryClient.getQueryData<TaskList[]>(listKeys.lists());

      if (previousLists) {
        queryClient.setQueryData<TaskList[]>(listKeys.lists(), (old) =>
          old?.map((list) =>
            list.id === listId
              ? { ...list, taskIds: list.taskIds.filter(id => id !== taskId) }
              : list
          )
        );
      }

      return { previousLists };
    },

    onError: (_error, _variables, context) => {
      if (context?.previousLists) {
        queryClient.setQueryData(listKeys.lists(), context.previousLists);
      }
    },

    onSettled: () => {
      invalidateAllListQueries(queryClient);
    },
  });
};

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORTS for convenience
// ═══════════════════════════════════════════════════════════════════

export type { TaskList, CreateListInput, UpdateListInput } from './types';
export { listKeys } from './constants';
