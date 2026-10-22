// ═══════════════════════════════════════════════════════════════════
// TEAM-LISTS MODULE - React Query hooks
//
// Même contrat que `@/modules/lists` (mêmes gestes, mêmes messages) : la
// barre de listes de l'onglet Tâches est LA barre personnelle. Écritures
// optimistes sur la liste de l'organisation, retour arrière sur erreur.
// ═══════════════════════════════════════════════════════════════════

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { showUndoToast } from '@/lib/undo-toast';
import { getTeamListsRepository } from '@/lib/repository.factory';
import { translator } from '@/i18n/useT';
import { teamListKeys } from './constants';
import type { TeamList, CreateTeamListInput, UpdateTeamListInput } from './types';

const useRepo = () => getTeamListsRepository();

/** Patch optimiste de la liste d'une organisation ; rend l'état d'avant. */
async function patchLists(
  queryClient: QueryClient,
  orgId: string,
  patch: (old: TeamList[]) => TeamList[],
): Promise<TeamList[] | undefined> {
  const key = teamListKeys.list(orgId);
  await queryClient.cancelQueries({ queryKey: key });
  const previous = queryClient.getQueryData<TeamList[]>(key);
  if (previous) queryClient.setQueryData<TeamList[]>(key, patch(previous));
  return previous;
}

export { useTeamLists, useSetTaskTeamLists } from './task-lists.hooks';

export const useCreateTeamList = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (input: CreateTeamListInput) => repository.createList(orgId, input),
    onSuccess: (created) => {
      queryClient.setQueryData<TeamList[]>(teamListKeys.list(orgId), (old = []) => [...old, created]);
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.createList', { message: error.message })),
  });
};

export const useUpdateTeamList = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateTeamListInput }) => repository.updateList(id, updates),
    onMutate: ({ id, updates }) =>
      patchLists(queryClient, orgId, (old) => old.map((l) => (l.id === id ? { ...l, ...updates } : l))),
    onError: (error: Error, _v, previous) => {
      if (previous) queryClient.setQueryData(teamListKeys.list(orgId), previous);
      toast.error(translator('errors').t('mutation.updateList', { message: error.message }));
    },
  });
};

export const useAddTaskToTeamList = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ listId, taskId }: { listId: string; taskId: string }) => repository.addTask(listId, taskId),
    onMutate: ({ listId, taskId }) =>
      patchLists(queryClient, orgId, (old) =>
        old.map((l) => (l.id === listId && !l.taskIds.includes(taskId) ? { ...l, taskIds: [...l.taskIds, taskId] } : l))),
    onError: (error: Error, _v, previous) => {
      if (previous) queryClient.setQueryData(teamListKeys.list(orgId), previous);
      toast.error(translator('errors').t('mutation.addTaskToList', { message: error.message }));
    },
  });
};

export const useRemoveTaskFromTeamList = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ listId, taskId }: { listId: string; taskId: string }) => repository.removeTask(listId, taskId),
    onMutate: ({ listId, taskId }) =>
      patchLists(queryClient, orgId, (old) =>
        old.map((l) => (l.id === listId ? { ...l, taskIds: l.taskIds.filter((id) => id !== taskId) } : l))),
    onError: (error: Error, _v, previous) => {
      if (previous) queryClient.setQueryData(teamListKeys.list(orgId), previous);
      toast.error(translator('errors').t('mutation.removeTaskFromList', { message: error.message }));
    },
  });
};

/**
 * Suppression directe + toast « Annuler », même geste que les listes
 * personnelles (`useDeleteListWithUndo`). Annuler recrée la liste et y
 * reverse ses tâches : la jonction est partie avec la cascade.
 */
export const useDeleteTeamListWithUndo = (orgId: string, onDeleted?: (listId: string) => void) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  const mutation = useMutation({
    mutationFn: (listId: string) => repository.deleteList(listId),
    onMutate: (listId) => patchLists(queryClient, orgId, (old) => old.filter((l) => l.id !== listId)),
    onError: (error: Error, _v, previous) => {
      if (previous) queryClient.setQueryData(teamListKeys.list(orgId), previous);
      toast.error(translator('errors').t('mutation.deleteList', { message: error.message }));
    },
  });

  const deleteList = (snapshot: TeamList) => {
    mutation.mutate(snapshot.id, {
      onSuccess: () => {
        onDeleted?.(snapshot.id);
        showUndoToast(translator('org').t('teamLists.deleted'), () => {
          void (async () => {
            const restored = await repository.createList(orgId, {
              name: snapshot.name,
              color: snapshot.color,
              type: snapshot.type,
              smartRule: snapshot.smartRule,
            });
            await Promise.allSettled(snapshot.taskIds.map((taskId) => repository.addTask(restored.id, taskId)));
            if (snapshot.position !== undefined) await repository.updateList(restored.id, { position: snapshot.position });
            await queryClient.invalidateQueries({ queryKey: teamListKeys.list(orgId) });
          })();
        });
      },
    });
  };

  return { deleteList, isPending: mutation.isPending };
};
