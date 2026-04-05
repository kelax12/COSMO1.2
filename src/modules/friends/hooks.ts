// ═══════════════════════════════════════════════════════════════════
// FRIENDS MODULE - React Query Hooks
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFriendsRepository } from '@/lib/repository.factory';
import { IFriendsRepository } from './repository';
import { Friend, FriendRequestInput, ShareTaskInput } from './types';
import { friendKeys } from './constants';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY FACTORY
// ═══════════════════════════════════════════════════════════════════

/**
 * Factory hook to get the friends repository
 * Selects Supabase or LocalStorage based on environment config
 */
const useFriendsRepository = (): IFriendsRepository => {
  return useMemo(() => getFriendsRepository(), []);
};

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

const invalidateAllFriendQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: friendKeys.all });
};

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch all friends
 */
export const useFriends = (options?: { enabled?: boolean }) => {
  const repository = useFriendsRepository();
  return useQuery({
    queryKey: friendKeys.lists(),
    queryFn: () => repository.getAll(),
    enabled: options?.enabled ?? true,
  });
};

/**
 * Fetch a single friend by ID
 */
export const useFriend = (id: string, options?: { enabled?: boolean }) => {
  const repository = useFriendsRepository();
  return useQuery({
    queryKey: friendKeys.detail(id),
    queryFn: () => repository.getById(id),
    enabled: (options?.enabled ?? true) && !!id,
  });
};

/**
 * Fetch pending friend requests
 */
export const usePendingFriendRequests = (options?: { enabled?: boolean }) => {
  const repository = useFriendsRepository();
  return useQuery({
    queryKey: friendKeys.requests(),
    queryFn: () => repository.getPendingRequests(),
    enabled: options?.enabled ?? true,
  });
};

// ═══════════════════════════════════════════════════════════════════
// UTILITY HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get friend by ID lookup function
 */
export const useFriendLookup = () => {
  const { data: friends = [] } = useFriends();
  
  return useMemo(() => {
    return (friendId: string): Friend | undefined => {
      return friends.find(f => f.id === friendId || f.name === friendId);
    };
  }, [friends]);
};

/**
 * Get friend by email
 */
export const useFriendByEmail = () => {
  const { data: friends = [] } = useFriends();
  
  return useMemo(() => {
    return (email: string): Friend | undefined => {
      return friends.find(f => f.email.toLowerCase() === email.toLowerCase());
    };
  }, [friends]);
};

// ═══════════════════════════════════════════════════════════════════
// WRITE HOOKS (Mutations)
// ═══════════════════════════════════════════════════════════════════

/**
 * Send a friend request
 */
export const useSendFriendRequest = () => {
  const queryClient = useQueryClient();
  const repository = useFriendsRepository();

  return useMutation({
    mutationFn: (input: FriendRequestInput) => repository.sendFriendRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.requests() });
    },
  });
};

/**
 * Accept a friend request
 */
export const useAcceptFriendRequest = () => {
  const queryClient = useQueryClient();
  const repository = useFriendsRepository();

  return useMutation({
    mutationFn: (requestId: string) => repository.acceptFriendRequest(requestId),
    onSuccess: () => {
      invalidateAllFriendQueries(queryClient);
    },
  });
};

/**
 * Reject a friend request
 */
export const useRejectFriendRequest = () => {
  const queryClient = useQueryClient();
  const repository = useFriendsRepository();

  return useMutation({
    mutationFn: (requestId: string) => repository.rejectFriendRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.requests() });
    },
  });
};

/**
 * Remove a friend
 */
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
    onError: (_error, _id, context) => {
      if (context?.previousFriends) {
        queryClient.setQueryData(friendKeys.lists(), context.previousFriends);
      }
    },
    onSettled: () => {
      invalidateAllFriendQueries(queryClient);
    },
  });
};

/**
 * Share a task with a friend
 */
export const useShareTask = () => {
  const queryClient = useQueryClient();
  const repository = useFriendsRepository();

  return useMutation({
    mutationFn: (input: ShareTaskInput) => repository.shareTask(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.sharedTasks() });
    },
  });
};

/**
 * Unshare a task
 */
export const useUnshareTask = () => {
  const queryClient = useQueryClient();
  const repository = useFriendsRepository();

  return useMutation({
    mutationFn: ({ taskId, friendId }: { taskId: string; friendId: string }) => 
      repository.unshareTask(taskId, friendId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.sharedTasks() });
    },
  });
};

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORTS for convenience
// ═══════════════════════════════════════════════════════════════════

export type { Friend, FriendRequestInput, ShareTaskInput, PendingFriendRequest } from './types';
export { friendKeys } from './constants';
