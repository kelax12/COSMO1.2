// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS MODULE - React Query hooks
// ═══════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getOrganizationsRepository } from '@/lib/repository.factory';
import { validateOrThrow } from '@/lib/validation/validate';
import { createOrganizationSchema, joinCodeSchema } from './organization.schema';
import { orgKeys } from './constants';
import type { OrgRole } from './types';

const useOrgRepository = () => getOrganizationsRepository();

// ─── Read hooks ──────────────────────────────────────────────────────

export const useMyOrganization = () => {
  const repository = useOrgRepository();
  return useQuery({
    queryKey: orgKeys.mine(),
    queryFn: () => repository.getMyOrganization(),
    staleTime: 1000 * 60 * 5,
  });
};

export const useOrgMembers = (orgId: string | undefined) => {
  const repository = useOrgRepository();
  return useQuery({
    queryKey: orgKeys.members(orgId ?? ''),
    queryFn: () => repository.getMembers(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useOrgJoinRequests = (orgId: string | undefined) => {
  const repository = useOrgRepository();
  return useQuery({
    queryKey: orgKeys.joinRequests(orgId ?? ''),
    queryFn: () => repository.getPendingJoinRequests(orgId as string),
    enabled: !!orgId,
    // Collaboration sans realtime : même cadence que friends.
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
};

export const useMySentJoinRequest = () => {
  const repository = useOrgRepository();
  return useQuery({
    queryKey: orgKeys.mySentRequest(),
    queryFn: () => repository.getMySentJoinRequest(),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
};

// ─── Mutation hooks ──────────────────────────────────────────────────

export const useCreateOrganization = () => {
  const queryClient = useQueryClient();
  const repository = useOrgRepository();
  return useMutation({
    mutationFn: (name: string) => {
      const { name: valid } = validateOrThrow(createOrganizationSchema, { name });
      return repository.createOrganization(valid);
    },
    onSuccess: () => {
      toast.success('Entreprise créée');
      queryClient.invalidateQueries({ queryKey: orgKeys.all });
    },
    onError: (error: Error) => {
      toast.error(`Impossible de créer l'entreprise : ${error.message}`);
    },
  });
};

export const useRequestJoinOrganization = () => {
  const queryClient = useQueryClient();
  const repository = useOrgRepository();
  return useMutation({
    mutationFn: (code: string) => {
      const { code: valid } = validateOrThrow(joinCodeSchema, { code });
      return repository.requestJoin(valid);
    },
    onSuccess: (result) => {
      toast.success(`Demande envoyée à ${result.orgName || "l'entreprise"}`);
      queryClient.invalidateQueries({ queryKey: orgKeys.mySentRequest() });
    },
    onError: (error: Error) => {
      toast.error(`Impossible de rejoindre l'entreprise : ${error.message}`);
    },
  });
};

export const useRespondJoinRequest = () => {
  const queryClient = useQueryClient();
  const repository = useOrgRepository();
  return useMutation({
    mutationFn: ({ requestId, accept }: { requestId: string; accept: boolean }) =>
      repository.respondJoinRequest(requestId, accept),
    onSuccess: (_data, variables) => {
      toast.success(variables.accept ? 'Membre ajouté' : 'Demande refusée');
      queryClient.invalidateQueries({ queryKey: orgKeys.all });
    },
    onError: (error: Error) => {
      toast.error(`Impossible de traiter la demande : ${error.message}`);
    },
  });
};

export const useCancelJoinRequest = () => {
  const queryClient = useQueryClient();
  const repository = useOrgRepository();
  return useMutation({
    mutationFn: (requestId: string) => repository.cancelJoinRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.mySentRequest() });
    },
    onError: (error: Error) => {
      toast.error(`Impossible d'annuler la demande : ${error.message}`);
    },
  });
};

// ─── Administration ──────────────────────────────────────────────────

export const useSetMemberRole = () => {
  const queryClient = useQueryClient();
  const repository = useOrgRepository();
  return useMutation({
    mutationFn: ({ orgId, userId, role }: { orgId: string; userId: string; role: OrgRole }) =>
      repository.setMemberRole(orgId, userId, role),
    onSuccess: () => {
      toast.success('Rôle mis à jour');
      queryClient.invalidateQueries({ queryKey: orgKeys.all });
    },
    onError: (error: Error) => {
      toast.error(`Impossible de changer le rôle : ${error.message}`);
    },
  });
};

export const useRemoveMember = () => {
  const queryClient = useQueryClient();
  const repository = useOrgRepository();
  return useMutation({
    mutationFn: ({ orgId, userId }: { orgId: string; userId: string }) =>
      repository.removeMember(orgId, userId),
    onSuccess: () => {
      toast.success('Membre retiré');
      queryClient.invalidateQueries({ queryKey: orgKeys.all });
    },
    onError: (error: Error) => {
      toast.error(`Impossible de retirer le membre : ${error.message}`);
    },
  });
};

export const useLeaveOrganization = () => {
  const queryClient = useQueryClient();
  const repository = useOrgRepository();
  return useMutation({
    mutationFn: (orgId: string) => repository.leaveOrganization(orgId),
    onSuccess: () => {
      toast.success('Vous avez quitté l\'entreprise');
      queryClient.invalidateQueries({ queryKey: orgKeys.all });
    },
    onError: (error: Error) => {
      toast.error(`Impossible de quitter l'entreprise : ${error.message}`);
    },
  });
};
