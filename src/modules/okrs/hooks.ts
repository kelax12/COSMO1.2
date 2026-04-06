// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - React Query Hooks
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getOKRsRepository } from '@/lib/repository.factory';
import { IOKRsRepository } from './repository';
import { OKR, CreateOKRInput, UpdateOKRInput, UpdateKeyResultInput, OKRFilters } from './types';
import { okrsKeys } from './constants';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY - Via centralized factory (demo/production mode)
// ═══════════════════════════════════════════════════════════════════

/**
 * Factory hook to get the OKRs repository
 * Uses centralized factory for demo/production mode switching
 */
const useOKRsRepository = (): IOKRsRepository => {
  return useMemo(() => getOKRsRepository(), []);
};

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Invalidate all OKR-related queries
 */
const invalidateAllOKRQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: okrsKeys.lists() });
};

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch all OKRs
 */
export const useOkrs = (options?: { enabled?: boolean }) => {
  const repository = useOKRsRepository();
  return useQuery({
    queryKey: okrsKeys.lists(),
    queryFn: () => repository.getAll(),
    enabled: options?.enabled ?? true,
  });
};

/**
 * Fetch a single OKR by ID
 */
export const useOkr = (id: string, options?: { enabled?: boolean }) => {
  const repository = useOKRsRepository();
  return useQuery({
    queryKey: okrsKeys.detail(id),
    queryFn: () => repository.getById(id),
    enabled: (options?.enabled ?? true) && !!id,
  });
};

/**
 * Fetch OKRs by category
 */
export const useOkrsByCategory = (category: string, options?: { enabled?: boolean }) => {
  const repository = useOKRsRepository();
  return useQuery({
    queryKey: okrsKeys.byCategory(category),
    queryFn: () => repository.getByCategory(category),
    enabled: (options?.enabled ?? true) && !!category,
  });
};

/**
 * Fetch OKRs with filters
 */
export const useFilteredOkrs = (filters: OKRFilters, options?: { enabled?: boolean }) => {
  const repository = useOKRsRepository();
  return useQuery({
    queryKey: okrsKeys.list(filters),
    queryFn: () => repository.getFiltered(filters),
    enabled: options?.enabled ?? true,
  });
};

// ═══════════════════════════════════════════════════════════════════
// COMPUTED HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get active (not completed) OKRs
 */
export const useActiveOkrs = () => {
  return useFilteredOkrs({ completed: false });
};

/**
 * Get completed OKRs
 */
export const useCompletedOkrs = () => {
  return useFilteredOkrs({ completed: true });
};

// ═══════════════════════════════════════════════════════════════════
// WRITE HOOKS (Mutations)
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a new OKR
 */
export const useCreateOkr = () => {
  const queryClient = useQueryClient();
  const repository = useOKRsRepository();

  return useMutation({
    mutationFn: (input: CreateOKRInput) => repository.create(input),
    onSuccess: () => {
      invalidateAllOKRQueries(queryClient);
    },
    onError: (error: Error) => {
      toast.error(`Impossible de créer l'OKR : ${error.message}`);
    },
  });
};

/**
 * Update an existing OKR with optimistic update
 */
export const useUpdateOkr = () => {
  const queryClient = useQueryClient();
  const repository = useOKRsRepository();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateOKRInput }) =>
      repository.update(id, updates),

    // Optimistic update
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: okrsKeys.lists() });

      // Snapshot current state
      const previousOKRs = queryClient.getQueryData<OKR[]>(okrsKeys.lists());

      // Optimistically update the list
      if (previousOKRs) {
        queryClient.setQueryData<OKR[]>(okrsKeys.lists(), (old) =>
          old?.map((okr) =>
            okr.id === id ? { ...okr, ...updates } : okr
          )
        );
      }

      return { previousOKRs };
    },

    // Rollback on error
    onError: (_error, _variables, context) => {
      if (context?.previousOKRs) {
        queryClient.setQueryData(okrsKeys.lists(), context.previousOKRs);
      }
    },

    // Refetch on settle
    onSettled: (updatedOKR) => {
      if (updatedOKR) {
        // Update specific OKR in cache
        queryClient.setQueryData(okrsKeys.detail(updatedOKR.id), updatedOKR);
      }
      invalidateAllOKRQueries(queryClient);
    },
  });
};

/**
 * Delete an OKR with optimistic update
 */
export const useDeleteOkr = () => {
  const queryClient = useQueryClient();
  const repository = useOKRsRepository();

  return useMutation({
    mutationFn: (id: string) => repository.delete(id),

    // Optimistic update
    onMutate: async (id: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: okrsKeys.all });

      // Snapshot current state
      const previousOKRs = queryClient.getQueryData<OKR[]>(okrsKeys.lists());

      // Optimistically remove from list
      if (previousOKRs) {
        queryClient.setQueryData<OKR[]>(okrsKeys.lists(), (old) =>
          old?.filter((okr) => okr.id !== id)
        );
      }

      return { previousOKRs };
    },

    // Rollback on error
    onError: (_error, _id, context) => {
      if (context?.previousOKRs) {
        queryClient.setQueryData(okrsKeys.lists(), context.previousOKRs);
      }
    },

    // Cleanup on settle
    onSettled: (_result, _error, deletedId) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: okrsKeys.detail(deletedId) });
      invalidateAllOKRQueries(queryClient);
    },
  });
};

/**
 * Update a KeyResult within an OKR with optimistic update
 */
export const useUpdateKeyResult = () => {
  const queryClient = useQueryClient();
  const repository = useOKRsRepository();

  return useMutation({
    mutationFn: ({ okrId, keyResultId, updates }: { 
      okrId: string; 
      keyResultId: string; 
      updates: UpdateKeyResultInput 
    }) => repository.updateKeyResult(okrId, keyResultId, updates),

    // Optimistic update
    onMutate: async ({ okrId, keyResultId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: okrsKeys.all });

      // Snapshot current state
      const previousOKRs = queryClient.getQueryData<OKR[]>(okrsKeys.lists());

      // Optimistically update the key result
      if (previousOKRs) {
        queryClient.setQueryData<OKR[]>(okrsKeys.lists(), (old) =>
          old?.map((okr) => {
            if (okr.id === okrId) {
              const updatedKeyResults = okr.keyResults.map((kr) =>
                kr.id === keyResultId ? { ...kr, ...updates } : kr
              );
              // Recalculate progress
              const totalProgress = updatedKeyResults.reduce((sum, kr) => {
                return sum + Math.min((kr.currentValue / kr.targetValue) * 100, 100);
              }, 0);
              return {
                ...okr,
                keyResults: updatedKeyResults,
                progress: Math.round(totalProgress / updatedKeyResults.length),
              };
            }
            return okr;
          })
        );
      }

      return { previousOKRs };
    },

    // Rollback on error
    onError: (_error, _variables, context) => {
      if (context?.previousOKRs) {
        queryClient.setQueryData(okrsKeys.lists(), context.previousOKRs);
      }
    },

    // Refetch on settle
    onSettled: (updatedOKR) => {
      if (updatedOKR) {
        queryClient.setQueryData(okrsKeys.detail(updatedOKR.id), updatedOKR);
      }
      invalidateAllOKRQueries(queryClient);
    },
  });
};

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORTS for convenience
// ═══════════════════════════════════════════════════════════════════

export type { OKR, KeyResult, CreateOKRInput, UpdateOKRInput, UpdateKeyResultInput, OKRFilters } from './types';
export { okrsKeys } from './constants';
