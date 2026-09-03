import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getListsRepository } from '@/lib/repository.factory';
import type { TaskList, CreateListInput, UpdateListInput } from './types';
import { listKeys } from './constants';
import { translator } from '@/i18n/useT';
import { reportRestoreFailure, splitRestore } from '@/lib/restore-id';

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
    staleTime: 1000 * 60 * 30, // 30 minutes — changent rarement, mutations invalident le cache
  });
};

export const useList = (id: string) => {
  const repository = useListsRepository();
  return useQuery({
    queryKey: listKeys.detail(id),
    queryFn: () => repository.getById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 30, // 30 minutes — changent rarement, mutations invalident le cache
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
      toast.error(translator('errors').t('mutation.createList', { message: error.message }));
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
      toast.error(translator('errors').t('mutation.updateList', { message: error.message }));
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
      toast.error(translator('errors').t('mutation.deleteList', { message: error.message }));
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
      toast.error(translator('errors').t('mutation.addTaskToList', { message: error.message }));
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
      toast.error(translator('errors').t('mutation.removeTaskFromList', { message: error.message }));
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

// ═══════════════════════════════════════════════════════════════════
// RESTAURATION (« Annuler ») — recree l'objet sous SON identifiant
// ═══════════════════════════════════════════════════════════════════
//
// Separe de `useCreateList` a dessein : l'identifiant passe par le second
// argument de `create()`, hors du payload, donc hors de portee d'un objet de
// formulaire enrichi depuis les devtools. Contrat complet et raison de ce
// decoupage : `src/lib/restore-id.ts` (R-08).
//
// ⚠️ N'appeler QUE depuis un toast d'annulation.
export const useRestoreList = () => {
  const queryClient = useQueryClient();
  const repository = useListsRepository();

  return useMutation({
    mutationFn: (snapshot: TaskList) => {
      const { payload, options } = splitRestore(snapshot);
      return repository.create(payload as CreateListInput, options);
    },
    onSuccess: () => {
      invalidateAllListQueries(queryClient);
    },
    // Un « Annuler » rate doit se VOIR : `console.error` est supprime du
    // bundle de production (vite.config.ts), l'echec etait donc muet.
    onError: (error: Error) => reportRestoreFailure('list', error),
  });
};
