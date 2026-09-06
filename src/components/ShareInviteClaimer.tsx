import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/modules/auth/AuthContext';
import {
  useClaimShareLink,
  useAcceptSharedTask,
  useUnshareTask,
  friendKeys,
  PENDING_INVITE_STORAGE_KEY,
  type ClaimShareLinkResult,
} from '@/modules/friends';
import { taskKeys } from '@/modules/tasks';
import { ApiError } from '@/lib/normalizeApiError';
import { isImageAvatar, isEmojiAvatar } from '@/lib/avatar';
import { useT } from '@/i18n/useT';
import { RichText } from '@/components/ui/rich-text';
import { useSheetMotion } from '@/components/mobile/mobile-motion';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';

/**
 * Monté au niveau App (comme CookieBanner) : dès que l'utilisateur est
 * authentifié (login OU fin d'inscription) et qu'un token d'invitation est en
 * attente (posé par InvitePage dans localStorage), claim le lien via la RPC
 * `claim_share_link` puis affiche la popup Accepter/Refuser de la tâche
 * partagée. Survit aux changements de route — c'est ce qui permet d'afficher
 * la popup « à la fin de l'inscription » sans coupler signup et partage.
 */
const ShareInviteClaimer: React.FC = () => {
  const { t } = useT('common');
  const { user, isAuthenticated, isLoading, isDemo } = useAuth();
  const queryClient = useQueryClient();
  const claimMutation = useClaimShareLink();
  const acceptMutation = useAcceptSharedTask();
  const unshareMutation = useUnshareTask();
  const [invite, setInvite] = useState<ClaimShareLinkResult | null>(null);

  useEffect(() => {
    if (isLoading || !isAuthenticated || isDemo) return;
    let token: string | null = null;
    try {
      token = localStorage.getItem(PENDING_INVITE_STORAGE_KEY);
    } catch { return; }
    if (!token) return;
    // Retire le flag AVANT le claim : pas de double-claim sur re-render/reload.
    // C-63 — il est REPOSE si le refus n'est pas nomme (cf. onError) : une
    // panne reseau ne doit pas consommer une invitation.
    try { localStorage.removeItem(PENDING_INVITE_STORAGE_KEY); } catch { /* no-op */ }

    claimMutation.mutate(token, {
      onSuccess: (result) => {
        // L'amitié vient d'être créée côté DB → rafraîchir amis + tâches.
        queryClient.invalidateQueries({ queryKey: friendKeys.all });
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
        if (result.already_accepted) {
          toast.info(t('shareInvite.alreadyCollab', { name: result.task_name }));
          return;
        }
        setInvite(result);
      },
      // C-63 — on branche sur le CODE, jamais sur le texte du message. Une
      // panne reseau ou un 500 de PostgREST ne contient aucun identifiant :
      // l'ancien tri par texte les faisait tomber dans « ce lien est
      // invalide », une affirmation definitive et fausse sur le chemin
      // d'acquisition, apres laquelle personne ne reessaie.
      onError: (error: Error) => {
        const code = error instanceof ApiError ? error.code : '';
        if (code === 'own_link') {
          toast.info(t('shareInvite.ownLink'));
        } else if (code === 'expired_link') {
          toast.error(t('shareInvite.expired'));
        } else if (code === 'invalid_link') {
          toast.error(t('shareInvite.invalid'));
        } else {
          // Refus NON nomme : on ne sait pas si le lien est mauvais. On le dit,
          // et on REPOSE le jeton pour que le prochain montage reessaie —
          // sinon une coupure reseau consomme l'invitation pour de bon.
          toast.error(t('shareInvite.unverified'));
          try { localStorage.setItem(PENDING_INVITE_STORAGE_KEY, token); } catch { /* no-op */ }
        }
      },
    });
    // claimMutation/queryClient stables (React Query) — on ne déclenche que
    // sur changement d'état d'auth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading, isDemo]);

  const closeAfter = () => setInvite(null);
  const sheetMotion = useSheetMotion();
  // Meme correction que les cinq feuilles de l'audit 2026-08-14 : la
  // poignee affichee plus bas ne declenchait aucun geste.
  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(closeAfter);

  const handleAccept = () => {
    if (!invite) return;
    acceptMutation.mutate(invite.task_id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
        toast.success(t('shareInvite.accepted', { name: invite.task_name }));
        closeAfter();
      },
    });
  };

  const handleRefuse = () => {
    if (!invite || !user?.id) return;
    unshareMutation.mutate(
      { taskId: invite.task_id, friendId: user.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
          toast.success(t('shareInvite.refused'));
          closeAfter();
        },
      }
    );
  };

  const busy = acceptMutation.isPending || unshareMutation.isPending;

  return (
    <AnimatePresence>
      {invite && (
        <motion.div
          className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center sm:p-4 pointer-events-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-invite-title"
        >
          {/* Backdrop — fermer = décider plus tard (la tâche reste dans l'inbox) */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-md"
            onClick={closeAfter}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            ref={sheetRef}
            {...sheetDragProps}
            className="relative w-full sm:max-w-md bg-[rgb(var(--color-surface))] rounded-t-[28px] sm:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl overflow-hidden flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            {...sheetMotion}
          >
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <motion.div className="h-[5px] rounded-full bg-[rgb(var(--color-border-strong))]" style={{ width: handleBarWidth }} />
            </div>

            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                {isImageAvatar(invite.owner_avatar) ? (
                  <img src={invite.owner_avatar ?? undefined} alt="" className="w-full h-full object-cover" />
                ) : isEmojiAvatar(invite.owner_avatar) ? (
                  <span className="text-2xl leading-none" aria-hidden="true">{invite.owner_avatar}</span>
                ) : invite.owner_name ? (
                  <span className="text-lg font-bold text-blue-700 dark:text-blue-300" aria-hidden="true">
                    {invite.owner_name.trim().charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <Users size={26} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
                )}
              </div>
              <h2 id="share-invite-title" className="text-lg font-bold text-[rgb(var(--color-text-primary))] mb-1">
                {t('shareInvite.sharedWithYou')}
              </h2>
              <p className="text-sm text-[rgb(var(--color-text-secondary))] mb-6">
                {/* Une phrase entiere : l'ordre « qui / quoi » n'est pas le
                    meme partout, et trois fragments de JSX l'auraient fige. */}
                <RichText>{t('shareInvite.proposes', { name: invite.owner_name, task: invite.task_name })}</RichText>
              </p>

              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <button
                  onClick={handleRefuse}
                  disabled={busy}
                  className="flex-1 min-h-11 px-4 py-2.5 rounded-xl text-sm font-semibold text-[rgb(var(--color-text-secondary))] border border-[rgb(var(--color-border))] hover:border-red-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    <X size={15} aria-hidden="true" /> {t('actions.refuse')}
                  </span>
                </button>
                <button
                  onClick={handleAccept}
                  disabled={busy}
                  className="flex-1 min-h-11 px-4 py-2.5 rounded-xl text-sm font-bold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] transition-colors shadow-md shadow-blue-500/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                    {t('shareInvite.accept')}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShareInviteClaimer;
