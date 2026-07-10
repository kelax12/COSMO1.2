// ═══════════════════════════════════════════════════════════════════
// ORG-TEAMS MODULE - React Query hooks
// ═══════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getOrgTeamsRepository } from '@/lib/repository.factory';
import { orgTeamKeys } from './constants';
import type { CreateOrgTeamInput } from './types';

const useRepo = () => getOrgTeamsRepository();

export const useOrgTeams = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: orgTeamKeys.teams(orgId ?? ''),
    queryFn: () => repository.getTeams(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useOrgTeamMembers = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: orgTeamKeys.members(orgId ?? ''),
    queryFn: () => repository.getTeamMembers(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useCreateOrgTeam = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (input: CreateOrgTeamInput) => repository.createTeam(orgId, input),
    onSuccess: () => {
      toast.success('Équipe créée');
      queryClient.invalidateQueries({ queryKey: orgTeamKeys.teams(orgId) });
    },
    onError: (error: Error) => toast.error(`Impossible de créer l'équipe : ${error.message}`),
  });
};

export const useDeleteOrgTeam = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (teamId: string) => repository.deleteTeam(teamId),
    onSuccess: () => {
      toast.success('Équipe supprimée');
      queryClient.invalidateQueries({ queryKey: orgTeamKeys.teams(orgId) });
      queryClient.invalidateQueries({ queryKey: orgTeamKeys.members(orgId) });
    },
    onError: (error: Error) => toast.error(`Impossible de supprimer l'équipe : ${error.message}`),
  });
};

export const useAddTeamMember = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      repository.addTeamMember(teamId, orgId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgTeamKeys.members(orgId) });
    },
    onError: (error: Error) => toast.error(`Impossible d'ajouter le membre : ${error.message}`),
  });
};

export const useRemoveTeamMember = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      repository.removeTeamMember(teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgTeamKeys.members(orgId) });
    },
    onError: (error: Error) => toast.error(`Impossible de retirer le membre : ${error.message}`),
  });
};
