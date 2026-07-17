// ═══════════════════════════════════════════════════════════════════
// ORG-OKR-CATEGORIES MODULE - React Query hooks
// ═══════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getOrgOKRCategoriesRepository } from '@/lib/repository.factory';
import { orgOKRCategoryKeys } from './constants';
import type { CreateOrgOKRCategoryInput, UpdateOrgOKRCategoryInput } from './types';

const useRepo = () => getOrgOKRCategoriesRepository();

export const useOrgOKRCategories = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: orgOKRCategoryKeys.list(orgId ?? ''),
    queryFn: () => repository.getCategories(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useCreateOrgOKRCategory = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (input: CreateOrgOKRCategoryInput) => repository.createCategory(orgId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgOKRCategoryKeys.list(orgId) });
    },
    onError: (error: Error) => toast.error(`Impossible de créer la catégorie : ${error.message}`),
  });
};

export const useUpdateOrgOKRCategory = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ categoryId, input }: { categoryId: string; input: UpdateOrgOKRCategoryInput }) =>
      repository.updateCategory(categoryId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgOKRCategoryKeys.list(orgId) });
    },
    onError: (error: Error) => toast.error(`Impossible de modifier la catégorie : ${error.message}`),
  });
};

export const useDeleteOrgOKRCategory = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (categoryId: string) => repository.deleteCategory(categoryId),
    onSuccess: () => {
      toast.success('Catégorie supprimée');
      queryClient.invalidateQueries({ queryKey: orgOKRCategoryKeys.list(orgId) });
    },
    onError: (error: Error) => toast.error(`Impossible de supprimer la catégorie : ${error.message}`),
  });
};
