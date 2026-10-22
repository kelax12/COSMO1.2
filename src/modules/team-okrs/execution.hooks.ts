// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS · Exécution — hooks React Query
// ═══════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { getOkrExecutionRepository } from '@/lib/repository.factory';
import { translator } from '@/i18n/useT';
import { teamOkrKeys } from './constants';
import type { PostKRCheckinInput } from './execution.types';

const useRepo = () => getOkrExecutionRepository();

const keys = {
  krProjects: (orgId: string) => [...teamOkrKeys.all, 'kr-projects', orgId] as const,
  checkins: (krId: string) => [...teamOkrKeys.all, 'checkins', krId] as const,
};

export const useKRProjects = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: keys.krProjects(orgId ?? ''),
    queryFn: () => repository.getKRProjects(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useSetKRProjects = (orgId: string) => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ krId, projectIds }: { krId: string; projectIds: string[] }) =>
      repository.setKRProjects(orgId, krId, projectIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.krProjects(orgId) }),
    onError: (error: Error) => toast.error(translator('errors').t('mutation.krProjects', { message: error.message })),
  });
};

export const useKRCheckins = (krId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: keys.checkins(krId ?? ''),
    queryFn: () => repository.getCheckins(krId as string),
    enabled: !!krId,
    staleTime: 1000 * 60,
  });
};

export const usePostKRCheckin = (orgId: string) => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PostKRCheckinInput) => repository.postCheckin(input),
    onSuccess: (_d, input) => {
      toast.success(translator('errors').t('success.checkinPosted'));
      queryClient.invalidateQueries({ queryKey: keys.checkins(input.krId) });
      queryClient.invalidateQueries({ queryKey: teamOkrKeys.list(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.krCheckin', { message: error.message })),
  });
};
