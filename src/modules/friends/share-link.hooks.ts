// ═══════════════════════════════════════════════════════════════════
// FRIENDS MODULE — Liens d'invitation de partage (share_links, mig. 046)
//
// Feature Supabase-only : un lien d'invitation cross-user n'a pas de sens en
// LocalStorage (pas de 2ᵉ utilisateur en démo) → pas d'implémentation repo
// démo, les hooks sont `enabled`/no-op hors prod. La section UI est masquée
// en mode démo (CollaboratorModal).
// ═══════════════════════════════════════════════════════════════════
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { friendKeys } from './constants';

export const PENDING_INVITE_STORAGE_KEY = 'cosmo_pending_share_invite';

export interface ClaimShareLinkResult {
  task_id: string;
  task_name: string;
  owner_name: string;
  already_accepted: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidInviteToken(token: string | undefined | null): token is string {
  return !!token && UUID_RE.test(token);
}

export function buildInviteUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

/**
 * Get-or-create du lien d'invitation pour une tâche : réutilise le lien non
 * expiré le plus récent, sinon en crée un (RLS : owner + owns_task).
 */
export const useShareLink = (taskId: string, enabled: boolean) => {
  return useQuery({
    queryKey: [...friendKeys.all, 'shareLink', taskId],
    queryFn: async (): Promise<string> => {
      const { data: existing, error: selectError } = await supabase
        .from('share_links')
        .select('id, expires_at')
        .eq('task_id', taskId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (selectError) throw normalizeApiError(selectError);
      if (existing) return existing.id as string;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: created, error: insertError } = await supabase
        .from('share_links')
        .insert([{ task_id: taskId, owner_id: user.id }])
        .select('id')
        .single();
      if (insertError) throw normalizeApiError(insertError);
      return created.id as string;
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });
};

/** Claim d'un lien d'invitation (RPC SECURITY DEFINER, mig. 046). */
export const useClaimShareLink = () => {
  return useMutation({
    mutationFn: async (token: string): Promise<ClaimShareLinkResult> => {
      const { data, error } = await supabase.rpc('claim_share_link', { p_token: token });
      if (error) throw error; // message technique (invalid_link/expired_link/own_link) géré par l'appelant
      return data as ClaimShareLinkResult;
    },
  });
};
