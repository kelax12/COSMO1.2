// ═══════════════════════════════════════════════════════════════════
// KR-COMPLETIONS MODULE - React Query Hooks
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getKRCompletionsRepository } from '@/lib/repository.factory';
import { IKRCompletionsRepository } from './repository';
import { KRCompletion, CreateKRCompletionInput } from './types';
import { krCompletionKeys } from './constants';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY - Via centralized factory (demo/production mode)
// ═══════════════════════════════════════════════════════════════════

const useKRCompletionsRepository = (): IKRCompletionsRepository => {
  return useMemo(() => getKRCompletionsRepository(), []);
};

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch all KR completion records
 */
export const useKRCompletions = (options?: { enabled?: boolean }) => {
  const repository = useKRCompletionsRepository();
  return useQuery({
    queryKey: krCompletionKeys.lists(),
    queryFn: () => repository.getAll(),
    enabled: options?.enabled ?? true,
  });
};

// ═══════════════════════════════════════════════════════════════════
// WRITE HOOKS (Mutations)
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a KR completion record.
 * Called when a Key Result is marked as complete.
 */
export const useCreateKRCompletion = () => {
  const queryClient = useQueryClient();
  const repository = useKRCompletionsRepository();

  return useMutation({
    mutationFn: (input: CreateKRCompletionInput) => repository.create(input),

    // Optimistic update — add immediately for instant dashboard feedback
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: krCompletionKeys.all });

      const previous = queryClient.getQueryData<KRCompletion[]>(krCompletionKeys.lists());

      if (previous) {
        const optimistic: KRCompletion = { ...input, id: crypto.randomUUID() };
        queryClient.setQueryData<KRCompletion[]>(
          krCompletionKeys.lists(),
          (old) => [...(old ?? []), optimistic]
        );
      }

      return { previous };
    },

    onError: (error: Error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(krCompletionKeys.lists(), context.previous);
      }
      toast.error(`Erreur enregistrement KR : ${error.message}`);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: krCompletionKeys.all });
    },
  });
};
