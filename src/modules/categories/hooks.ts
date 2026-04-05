// ═══════════════════════════════════════════════════════════════════
// CATEGORIES MODULE - React Query Hooks
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getCategoriesRepository } from '@/lib/repository.factory';
import { ICategoriesRepository } from './repository';
import { Category, CreateCategoryInput, UpdateCategoryInput } from './types';
import { categoryKeys } from './constants';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY FACTORY
// ═══════════════════════════════════════════════════════════════════

/**
 * Factory hook to get the categories repository
 * Selects Supabase or LocalStorage based on environment config
 */
const useCategoriesRepository = (): ICategoriesRepository => {
  return useMemo(() => getCategoriesRepository(), []);
};

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Invalidate all category-related queries
 */
const invalidateAllCategoryQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: categoryKeys.all });
};

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch all categories
 */
export const useCategories = (options?: { enabled?: boolean }) => {
  const repository = useCategoriesRepository();
  return useQuery({
    queryKey: categoryKeys.lists(),
    queryFn: () => repository.getAll(),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 30, // 30 minutes — les catégories changent rarement
    gcTime: 1000 * 60 * 60,    // 1 heure en cache
  });
};

/**
 * Fetch a single category by ID
 */
export const useCategory = (id: string, options?: { enabled?: boolean }) => {
  const repository = useCategoriesRepository();
  return useQuery({
    queryKey: categoryKeys.detail(id),
    queryFn: () => repository.getById(id),
    enabled: (options?.enabled ?? true) && !!id,
  });
};

// ═══════════════════════════════════════════════════════════════════
// UTILITY HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get category color by ID
 * Returns a memoized function to look up colors
 */
export const useCategoryColor = () => {
  const { data: categories = [] } = useCategories();
  
  return useMemo(() => {
    return (categoryId: string): string => {
      return categories.find(c => c.id === categoryId)?.color || '#6B7280';
    };
  }, [categories]);
};

/**
 * Get category by ID
 * Returns a memoized lookup function
 */
export const useCategoryLookup = () => {
  const { data: categories = [] } = useCategories();
  
  return useMemo(() => {
    return (categoryId: string): Category | undefined => {
      return categories.find(c => c.id === categoryId);
    };
  }, [categories]);
};

// ═══════════════════════════════════════════════════════════════════
// WRITE HOOKS (Mutations)
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a new category
 */
export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  const repository = useCategoriesRepository();

  return useMutation({
    mutationFn: (input: CreateCategoryInput) => repository.create(input),
    onSuccess: () => {
      // Only invalidate the list, not all queries
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
};

/**
 * Update an existing category with optimistic update
 */
export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  const repository = useCategoriesRepository();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateCategoryInput }) =>
      repository.update(id, updates),

    // Optimistic update
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: categoryKeys.all });

      // Snapshot current state
      const previousCategories = queryClient.getQueryData<Category[]>(categoryKeys.lists());

      // Optimistically update the list
      if (previousCategories) {
        queryClient.setQueryData<Category[]>(categoryKeys.lists(), (old) =>
          old?.map((category) =>
            category.id === id ? { ...category, ...updates } : category
          )
        );
      }

      return { previousCategories };
    },

    // Rollback on error
    onError: (_error, _variables, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(categoryKeys.lists(), context.previousCategories);
      }
    },

    // Refetch on settle
    onSettled: (updatedCategory) => {
      if (updatedCategory) {
        queryClient.setQueryData(categoryKeys.detail(updatedCategory.id), updatedCategory);
        // Invalidate only the specific detail and list
        queryClient.invalidateQueries({ queryKey: categoryKeys.detail(updatedCategory.id) });
      }
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
};

/**
 * Delete a category with optimistic update
 */
export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  const repository = useCategoriesRepository();

  return useMutation({
    mutationFn: (id: string) => repository.delete(id),

    // Optimistic update
    onMutate: async (id: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: categoryKeys.all });

      // Snapshot current state
      const previousCategories = queryClient.getQueryData<Category[]>(categoryKeys.lists());

      // Optimistically remove from list
      if (previousCategories) {
        queryClient.setQueryData<Category[]>(categoryKeys.lists(), (old) =>
          old?.filter((category) => category.id !== id)
        );
      }

      return { previousCategories };
    },

    // Rollback on error
    onError: (_error, _id, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(categoryKeys.lists(), context.previousCategories);
      }
    },

    // Cleanup on settle
    onSettled: (_result, _error, deletedId) => {
      queryClient.removeQueries({ queryKey: categoryKeys.detail(deletedId) });
      // Only invalidate the list
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
};

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORTS for convenience
// ═══════════════════════════════════════════════════════════════════

export type { Category, CreateCategoryInput, UpdateCategoryInput } from './types';
export { categoryKeys } from './constants';
