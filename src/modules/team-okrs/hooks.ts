// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS MODULE - React Query hooks
// ═══════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getTeamOKRsRepository } from '@/lib/repository.factory';
import { validateOrThrow } from '@/lib/validation/validate';
import { createTeamOKRSchema, updateTeamKRSchema } from './team-okr.schema';
import { teamOkrKeys } from './constants';
import type { CreateTeamOKRInput, UpdateTeamOKRInput, UpdateTeamKRInput } from './types';

const useRepo = () => getTeamOKRsRepository();

export const useTeamOKRs = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamOkrKeys.list(orgId ?? ''),
    queryFn: () => repository.getAll(orgId as string),
    enabled: !!orgId,
    refetchInterval: 30_000,
    staleTime: 1000 * 60 * 2,
  });
};

export const useCreateTeamOKR = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (input: CreateTeamOKRInput) => {
      const valid = validateOrThrow(createTeamOKRSchema, input);
      return repository.create(orgId, valid as CreateTeamOKRInput);
    },
    onSuccess: () => {
      toast.success('Objectif créé');
      queryClient.invalidateQueries({ queryKey: teamOkrKeys.list(orgId) });
    },
    onError: (error: Error) => toast.error(`Impossible de créer l'objectif : ${error.message}`),
  });
};

export const useUpdateTeamOKR = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ okrId, input }: { okrId: string; input: UpdateTeamOKRInput }) =>
      repository.update(okrId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamOkrKeys.list(orgId) });
    },
    onError: (error: Error) => toast.error(`Impossible de mettre à jour l'objectif : ${error.message}`),
  });
};

export const useDeleteTeamOKR = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (okrId: string) => repository.remove(okrId),
    onSuccess: () => {
      toast.success('Objectif supprimé');
      queryClient.invalidateQueries({ queryKey: teamOkrKeys.list(orgId) });
    },
    onError: (error: Error) => toast.error(`Impossible de supprimer l'objectif : ${error.message}`),
  });
};

export const useUpdateTeamKR = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ krId, input }: { krId: string; input: UpdateTeamKRInput }) => {
      const valid = validateOrThrow(updateTeamKRSchema, input);
      return repository.updateKeyResult(krId, valid as UpdateTeamKRInput);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamOkrKeys.list(orgId) });
    },
    onError: (error: Error) => toast.error(`Impossible de mettre à jour le résultat clé : ${error.message}`),
  });
};
