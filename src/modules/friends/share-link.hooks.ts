// ═══════════════════════════════════════════════════════════════════
// FRIENDS MODULE — Liens d'invitation de partage (share_links, mig. 046)
//
// Feature Supabase-only : un lien d'invitation cross-user n'a pas de sens en
// LocalStorage (pas de 2ᵉ utilisateur en démo) → pas d'implémentation repo
// démo, les hooks sont `enabled`/no-op hors prod. La section UI est masquée
// en mode démo (cf. ShareLinkField).
// ═══════════════════════════════════════════════════════════════════
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { friendKeys } from './constants';
import { getOrCreateShareLink } from './share-link.repository';

export const PENDING_INVITE_STORAGE_KEY = 'cosmo_pending_share_invite';

export interface ClaimShareLinkResult {
  task_id: string;
  task_name: string;
  owner_name: string;
  /** Avatar du partageur (data URL ou URL distante depuis profiles.avatar_url). */
  owner_avatar: string | null;
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
    queryFn: () => getOrCreateShareLink(taskId),
    enabled,
    staleTime: 1000 * 60 * 5,
  });
};

export interface PreviewShareLinkResult {
  expired: boolean;
  /** `profiles.display_name` du partageur — jamais son email. NULL si non renseigné. */
  owner_name: string | null;
  task_name: string | null;
}

/**
 * Aperçu ANONYME d'un lien d'invitation (RPC `preview_share_link`, mig. 098).
 *
 * Sert à afficher « X vous invite à collaborer sur Y » AVANT l'inscription.
 * Ne consomme pas le lien : le claim reste à `useClaimShareLink`, déclenché
 * par `ShareInviteClaimer` une fois l'utilisateur authentifié.
 *
 * Un lien inconnu et un lien expiré renvoient la même réponse (`expired`) —
 * la RPC ne distingue volontairement pas les deux.
 */
export const usePreviewShareLink = (token: string | undefined, enabled: boolean) => {
  return useQuery({
    queryKey: [...friendKeys.all, 'shareLinkPreview', token],
    queryFn: async (): Promise<PreviewShareLinkResult> => {
      const { data, error } = await supabase.rpc('preview_share_link', { p_token: token });
      if (error) throw normalizeApiError(error);
      const result = data as Partial<PreviewShareLinkResult> | null;
      return {
        expired: result?.expired !== false,
        owner_name: result?.owner_name ?? null,
        task_name: result?.task_name ?? null,
      };
    },
    enabled: enabled && isValidInviteToken(token),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
};

/**
 * Claim d'un lien d'invitation (RPC SECURITY DEFINER, mig. 046).
 *
 * 🔴 C-63 — ce hook lancait l'erreur PostgREST BRUTE (`throw error`), et
 * `ShareInviteClaimer` triait ensuite sur le TEXTE du message. Le reseau qui
 * tombe, un `42501`, un 500 de PostgREST : aucun de ces messages ne contient
 * `own_link` ni `expired_link`, donc l'utilisateur lisait « ce lien
 * d'invitation est invalide » — une affirmation DEFINITIVE et FAUSSE, sur le
 * chemin d'acquisition que `CLAUDE.md` protege explicitement, et il n'avait
 * plus aucune raison de reessayer.
 *
 * `normalizeApiError` sait deja promouvoir `own_link` / `expired_link` /
 * `invalid_link` en `ApiError.code` : les trois sont catalogues en `api.*`,
 * en `fr` comme en `en`. L'appelant branche donc sur un CODE, jamais sur une
 * phrase, et sa branche par defaut ne peut plus se faire passer pour un refus
 * nomme. Les trois identifiants sont ceux des `RAISE EXCEPTION` de la mig. 046
 * / 047 — verifies dans le SQL, pas supposes.
 */
export const useClaimShareLink = () => {
  return useMutation({
    mutationFn: async (token: string): Promise<ClaimShareLinkResult> => {
      const { data, error } = await supabase.rpc('claim_share_link', { p_token: token });
      if (error) throw normalizeApiError(error);
      return data as ClaimShareLinkResult;
    },
  });
};
