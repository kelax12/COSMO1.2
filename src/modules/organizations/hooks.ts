// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS MODULE - React Query hooks
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getOrganizationsRepository } from '@/lib/repository.factory';
import { validateOrThrow } from '@/lib/validation/validate';
import { createOrganizationSchema, joinCodeSchema } from './organization.schema';
import { orgKeys } from './constants';
import { useOrgInbox } from './inbox';
import type { OrgRole } from './types';
import type { SetOrgPermissionsInput } from './permissions';
import { translator } from '@/i18n/useT';

const useOrgRepository = () => getOrganizationsRepository();

// ─── Read hooks ──────────────────────────────────────────────────────

export const useMyOrganizations = (enabled: boolean = true) => {
  const repository = useOrgRepository();
  return useQuery({
    queryKey: orgKeys.mine(),
    queryFn: () => repository.getMyOrganizations(),
    enabled,
    // Un retrait d'entreprise doit se voir. Avec 5 min de fraîcheur et aucun
    // refetch, l'exclu gardait son onglet « Entreprise » et sa dernière vue
    // en cache pendant tout ce temps — voire indéfiniment sur un onglet
    // jamais quitté. 60 s + refetch au retour sur l'onglet : l'appartenance
    // est revérifiée à chaque fois que l'utilisateur revient à l'app.
    //
    // Pas de `refetchInterval` : ce serait deux requêtes par tick pour tout le
    // monde, et l'appartenance à une organisation ne change pas à la minute.
    // Le retour d'onglet est le bon déclencheur (cf. garde-fou egress,
    // CLAUDE.md § synchronisation de la collaboration).
    staleTime: 1000 * 60,
    refetchOnWindowFocus: true,
  });
};

/**
 * Membres de l'organisation.
 *
 * L'arrivée d'un membre est une action faite depuis UN AUTRE appareil : rien
 * côté admin ne l'invalide. Avec les 5 min de fraîcheur d'origine et aucun
 * refetch, un compte qui venait d'entrer restait invisible dans la pyramide et
 * dans l'annuaire — l'admin croyait que l'invitation avait échoué.
 *
 * `live` distingue les DEUX usages de ce hook, parce qu'ils n'ont pas le même
 * coût :
 *
 *  • par défaut (TaskTable, AgendaPage, CommandPalette…) l'annuaire ne sert
 *    qu'à résoudre des noms d'assignés. Ces surfaces sont montées en
 *    permanence : y brancher un sondage ferait payer deux requêtes toutes les
 *    30 s à chaque utilisateur d'organisation, sur toutes les pages. C'est
 *    exactement le garde-fou egress de CLAUDE.md (§ synchronisation de la
 *    collaboration). On se contente donc du retour d'onglet.
 *  • `live: true` — la page Entreprise, la seule où l'on REGARDE la liste des
 *    membres et où l'on attend de voir quelqu'un arriver. Sondage borné à
 *    cette page, à la même cadence que les demandes d'adhésion (20 s).
 */
export const useOrgMembers = (
  orgId: string | undefined,
  options?: { live?: boolean },
) => {
  const repository = useOrgRepository();
  return useQuery({
    queryKey: orgKeys.members(orgId ?? ''),
    queryFn: () => repository.getMembers(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
    ...(options?.live ? { refetchInterval: 20_000 } : {}),
  });
};

/** Demandes d'adhesion en attente pour cette org (vue admin). */
export const useOrgJoinRequests = (orgId: string | undefined) => {
  const { data, ...rest } = useOrgInbox();
  const filtered = useMemo(
    () => (data?.joinRequests ?? []).filter((r) => r.orgId === orgId),
    [data, orgId],
  );
  return { ...rest, data: orgId ? filtered : [] };
};

/** Ma demande d'adhesion en attente, ou null. */
export const useMySentJoinRequest = () => {
  const { data, ...rest } = useOrgInbox();
  return { ...rest, data: data?.myJoinRequest ?? null };
};

/**
 * Invitations d entreprise recues et non traitees.
 *
 * Temps reel (mig. 118) : une invitation apparait sans que le destinataire ait
 * a recharger, et sans sondage.
 */
export const useMyOrgInvitations = () => {
  const { data, ...rest } = useOrgInbox();
  const invitations = useMemo(() => data?.invitations ?? [], [data]);
  return { ...rest, data: invitations };
};

/** Retraits d'entreprise non acquittes. */
export const useMyOrgRemovalNotices = () => {
  const { data, ...rest } = useOrgInbox();
  const notices = useMemo(() => data?.removalNotices ?? [], [data]);
  return { ...rest, data: notices };
};

export const useDismissOrgRemovalNotice = () => {
  const queryClient = useQueryClient();
  const repository = useOrgRepository();
  return useMutation({
    mutationFn: (noticeId: string) => repository.dismissOrgRemovalNotice(noticeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.inbox() });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};

/**
 * Ids des amis que j'ai invités dans cette org et dont l'invitation est
 * encore en attente — pour griser leur bouton « Inviter » dans
 * InviteFriendsToOrg au lieu de le laisser identique à « jamais invité ».
 */
export const usePendingSentInvitations = (orgId: string | undefined) => {
  const repository = useOrgRepository();
  return useQuery({
    queryKey: orgKeys.pendingSentInvitations(orgId ?? ''),
    queryFn: () => repository.getPendingSentInvitationIds(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 30,
  });
};

export const useInviteFriendToOrg = () => {
  const queryClient = useQueryClient();
  const repository = useOrgRepository();
  return useMutation({
    mutationFn: ({ orgId, friendUserId }: { orgId: string; friendUserId: string }) =>
      repository.inviteFriendToOrg(orgId, friendUserId),
    onSuccess: () => {
      toast.success(translator('org').t('inviteJoin.inviteSent'));
      queryClient.invalidateQueries({ queryKey: orgKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};

export const useRespondOrgInvitation = () => {
  const queryClient = useQueryClient();
  const repository = useOrgRepository();
  return useMutation({
    mutationFn: ({ invitationId, accept }: { invitationId: string; accept: boolean }) =>
      repository.respondOrgInvitation(invitationId, accept),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.accept
          ? translator('org').t('inviteJoin.joinedOrg')
          : translator('org').t('inviteJoin.invitationRefused'),
      );
      queryClient.invalidateQueries({ queryKey: orgKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
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
      toast.success(translator('errors').t('success.orgCreated'));
      queryClient.invalidateQueries({ queryKey: orgKeys.all });
    },
    onError: (error: Error) => {
      toast.error(translator('errors').t('mutation.createOrg', { message: error.message }));
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
      toast.success(translator('errors').t('success.joinRequestSent', { org: result.orgName || translator('errors').t('success.theCompany') }));
      queryClient.invalidateQueries({ queryKey: orgKeys.inbox() });
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
      toast.success(variables.accept ? translator('errors').t('success.memberAdded') : translator('errors').t('success.requestRefused'));
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
      queryClient.invalidateQueries({ queryKey: orgKeys.inbox() });
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
      toast.success(translator('errors').t('success.roleUpdated'));
      queryClient.invalidateQueries({ queryKey: orgKeys.all });
    },
    onError: (error: Error) => {
      toast.error(translator('errors').t('mutation.changeRole', { message: error.message }));
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
      toast.success(translator('errors').t('success.memberRemoved'));
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
      toast.success(translator('errors').t('success.leftOrg'));
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
      toast.success(translator('errors').t('success.orgDeleted'));
      queryClient.invalidateQueries({ queryKey: orgKeys.all });
    },
    onError: (error: Error) => {
      toast.error(`Impossible de supprimer l'entreprise : ${error.message}`);
    },
  });
};

export const useTransferOwnership = () => {
  const queryClient = useQueryClient();
  const repository = useOrgRepository();
  return useMutation({
    mutationFn: ({ orgId, newOwnerId }: { orgId: string; newOwnerId: string }) =>
      repository.transferOwnership(orgId, newOwnerId),
    onSuccess: () => {
      toast.success(translator('errors').t('success.ownershipTransferred'));
      queryClient.invalidateQueries({ queryKey: orgKeys.all });
    },
    onError: (error: Error) => {
      toast.error(translator('errors').t('mutation.transferOwnership', { message: error.message }));
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
      if (!variables.silent) toast.success(translator('errors').t('success.positionUpdated'));
      queryClient.invalidateQueries({ queryKey: orgKeys.members(variables.orgId) });
    },
    onError: (error: Error) => {
      toast.error(translator('errors').t('mutation.moveMember', { message: error.message }));
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
      toast.error(translator('errors').t('mutation.createLink', { message: error.message }));
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
      toast.success(translator('errors').t('success.codeRegenerated'));
      queryClient.invalidateQueries({ queryKey: orgKeys.mine() });
    },
    onError: (error: Error) => {
      toast.error(translator('errors').t('mutation.regenerateCode', { message: error.message }));
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
      toast.success(translator('errors').t('success.orgProfileUpdated'));
      queryClient.invalidateQueries({ queryKey: orgKeys.mine() });
    },
    onError: (error: Error) => {
      toast.error(translator('errors').t('mutation.updateOrgProfile', { message: error.message }));
    },
  });
};

// ─── Permissions par membre (mig. 115) ───────────────────────────────

/**
 * Les SURCHARGES de permissions posées dans l'organisation.
 *
 * Un membre absent de la liste n'a « aucune surcharge », pas « aucun droit » :
 * la résolution passe toujours par `effectivePermissions`, jamais par la
 * présence d'une ligne.
 *
 * Pas de sondage : une permission change à la main, rarement, et cette requête
 * accompagne déjà `useOrgMembers` sur la page Entreprise (garde-fou egress,
 * CLAUDE.md § synchronisation de la collaboration).
 */
export const useOrgMemberPermissions = (orgId: string | undefined) => {
  const repository = useOrgRepository();
  return useQuery({
    queryKey: orgKeys.permissions(orgId ?? ''),
    queryFn: () => repository.getMemberPermissions(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: true,
  });
};

export const useSetMemberPermissions = () => {
  const queryClient = useQueryClient();
  const repository = useOrgRepository();
  return useMutation({
    mutationFn: ({ orgId, userId, input }: { orgId: string; userId: string; input: SetOrgPermissionsInput }) =>
      repository.setMemberPermissions(orgId, userId, input),
    onSuccess: (_d, variables) => {
      toast.success(translator('errors').t('success.permissionsUpdated'));
      queryClient.invalidateQueries({ queryKey: orgKeys.permissions(variables.orgId) });
    },
    onError: (error: Error) => {
      toast.error(translator('errors').t('mutation.updatePermissions', { message: error.message }));
    },
  });
};
