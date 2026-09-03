// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - React Query Hooks
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getOKRsRepository } from '@/lib/repository.factory';
import { useIsDemo } from '@/lib/app-mode.store';
import { IOKRsRepository } from './repository';
import { OKR, CreateOKRInput, UpdateOKRInput, UpdateKeyResultInput, OKRFilters } from './types';
import { okrsKeys } from './constants';
import { krCompletionKeys } from '@/modules/kr-completions/constants';
import { validateAsync } from '@/lib/validation/lazy';
import { translator } from '@/i18n/useT';
import { recordDemoCreationIfDemo } from '@/lib/demo-engagement';
import { reportRestoreFailure, splitRestore } from '@/lib/restore-id';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY - Via centralized factory (demo/production mode)
// ═══════════════════════════════════════════════════════════════════

/**
 * Factory hook to get the OKRs repository
 * Uses centralized factory for demo/production mode switching
 */
const useOKRsRepository = (): IOKRsRepository => {
  const isDemo = useIsDemo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getOKRsRepository(), [isDemo]);
};

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Invalidate all OKR-related queries.
 * Inclut kr-completions car create/update peuvent insérer dans le journal
 * quand des KR sont créées/transitionnées en complétées.
 */
const invalidateAllOKRQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: okrsKeys.lists() });
  queryClient.invalidateQueries({ queryKey: krCompletionKeys.all });
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
    staleTime: 1000 * 60 * 5, // 5 minutes explicite — les mutations invalident déjà le cache
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
 * OKR actifs / terminés, DÉRIVÉS de `useOkrs()`, jamais refetchés.
 *
 * ❌ Ne pas les rebrancher sur `useFilteredOkrs`. Une clé React Query
 * différente = une requête réseau de plus, et le repository Supabase enchaîne
 * ensuite un second appel à `key_results` pour hydrater les OKR lus : deux
 * requêtes, pas une. `useWeeklyCheckin()` est monté par le tableau de bord à
 * CHAQUE ouverture, et ne s'en sert que pour tester `length > 0` un lundi ou
 * un mardi. Ces deux requêtes partaient donc tous les jours pour rien
 * (mesuré le 2026-08-26 : 32 requêtes à l'ouverture, dont celles-ci).
 *
 * `completed` est une colonne déjà présente sur chaque OKR chargé : le filtre
 * se fait en mémoire, sur une liste qui tient en dizaines d'éléments.
 */
export const useActiveOkrs = () => {
  const { data, ...rest } = useOkrs();
  const filtered = useMemo(() => (data ?? []).filter((okr) => !okr.completed), [data]);
  return { ...rest, data: filtered };
};

export const useCompletedOkrs = () => {
  const { data, ...rest } = useOkrs();
  const filtered = useMemo(() => (data ?? []).filter((okr) => okr.completed), [data]);
  return { ...rest, data: filtered };
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
    mutationFn: async (input: CreateOKRInput) => {
      await validateAsync('okr.create', input);
      return repository.create(input);
    },
    onSuccess: () => {
      // Engagement démo (src/lib/demo-engagement.ts) : no-op hors démo.
      recordDemoCreationIfDemo();
      invalidateAllOKRQueries(queryClient);
    },
    onError: (error: Error) => {
      toast.error(translator('errors').t('mutation.createOkr', { message: error.message }));
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
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateOKRInput }) => {
      await validateAsync('okr.update', updates);
      return repository.update(id, updates);
    },

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
    onError: (error: Error, _variables, context) => {
      if (context?.previousOKRs) {
        queryClient.setQueryData(okrsKeys.lists(), context.previousOKRs);
      }
      toast.error(translator('errors').t('mutation.updateOkr', { message: error.message }));
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

        // Rollback on error (useDeleteOkr)
    onError: (error: Error, _id, context) => {
      if (context?.previousOKRs) {
        queryClient.setQueryData(okrsKeys.lists(), context.previousOKRs);
      }
      toast.error(translator('errors').t('mutation.deleteOkr', { message: error.message }));
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
      updates: UpdateKeyResultInput;
    }) => repository.updateKeyResult(okrId, keyResultId, updates),
    // Note: completion record is created atomically inside the repository
    // (localStorage writes are synchronous — no race condition possible)

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
              const updatedKeyResults = okr.keyResults.map((kr) => {
                if (kr.id !== keyResultId) return kr;
                const merged = { ...kr, ...updates };
                // Auto-set completedAt (mirrors localStorage repo + Supabase trigger)
                if (merged.completed && !merged.completedAt) {
                  merged.completedAt = new Date().toISOString();
                }
                if (merged.completed === false) {
                  merged.completedAt = null;
                }
                return merged;
              });
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

    // Rollback on error (useUpdateKeyResult)
    onError: (error: Error, _variables, context) => {
      if (context?.previousOKRs) {
        queryClient.setQueryData(okrsKeys.lists(), context.previousOKRs);
      }
      toast.error(translator('errors').t('mutation.updateKeyResult', { message: error.message }));
    },

    // Refetch caches after mutation completes
    onSettled: (updatedOKR) => {
      if (updatedOKR) {
        queryClient.setQueryData(okrsKeys.detail(updatedOKR.id), updatedOKR);
      }
      invalidateAllOKRQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: krCompletionKeys.all });
    },
  });
};

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORTS for convenience
// ═══════════════════════════════════════════════════════════════════

export type { OKR, KeyResult, CreateOKRInput, UpdateOKRInput, UpdateKeyResultInput, OKRFilters } from './types';
export { okrsKeys } from './constants';

// ═══════════════════════════════════════════════════════════════════
// RESTAURATION (« Annuler ») — recree l'objet sous SON identifiant
// ═══════════════════════════════════════════════════════════════════
//
// Separe de `useCreateOkr` a dessein : l'identifiant passe par le second
// argument de `create()`, hors du payload, donc hors de portee d'un objet de
// formulaire enrichi depuis les devtools. Contrat complet et raison de ce
// decoupage : `src/lib/restore-id.ts` (R-08).
//
// ⚠️ N'appeler QUE depuis un toast d'annulation.
export const useRestoreOkr = () => {
  const queryClient = useQueryClient();
  const repository = useOKRsRepository();

  return useMutation({
    mutationFn: (snapshot: OKR) => {
      const { payload, options } = splitRestore(snapshot);
      return repository.create(payload as CreateOKRInput, options);
    },
    onSuccess: () => {
      invalidateAllOKRQueries(queryClient);
    },
    // Un « Annuler » rate doit se VOIR : `console.error` est supprime du
    // bundle de production (vite.config.ts), l'echec etait donc muet.
    onError: (error: Error) => reportRestoreFailure('okr', error),
  });
};
