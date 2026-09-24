// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS · Gouvernance — hooks React Query
// ═══════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { getOrgGovernanceRepository } from '@/lib/repository.factory';
import { translator } from '@/i18n/useT';
import { orgKeys } from './constants';
import type {
  CreateEmailInvitationsInput,
  NotificationSettings,
  OffboardInput,
  SaveWeeklyReviewInput,
} from './governance.types';

const useRepo = () => getOrgGovernanceRepository();

export const governanceKeys = {
  all: ['org-governance'] as const,
  departure: (orgId: string, userId: string) => [...governanceKeys.all, 'departure', orgId, userId] as const,
  invitations: (orgId: string) => [...governanceKeys.all, 'invitations', orgId] as const,
  audit: (orgId: string, userId?: string) => [...governanceKeys.all, 'audit', orgId, userId ?? ''] as const,
  notifSettings: (orgId: string) => [...governanceKeys.all, 'notif-settings', orgId] as const,
  reviews: (orgId: string) => [...governanceKeys.all, 'reviews', orgId] as const,
};

/** Tout ce qu'un changement de membre peut toucher, invalidé d'un coup. */
const invalidateOrgWork = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: orgKeys.all });
  queryClient.invalidateQueries({ queryKey: ['team-projects'] });
  queryClient.invalidateQueries({ queryKey: ['org-teams'] });
  queryClient.invalidateQueries({ queryKey: ['team-okrs'] });
  queryClient.invalidateQueries({ queryKey: governanceKeys.all });
};

// ─── Départ, suspension ──────────────────────────────────────────────

export const useDepartureImpact = (orgId: string | undefined, userId: string | null) => {
  const repository = useRepo();
  return useQuery({
    queryKey: governanceKeys.departure(orgId ?? '', userId ?? ''),
    queryFn: () => repository.getDepartureImpact(orgId as string, userId as string),
    enabled: !!orgId && !!userId,
    staleTime: 0,
  });
};

export const useOffboardMember = () => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: OffboardInput) => repository.offboardMember(input),
    onSuccess: () => {
      toast.success(translator('errors').t('success.memberOffboarded'));
      invalidateOrgWork(queryClient);
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.offboard', { message: error.message })),
  });
};

export const useSetMemberAccess = () => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { orgId: string; userId: string; suspended: boolean; expiresAt: string | null }) =>
      repository.setMemberAccess(v.orgId, v.userId, v.suspended, v.expiresAt),
    onSuccess: () => {
      toast.success(translator('errors').t('success.memberAccessUpdated'));
      invalidateOrgWork(queryClient);
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.memberAccess', { message: error.message })),
  });
};

// ─── Invitations par e-mail ──────────────────────────────────────────

export const useEmailInvitations = (orgId: string | undefined, enabled = true) => {
  const repository = useRepo();
  return useQuery({
    queryKey: governanceKeys.invitations(orgId ?? ''),
    queryFn: () => repository.getEmailInvitations(orgId as string),
    enabled: !!orgId && enabled,
    staleTime: 1000 * 30,
  });
};

/**
 * Crée les liens PUIS demande l'envoi. Les deux résultats remontent : un
 * lien créé dont l'e-mail n'est pas parti reste utilisable (copiable, et
 * relançable plus tard), l'écran doit donc distinguer les deux.
 */
export const useInviteByEmail = (orgId: string) => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEmailInvitationsInput) => {
      const results = await repository.createEmailInvitations(orgId, input);
      const tokens = results.filter((r) => r.status === 'created' && r.token).map((r) => r.token as string);
      const sending = await repository.sendEmailInvitations(orgId, tokens);
      return { results, sending };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: governanceKeys.invitations(orgId) }),
    onError: (error: Error) => toast.error(translator('errors').t('mutation.emailInvite', { message: error.message })),
  });
};

export const useResendInvitation = (orgId: string) => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => repository.sendEmailInvitations(orgId, [token]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: governanceKeys.invitations(orgId) }),
    onError: (error: Error) => toast.error(translator('errors').t('mutation.emailInvite', { message: error.message })),
  });
};

export const useRevokeEmailInvitation = (orgId: string) => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => repository.revokeEmailInvitation(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: governanceKeys.invitations(orgId) }),
    onError: (error: Error) => toast.error(translator('errors').t('mutation.emailInvite', { message: error.message })),
  });
};

// ─── Journal d'audit ─────────────────────────────────────────────────

export const useAuditLog = (orgId: string | undefined, options?: { targetUserId?: string; enabled?: boolean }) => {
  const repository = useRepo();
  return useQuery({
    queryKey: governanceKeys.audit(orgId ?? '', options?.targetUserId),
    queryFn: () => repository.getAuditLog(orgId as string, { targetUserId: options?.targetUserId }),
    enabled: !!orgId && (options?.enabled ?? true),
    staleTime: 1000 * 30,
  });
};

// ─── Préférences de notification ─────────────────────────────────────

export const useNotificationSettings = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: governanceKeys.notifSettings(orgId ?? ''),
    queryFn: () => repository.getNotificationSettings(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 10,
  });
};

export const useSaveNotificationSettings = (orgId: string) => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: NotificationSettings) => repository.saveNotificationSettings(orgId, settings),
    onSuccess: () => {
      toast.success(translator('errors').t('success.notificationSettingsSaved'));
      queryClient.invalidateQueries({ queryKey: governanceKeys.notifSettings(orgId) });
    },
    onError: (error: Error) =>
      toast.error(translator('errors').t('mutation.notificationSettings', { message: error.message })),
  });
};

// ─── Revues hebdomadaires ────────────────────────────────────────────

export const useWeeklyReviews = (orgId: string | undefined, enabled = true) => {
  const repository = useRepo();
  return useQuery({
    queryKey: governanceKeys.reviews(orgId ?? ''),
    queryFn: () => repository.getWeeklyReviews(orgId as string),
    enabled: !!orgId && enabled,
    staleTime: 1000 * 60,
  });
};

export const useSaveWeeklyReview = (orgId: string) => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveWeeklyReviewInput) => repository.saveWeeklyReview(orgId, input),
    onSuccess: () => {
      toast.success(translator('errors').t('success.weeklyReviewSaved'));
      queryClient.invalidateQueries({ queryKey: governanceKeys.reviews(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.weeklyReview', { message: error.message })),
  });
};
