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

export const useMyOrganizations = (enabled: boolean = true) => {
  const repository = useOrgRepository();
  return useQuery({
    queryKey: orgKeys.mine(),
    queryFn: () => repository.getMyOrganizations(),
    enabled,
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

export const useDeleteOrganization = () => {
  const queryClient = useQueryClient();
  const repository = useOrgRepository();
  return useMutation({
    mutationFn: (orgId: string) => repository.deleteOrganization(orgId),
    onSuccess: () => {
      toast.success('Entreprise supprimée définitivement');
      queryClient.invalidateQueries({ queryKey: orgKeys.all });
    },
    onError: (error: Error) => {
      toast.error(`Impossible de supprimer l'entreprise : ${error.message}`);
    },
  });
};

export const useSetMemberManager = () => {
  const queryClient = useQueryClient();
  const repository = useOrgRepository();
  return useMutation({
    mutationFn: ({ orgId, userId, managerId }: { orgId: string; userId: string; managerId: string | null; silent?: boolean }) =>
      repository.setMemberManager(orgId, userId, managerId),
    onSuccess: (_d, variables) => {
      // silent : l'appelant affiche son propre feedback (ex. toast d'annulation pyramide).
      if (!variables.silent) toast.success('Position mise à jour');
      queryClient.invalidateQueries({ queryKey: orgKeys.members(variables.orgId) });
    },
    onError: (error: Error) => {
      toast.error(`Impossible de déplacer le membre : ${error.message}`);
    },
  });
};

// ─── Invitations placées (v2, lot 1c) ────────────────────────────────

export const useCreateInviteLink = () => {
  const repository = useOrgRepository();
  return useMutation({
    mutationFn: ({ orgId, managerId }: { orgId: string; managerId: string | null }) =>
      repository.createInviteLink(orgId, managerId),
    onError: (error: Error) => {
      toast.error(`Impossible de créer le lien : ${error.message}`);
    },
  });
};

export const useClaimOrgInvite = () => {
  const queryClient = useQueryClient();
  const repository = useOrgRepository();
  return useMutation({
    mutationFn: (token: string) => repository.claimInviteLink(token),
    onSuccess: (result) => {
      toast.success(`Bienvenue chez ${result.orgName} !`);
      queryClient.invalidateQueries({ queryKey: orgKeys.all });
    },
    // Pas de toast d'erreur ici : la page de claim affiche un état dédié
    // (message générique — le lien peut être expiré/consommé/invalide).
  });
};

export const useRegenerateJoinCode = () => {
  const queryClient = useQueryClient();
  const repository = useOrgRepository();
  return useMutation({
    mutationFn: (orgId: string) => repository.regenerateJoinCode(orgId),
    onSuccess: () => {
      toast.success('Nouveau code généré — l\'ancien ne fonctionne plus');
      queryClient.invalidateQueries({ queryKey: orgKeys.mine() });
    },
    onError: (error: Error) => {
      toast.error(`Impossible de régénérer le code : ${error.message}`);
    },
  });
};

export const useUpdateOrganization = () => {
  const queryClient = useQueryClient();
  const repository = useOrgRepository();
  return useMutation({
    mutationFn: ({ orgId, input }: { orgId: string; input: import('./types').UpdateOrganizationInput }) =>
      repository.updateOrganization(orgId, input),
    onSuccess: () => {
      toast.success('Profil de l\'entreprise mis à jour');
      queryClient.invalidateQueries({ queryKey: orgKeys.mine() });
    },
    onError: (error: Error) => {
      toast.error(`Impossible de mettre à jour le profil : ${error.message}`);
    },
  });
};
