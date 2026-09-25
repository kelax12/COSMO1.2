// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — hooks « Suivre » (mig. 162, M14). Données : `follows.repository.ts`.
// ═══════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { translator } from '@/i18n/useT';
import { teamProjectKeys } from './constants';
import { getMyFollows, setFollow, type FollowTarget, type MyFollows } from './follows.repository';

export type { FollowTarget, MyFollows };

const followsKey = (orgId: string) => [...teamProjectKeys.all, 'follows', orgId] as const;

export const useMyFollows = (orgId: string | undefined) =>
  useQuery({
    queryKey: followsKey(orgId ?? ''),
    queryFn: () => getMyFollows(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

/** Suivre / ne plus suivre, avec mise à jour optimiste : le bouton répond tout de suite. */
export const useToggleFollow = (orgId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ target, id, follow }: { target: FollowTarget; id: string; follow: boolean }) =>
      setFollow(orgId, target, id, follow),
    onMutate: async ({ target, id, follow }) => {
      await queryClient.cancelQueries({ queryKey: followsKey(orgId) });
      const previous = queryClient.getQueryData<MyFollows>(followsKey(orgId));
      if (previous) {
        const key = target === 'task' ? 'taskIds' : 'projectIds';
        const without = previous[key].filter((x) => x !== id);
        queryClient.setQueryData<MyFollows>(followsKey(orgId), {
          ...previous,
          [key]: follow ? [...without, id] : without,
        });
      }
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(followsKey(orgId), context.previous);
      toast.error(translator('org').t('follow.failed', { message: error.message }));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: followsKey(orgId) }),
  });
};
