import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getFriendsRepository } from '@/lib/repository.factory';
import type {
  Friend,
  FriendRequestInput,
  ShareTaskInput,
  PendingFriendRequest,
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
    queryFn: () => repository.getFriends(),
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

export const useSharedTasks = () => {
  const repository = useFriendsRepository();
  return useQuery({
    queryKey: friendKeys.sharedTasks(),
    queryFn: () => repository.getSharedTasks(),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.requests() });
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

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════

export type { Friend, FriendRequestInput, ShareTaskInput, PendingFriendRequest } from './types';
export { friendKeys } from './constants';
