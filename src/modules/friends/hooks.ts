import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getFriendsRepository } from '@/lib/repository.factory';
import type {
  Friend,
  FriendRequestInput,
  ShareTaskInput,
  PendingFriendRequest,
  TaskShare,
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
  });
};

export const useFriendRequests = () => {
  const repository = useFriendsRepository();
  return useQuery({
    queryKey: friendKeys.requests(),
    queryFn: () => repository.getPendingRequests(),
    refetchInterval: 15000, // polling toutes les 15s pour recevoir les demandes en temps réel
  });
};

export const useSentFriendRequests = () => {
  const repository = useFriendsRepository();
  return useQuery({
    queryKey: friendKeys.sentRequests(),
    queryFn: () => repository.getSentRequests(),
    refetchInterval: 15000,
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
  });
};

export const useMyTaskShares = () => {
  const repository = useFriendsRepository();
  return useQuery({
    queryKey: friendKeys.myTaskShares(),
    queryFn: () => repository.getMyTaskShares(),
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
export const useCollaboratorsByTask = (currentUserId?: string): Map<string, string[]> => {
  const repository = useFriendsRepository();
  const { data: shares = [] } = useQuery({
    queryKey: friendKeys.relatedTaskShares(),
    queryFn: () => repository.getRelatedTaskShares(),
  });
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

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════

export type { Friend, FriendRequestInput, ShareTaskInput, PendingFriendRequest } from './types';
export { friendKeys } from './constants';
