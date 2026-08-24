// ═══════════════════════════════════════════════════════════════════
// TEAM-CATEGORIES MODULE - React Query hooks
// ═══════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getTeamCategoriesRepository } from '@/lib/repository.factory';
import { teamCategoryKeys } from './constants';
import type { CreateTeamCategoryInput, UpdateTeamCategoryInput } from './types';
import { translator } from '@/i18n/useT';

const useRepo = () => getTeamCategoriesRepository();

export const useTeamCategories = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamCategoryKeys.list(orgId ?? ''),
    queryFn: () => repository.getCategories(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useCreateTeamCategory = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (input: CreateTeamCategoryInput) => repository.createCategory(orgId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamCategoryKeys.list(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.createCategory', { message: error.message })),
  });
};

export const useUpdateTeamCategory = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ categoryId, input }: { categoryId: string; input: UpdateTeamCategoryInput }) =>
      repository.updateCategory(categoryId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamCategoryKeys.list(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.updateCategory', { message: error.message })),
  });
};

export const useDeleteTeamCategory = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (categoryId: string) => repository.deleteCategory(categoryId),
    onSuccess: () => {
      toast.success(translator('errors').t('success.categoryDeleted'));
      queryClient.invalidateQueries({ queryKey: teamCategoryKeys.list(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.deleteCategory', { message: error.message })),
  });
};
