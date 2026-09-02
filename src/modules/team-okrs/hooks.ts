// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS MODULE - React Query hooks
// ═══════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getTeamOKRsRepository } from '@/lib/repository.factory';
import { validateAsync } from '@/lib/validation/lazy';
import { teamOkrKeys } from './constants';
import type {
  CreateTeamOKRInput,
  UpdateTeamOKRInput,
  UpdateTeamKRInput,
  SyncTeamKRInput,
} from './types';
import { translator } from '@/i18n/useT';

const useRepo = () => getTeamOKRsRepository();

/**
 * OKR d'équipe.
 *
 * `live` distingue les deux usages, exactement comme `useTeamTasks` et
 * `useOrgMembers` — et pour la même raison : ce hook est monté par
 * `CommandPalette`, une surface PERMANENTE. Un `refetchInterval` inconditionnel
 * faisait donc payer à tout membre d'une organisation une lecture org-wide
 * toutes les 30 s, sur TOUTES les pages, sans que personne ne regarde les OKR.
 */
export const useTeamOKRs = (
  orgId: string | undefined,
  options?: { live?: boolean },
) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamOkrKeys.list(orgId ?? ''),
    queryFn: () => repository.getAll(orgId as string),
    enabled: !!orgId,
    ...(options?.live ? { refetchInterval: 30_000 } : {}),
    staleTime: 1000 * 60 * 2,
    // Donnée partagée : au retour sur l'onglet, on resynchronise (reco #12).
    refetchOnWindowFocus: true,
  });
};

export const useCreateTeamOKR = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: async (input: CreateTeamOKRInput) => {
      const valid = await validateAsync('teamOkr.create', input);
      return repository.create(orgId, valid as CreateTeamOKRInput);
    },
    onSuccess: () => {
      toast.success(translator('errors').t('success.objectiveCreated'));
      queryClient.invalidateQueries({ queryKey: teamOkrKeys.list(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.createObjective', { message: error.message })),
  });
};

export const useUpdateTeamOKR = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: async ({ okrId, input }: { okrId: string; input: UpdateTeamOKRInput }) => {
      const valid = await validateAsync('teamOkr.update', input);
      return repository.update(okrId, valid as UpdateTeamOKRInput);
    },
    onSuccess: () => {
      toast.success(translator('errors').t('success.objectiveUpdated'));
      queryClient.invalidateQueries({ queryKey: teamOkrKeys.list(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.updateObjective', { message: error.message })),
  });
};

/**
 * Édition complète d'un OKR : méta (titre/description/catégorie/date/équipes)
 * + synchronisation des KR (ajout/màj/suppression). Un seul toast final.
 */
export const useEditTeamOKR = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: async ({
      okrId,
      meta,
      keyResults,
    }: {
      okrId: string;
      meta: UpdateTeamOKRInput;
      keyResults: SyncTeamKRInput[];
    }) => {
      const validMeta = await validateAsync('teamOkr.update', meta);
      await repository.update(okrId, validMeta as UpdateTeamOKRInput);
      await repository.syncKeyResults(okrId, orgId, keyResults);
    },
    onSuccess: () => {
      toast.success(translator('errors').t('success.objectiveUpdated'));
      queryClient.invalidateQueries({ queryKey: teamOkrKeys.list(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.updateObjective', { message: error.message })),
  });
};

/**
 * Réétiquette la catégorie d'un lot d'OKR (cascade au renommage d'une catégorie
 * d'entreprise — team_okrs.category stocke le NOM). Silencieux (pas de toast par
 * OKR), une seule invalidation en fin.
 */
export const useReassignTeamOKRCategory = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: async ({ okrIds, category }: { okrIds: string[]; category: string }) => {
      for (const okrId of okrIds) {
        await repository.update(okrId, { category });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamOkrKeys.list(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.relabelObjectives', { message: error.message })),
  });
};

export const useDeleteTeamOKR = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (okrId: string) => repository.remove(okrId),
    onSuccess: () => {
      toast.success(translator('errors').t('success.objectiveDeleted'));
      queryClient.invalidateQueries({ queryKey: teamOkrKeys.list(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.deleteTeamObjective', { message: error.message })),
  });
};

export const useUpdateTeamKR = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: async ({ krId, input }: { krId: string; input: UpdateTeamKRInput }) => {
      const valid = await validateAsync('teamKr.update', input);
      return repository.updateKeyResult(krId, valid as UpdateTeamKRInput);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamOkrKeys.list(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.updateKeyResult', { message: error.message })),
  });
};
