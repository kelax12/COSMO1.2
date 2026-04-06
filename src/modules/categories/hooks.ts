import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getCategoriesRepository } from '@/lib/repository.factory';
import type { Category, CreateCategoryInput, UpdateCategoryInput } from './types';
import { categoryKeys } from './constants';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY HOOK
// ═══════════════════════════════════════════════════════════════════

const useCategoriesRepository = () => getCategoriesRepository();

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════

export const useCategories = () => {
  const repository = useCategoriesRepository();
  return useQuery({
    queryKey: categoryKeys.lists(),
    queryFn: () => repository.getAll(),
  });
};

export const useCategory = (id: string) => {
  const repository = useCategoriesRepository();
  return useQuery({
    queryKey: categoryKeys.detail(id),
    queryFn: () => repository.getById(id),
    enabled: !!id,
  });
};

// ═══════════════════════════════════════════════════════════════════
// MUTATION HOOKS
// ═══════════════════════════════════════════════════════════════════

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  const repository = useCategoriesRepository();

  return useMutation({
    mutationFn: (input: CreateCategoryInput) => repository.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(`Impossible de créer la catégorie : ${error.message}`);
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  const repository = useCategoriesRepository();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateCategoryInput }) =>
      repository.update(id, updates),

    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.all });
      const previousCategories = queryClient.getQueryData<Category[]>(categoryKeys.lists());
      if (previousCategories) {
        queryClient.setQueryData<Category[]>(categoryKeys.lists(), (old) =>
          old?.map((category) =>
            category.id === id ? { ...category, ...updates } : category
          )
        );
      }
      return { previousCategories };
    },

    // Rollback on error (useUpdateCategory)
    onError: (error: Error, _variables, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(categoryKeys.lists(), context.previousCategories);
      }
      toast.error(`Impossible de modifier la catégorie : ${error.message}`);
    },

    onSettled: (updatedCategory) => {
      if (updatedCategory) {
        queryClient.setQueryData(categoryKeys.detail(updatedCategory.id), updatedCategory);
        queryClient.invalidateQueries({ queryKey: categoryKeys.detail(updatedCategory.id) });
      }
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  const repository = useCategoriesRepository();

  return useMutation({
    mutationFn: (id: string) => repository.delete(id),

    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.all });
      const previousCategories = queryClient.getQueryData<Category[]>(categoryKeys.lists());
      if (previousCategories) {
        queryClient.setQueryData<Category[]>(categoryKeys.lists(), (old) =>
          old?.filter((category) => category.id !== id)
        );
      }
      return { previousCategories };
    },

    // Rollback on error (useDeleteCategory)
    onError: (error: Error, _id, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(categoryKeys.lists(), context.previousCategories);
      }
      toast.error(`Impossible de supprimer la catégorie : ${error.message}`);
    },

    onSettled: (_result, _error, deletedId) => {
      queryClient.removeQueries({ queryKey: categoryKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
};

// ═══════════════════════════════════════════════════════════════════
// DERIVED HOOKS
// ═══════════════════════════════════════════════════════════════════

export const useCategoryNames = () => {
  const { data: categories = [] } = useCategories();
  return useMemo(() => categories.map((c) => c.name), [categories]);
};

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════

export type { Category, CreateCategoryInput, UpdateCategoryInput } from './types';
export { categoryKeys } from './constants';
