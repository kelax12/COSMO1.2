import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getListsRepository } from '@/lib/repository.factory';
import type { TaskList, CreateListInput, UpdateListInput } from './types';
import { listKeys } from './constants';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY HOOK
// ═══════════════════════════════════════════════════════════════════

const useListsRepository = () => getListsRepository();

const invalidateAllListQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: listKeys.all, refetchType: 'none' });
};

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════

export const useLists = () => {
  const repository = useListsRepository();
  return useQuery({
    queryKey: listKeys.lists(),
    queryFn: () => repository.getAll(),
  });
};

export const useList = (id: string) => {
  const repository = useListsRepository();
  return useQuery({
    queryKey: listKeys.detail(id),
    queryFn: () => repository.getById(id),
    enabled: !!id,
  });
};

// ═══════════════════════════════════════════════════════════════════
// MUTATION HOOKS
// ═══════════════════════════════════════════════════════════════════

export const useCreateList = () => {
  const queryClient = useQueryClient();
  const repository = useListsRepository();

  return useMutation({
    mutationFn: (input: CreateListInput) => repository.create(input),
    onSuccess: (newList) => {
      queryClient.setQueryData<TaskList[]>(listKeys.lists(), (old = []) => [...old, newList]);
      invalidateAllListQueries(queryClient);
    },
    onError: (error: Error) => {
      toast.error(`Impossible de créer la liste : ${error.message}`);
    },
  });
};

export const useUpdateList = () => {
  const queryClient = useQueryClient();
  const repository = useListsRepository();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateListInput }) =>
      repository.update(id, updates),

    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: listKeys.lists() });
      const previousLists = queryClient.getQueryData<TaskList[]>(listKeys.lists());
      if (previousLists) {
        queryClient.setQueryData<TaskList[]>(listKeys.lists(), (old) =>
          old?.map((list) => list.id === id ? { ...list, ...updates } : list)
        );
      }
      return { previousLists };
    },

    onError: (error: Error, _variables, context) => {
      if (context?.previousLists) {
        queryClient.setQueryData(listKeys.lists(), context.previousLists);
      }
      toast.error(`Impossible de modifier la liste : ${error.message}`);
    },

    onSettled: (updatedList) => {
      if (updatedList) {
        queryClient.setQueryData(listKeys.detail(updatedList.id), updatedList);
      }
      invalidateAllListQueries(queryClient);
    },
  });
};

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

    onError: (error: Error, _id, context) => {
      if (context?.previousLists) {
        queryClient.setQueryData(listKeys.lists(), context.previousLists);
      }
      toast.error(`Impossible de supprimer la liste : ${error.message}`);
    },

    onSettled: (_result, _error, deletedId) => {
      queryClient.removeQueries({ queryKey: listKeys.detail(deletedId) });
      invalidateAllListQueries(queryClient);
    },
  });
};

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

    onError: (error: Error, _variables, context) => {
      if (context?.previousLists) {
        queryClient.setQueryData(listKeys.lists(), context.previousLists);
      }
      toast.error(`Impossible d'ajouter la tâche à la liste : ${error.message}`);
    },

    onSettled: () => {
      invalidateAllListQueries(queryClient);
    },
  });
};

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
              ? { ...list, taskIds: list.taskIds.filter((id) => id !== taskId) }
              : list
          )
        );
      }
      return { previousLists };
    },

    onError: (error: Error, _variables, context) => {
      if (context?.previousLists) {
        queryClient.setQueryData(listKeys.lists(), context.previousLists);
      }
      toast.error(`Impossible de retirer la tâche de la liste : ${error.message}`);
    },

    onSettled: () => {
      invalidateAllListQueries(queryClient);
    },
  });
};

// ═══════════════════════════════════════════════════════════════════
// DERIVED HOOKS
// ═══════════════════════════════════════════════════════════════════

export const useListsForTask = (taskId: string) => {
  const { data: lists = [] } = useLists();
  return useMemo(
    () => lists.filter((list) => list.taskIds.includes(taskId)),
    [lists, taskId]
  );
};

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════

export type { TaskList, CreateListInput, UpdateListInput } from './types';
export { listKeys } from './constants';
