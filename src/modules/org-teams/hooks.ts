// ═══════════════════════════════════════════════════════════════════
// ORG-TEAMS MODULE - React Query hooks
// ═══════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { getOrgTeamsRepository } from '@/lib/repository.factory';
import { orgTeamKeys } from './constants';
import type { CreateOrgTeamInput, DeleteOrgTeamOptions, UpdateOrgTeamInput } from './types';
import { translator } from '@/i18n/useT';

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
      toast.success(translator('errors').t('success.teamCreated'));
      queryClient.invalidateQueries({ queryKey: orgTeamKeys.teams(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.createTeam', { message: error.message })),
  });
};

export const useDeleteOrgTeam = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ teamId, ...options }: { teamId: string } & DeleteOrgTeamOptions) =>
      repository.deleteTeam(teamId, options),
    onSuccess: () => {
      toast.success(translator('errors').t('success.teamDeleted'));
      queryClient.invalidateQueries({ queryKey: orgTeamKeys.teams(orgId) });
      queryClient.invalidateQueries({ queryKey: orgTeamKeys.members(orgId) });
      // Les projets et OKR ont pu changer d'équipe (mig. 151).
      queryClient.invalidateQueries({ queryKey: ['team-projects'] });
      queryClient.invalidateQueries({ queryKey: ['team-okrs'] });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.deleteTeam', { message: error.message })),
  });
};

/** Ce qu'une suppression d'équipe emporterait : lu à l'ouverture de la confirmation. */
export const useTeamDeletionImpact = (teamId: string | null) => {
  const repository = useRepo();
  return useQuery({
    queryKey: [...orgTeamKeys.all, 'deletion-impact', teamId ?? ''] as const,
    queryFn: () => repository.getTeamDeletionImpact(teamId as string),
    enabled: !!teamId,
    staleTime: 0,
  });
};

export const useUpdateOrgTeam = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ teamId, input }: { teamId: string; input: UpdateOrgTeamInput }) =>
      repository.updateTeam(teamId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orgTeamKeys.teams(orgId) }),
    onError: (error: Error) => toast.error(translator('errors').t('mutation.updateTeam', { message: error.message })),
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
    onError: (error: Error) => toast.error(translator('errors').t('mutation.addTeamMember', { message: error.message })),
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
    onError: (error: Error) => toast.error(translator('errors').t('mutation.removeMember', { message: error.message })),
  });
};

/**
 * Nomme ou révoque le responsable d'une équipe (mig. 107).
 *
 * L'échec le plus probable n'est pas technique mais un refus de la RLS
 * (l'appelant n'est ni admin ni responsable de cette équipe) : le message doit
 * donc rester lisible pour un utilisateur, pas parler de policy.
 */
export const useSetTeamLead = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ teamId, userId, isLead }: { teamId: string; userId: string; isLead: boolean }) =>
      repository.setTeamLead(teamId, userId, isLead),
    onSuccess: (_data, { isLead }) => {
      queryClient.invalidateQueries({ queryKey: orgTeamKeys.members(orgId) });
      toast.success(
        translator('org').t(isLead ? 'teams.leadNamed' : 'teams.leadRemoved'),
      );
    },
    onError: (error: Error) =>
      toast.error(translator('org').t('teams.leadFailed', { message: error.message })),
  });
};
