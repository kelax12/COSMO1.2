import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getFriendsRepository, getListsRepository, getTasksRepository } from '@/lib/repository.factory';
import { listKeys } from '@/modules/lists';
import { taskKeys, type CreateTaskInput } from '@/modules/tasks';
import type {
  Friend,
  FriendRequestInput,
  ShareTaskInput,
  PendingFriendRequest,
  TaskShare,
  ShareListInput,
  SharedListGrant,
} from './types';
import { friendKeys } from './constants';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY HOOK
// ═══════════════════════════════════════════════════════════════════

const useFriendsRepository = () => getFriendsRepository();

const invalidateAllFriendQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: friendKeys.all, refetchType: 'none' });
};

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════

export const useFriends = () => {
  const repository = useFriendsRepository();
  return useQuery({
    queryKey: friendKeys.lists(),
    // Calls `getAll()` (was wrongly `getFriends()` which is private on the
    // local repo and absent on the Supabase repo → silent break in prod). B3.
    queryFn: () => repository.getAll(),
    staleTime: 1000 * 60 * 10, // 10 minutes — liste d'amis stable, mutations invalident le cache
  });
};

export const useFriendRequests = () => {
  const repository = useFriendsRepository();
  return useQuery({
    queryKey: friendKeys.requests(),
    queryFn: () => repository.getPendingRequests(),
    refetchInterval: 15000, // polling toutes les 15s pour recevoir les demandes en temps réel
    staleTime: 1000 * 60 * 2, // 2 minutes — doit rester réactif (notifications)
  });
};

export const useSentFriendRequests = () => {
  const repository = useFriendsRepository();
  return useQuery({
    queryKey: friendKeys.sentRequests(),
    queryFn: () => repository.getSentRequests(),
    refetchInterval: 15000,
    staleTime: 1000 * 60 * 2, // 2 minutes — doit rester réactif (notifications)
  });
};

// `useSharedTasks` removed — the underlying `getSharedTasks()` method does not
// exist on any repository implementation. The feature isn't built yet; the
// hook will be re-added when the backing implementation lands. Faille B4.

export const useTaskShares = (taskId: string | undefined) => {
  const repository = useFriendsRepository();
  return useQuery({
    queryKey: friendKeys.taskShares(taskId ?? ''),
    queryFn: () => repository.getTaskShares(taskId as string),
    enabled: !!taskId,
    staleTime: 1000 * 60 * 2, // 2 minutes — doit rester réactif (partages)
  });
};

export const useMyTaskShares = () => {
  const repository = useFriendsRepository();
  return useQuery({
    queryKey: friendKeys.myTaskShares(),
    queryFn: () => repository.getMyTaskShares(),
    staleTime: 1000 * 60 * 2, // 2 minutes — doit rester réactif (partages)
  });
};

// ═══════════════════════════════════════════════════════════════════
// MUTATION HOOKS
// ═══════════════════════════════════════════════════════════════════

export const useSendFriendRequest = () => {
  const queryClient = useQueryClient();
  const repository = useFriendsRepository();

  return useMutation({
    mutationFn: (input: FriendRequestInput) => repository.sendFriendRequest(input),
    onSuccess: (_data, variables) => {
      toast.success(`Demande d'ami envoyée à ${variables.email}`);
      queryClient.invalidateQueries({ queryKey: friendKeys.requests() });
      queryClient.invalidateQueries({ queryKey: friendKeys.sentRequests() });
    },
    onError: (error: Error) => {
      toast.error(`Impossible d'envoyer la demande d'ami : ${error.message}`);
    },
  });
};

export const useAcceptFriendRequest = () => {
  const queryClient = useQueryClient();
  const repository = useFriendsRepository();

  return useMutation({
    mutationFn: (requestId: string) => repository.acceptFriendRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.requests() });
      queryClient.invalidateQueries({ queryKey: friendKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(`Impossible d'accepter la demande d'ami : ${error.message}`);
    },
  });
};

export const useRejectFriendRequest = () => {
  const queryClient = useQueryClient();
  const repository = useFriendsRepository();

  return useMutation({
    mutationFn: (requestId: string) => repository.rejectFriendRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.requests() });
      queryClient.invalidateQueries({ queryKey: friendKeys.sentRequests() });
    },
    onError: (error: Error) => {
      toast.error(`Impossible de refuser la demande d'ami : ${error.message}`);
    },
  });
};

export const useRemoveFriend = () => {
  const queryClient = useQueryClient();
  const repository = useFriendsRepository();

  return useMutation({
    mutationFn: (id: string) => repository.removeFriend(id),

    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: friendKeys.all });
      const previousFriends = queryClient.getQueryData<Friend[]>(friendKeys.lists());
      if (previousFriends) {
        queryClient.setQueryData<Friend[]>(friendKeys.lists(), (old) =>
          old?.filter((friend) => friend.id !== id)
        );
      }
      return { previousFriends };
    },

    onError: (error: Error, _id, context) => {
      if (context?.previousFriends) {
        queryClient.setQueryData(friendKeys.lists(), context.previousFriends);
      }
      toast.error(`Impossible de supprimer l'ami : ${error.message}`);
    },

    onSettled: () => {
      invalidateAllFriendQueries(queryClient);
    },
  });
};

export const useShareTask = () => {
  const queryClient = useQueryClient();
  const repository = useFriendsRepository();

  return useMutation({
    mutationFn: (input: ShareTaskInput) => repository.shareTask(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.sharedTasks() });
    },
    onError: (error: Error) => {
      toast.error(`Impossible de partager la tâche : ${error.message}`);
    },
  });
};

export const useAcceptSharedTask = () => {
  const queryClient = useQueryClient();
  const repository = useFriendsRepository();

  return useMutation({
    mutationFn: (taskId: string) => repository.acceptSharedTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.sharedTasks() });
    },
    onError: (error: Error) => {
      toast.error(`Impossible d'accepter la tâche : ${error.message}`);
    },
  });
};

export const useUnshareTask = () => {
  const queryClient = useQueryClient();
  const repository = useFriendsRepository();

  return useMutation({
    mutationFn: ({ taskId, friendId }: { taskId: string; friendId: string }) =>
      repository.unshareTask(taskId, friendId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.sharedTasks() });
    },
    onError: (error: Error) => {
      toast.error(`Impossible d'annuler le partage de la tâche : ${error.message}`);
    },
  });
};

// ═══════════════════════════════════════════════════════════════════
// LIST SHARING HOOKS (copy-on-accept)
// ═══════════════════════════════════════════════════════════════════

export const useShareList = () => {
  const queryClient = useQueryClient();
  const repository = useFriendsRepository();

  return useMutation({
    mutationFn: (input: ShareListInput) => repository.shareList(input),
    onSuccess: () => {
      toast.success('Liste partagée');
      queryClient.invalidateQueries({ queryKey: friendKeys.incomingSharedLists() });
    },
    onError: (error: Error) => {
      toast.error(`Impossible de partager la liste : ${error.message}`);
    },
  });
};

export const useIncomingSharedLists = () => {
  const repository = useFriendsRepository();
  return useQuery({
    queryKey: friendKeys.incomingSharedLists(),
    queryFn: () => repository.getIncomingSharedLists(),
    // Même cadence que useRelatedTaskShares : collaboration sans realtime.
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
};

export const useAcceptSharedList = () => {
  const queryClient = useQueryClient();
  const repository = useFriendsRepository();

  return useMutation({
    // Matérialisation : on recrée la liste + ses tâches dans les données du
    // destinataire (via les repos lists/tasks), puis on marque la grant acceptée.
    mutationFn: async (grant: SharedListGrant) => {
      const listsRepo = getListsRepository();
      const tasksRepo = getTasksRepository();

      const newList = await listsRepo.create({
        name: grant.name,
        color: grant.color,
        type: 'manual',
      });

      for (const snap of grant.tasks) {
        const input: CreateTaskInput = {
          name: snap.name,
          description: snap.description,
          priority: snap.priority,
          category: snap.category,
          deadline: snap.deadline,
          estimatedTime: snap.estimatedTime,
          bookmarked: snap.bookmarked,
          completed: snap.completed,
          subtasks: snap.subtasks,
          recurrence: snap.recurrence,
        };
        const created = await tasksRepo.create(input);
        await listsRepo.addTaskToList(created.id, newList.id);
      }

      await repository.acceptSharedList(grant.id);
    },
    onSuccess: () => {
      toast.success('Liste acceptée');
      queryClient.invalidateQueries({ queryKey: friendKeys.incomingSharedLists() });
      queryClient.invalidateQueries({ queryKey: listKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(`Impossible d'accepter la liste : ${error.message}`);
    },
  });
};

export const useRefuseSharedList = () => {
  const queryClient = useQueryClient();
  const repository = useFriendsRepository();

  return useMutation({
    mutationFn: (grantId: string) => repository.refuseSharedList(grantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.incomingSharedLists() });
    },
    onError: (error: Error) => {
      toast.error(`Impossible de refuser la liste : ${error.message}`);
    },
  });
};

// ═══════════════════════════════════════════════════════════════════
// DERIVED HOOKS
// ═══════════════════════════════════════════════════════════════════

export const useFriendCount = () => {
  const { data: friends = [] } = useFriends();
  return useMemo(() => friends.length, [friends]);
};

export const usePendingRequestCount = () => {
  const { data: requests = [] } = useFriendRequests();
  return useMemo(
    () => requests.filter((r: PendingFriendRequest) => r.status === 'pending').length,
    [requests]
  );
};

/** Map of taskId -> friendIds shared with, for list-view avatar badges. */
export const useSharesByTask = (): Map<string, string[]> => {
  const { data: shares = [] } = useMyTaskShares();
  return useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of shares as TaskShare[]) {
      const arr = m.get(s.taskId) ?? [];
      arr.push(s.friendId);
      m.set(s.taskId, arr);
    }
    return m;
  }, [shares]);
};

/**
 * Map taskId -> auth.uids des AUTRES participants (collaborateurs), vue des
 * deux côtés : si je suis propriétaire → les destinataires ; si je suis
 * destinataire → le propriétaire (et co-destinataires lisibles). Utilisé pour
 * afficher les avatars de collaborateurs sur n'importe quelle tâche partagée,
 * que je l'aie partagée ou reçue. `currentUserId` exclut ma propre vignette.
 */
export const useRelatedTaskShares = () => {
  const repository = useFriendsRepository();
  return useQuery({
    queryKey: friendKeys.relatedTaskShares(),
    queryFn: () => repository.getRelatedTaskShares(),
    // Collaboration sans realtime : poll régulier pour que la boîte de réception
    // (tâches reçues en attente) et les avatars de collaborateurs reflètent un
    // partage / une acceptation récents. getRelatedTaskShares retourne [] sans
    // amis ni partages, donc coût négligeable.
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
};

export const useCollaboratorsByTask = (currentUserId?: string): Map<string, string[]> => {
  const { data: shares = [] } = useRelatedTaskShares();
  return useMemo(() => {
    const sets = new Map<string, Set<string>>();
    for (const s of shares) {
      const others = [s.sharedBy, s.friendId].filter((id) => id && id !== currentUserId);
      const set = sets.get(s.taskId) ?? new Set<string>();
      others.forEach((o) => set.add(o));
      sets.set(s.taskId, set);
    }
    const out = new Map<string, string[]>();
    sets.forEach((v, k) => out.set(k, [...v]));
    return out;
  }, [shares, currentUserId]);
};

/**
 * Set des taskIds dont AU MOINS un collaborateur n'a pas encore accepté
 * (partage émis par le propriétaire courant, `accepted !== true`). Alimente le
 * badge « sablier » des vues liste (TaskTable). Vue propriétaire uniquement :
 * on ne signale que les partages que J'AI émis et qui sont en attente.
 */
export const usePendingCollaboratorTaskIds = (currentUserId?: string): Set<string> => {
  const { data: shares = [] } = useRelatedTaskShares();
  return useMemo(() => {
    const out = new Set<string>();
    for (const s of shares) {
      if (s.sharedBy === currentUserId && s.accepted !== true) {
        out.add(s.taskId);
      }
    }
    return out;
  }, [shares, currentUserId]);
};

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════

export type { Friend, FriendRequestInput, ShareTaskInput, PendingFriendRequest } from './types';
export { friendKeys } from './constants';
