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
import { isImageAvatar, isEmojiAvatar } from '@/lib/avatar';

/**
 * Monté au niveau App (comme CookieBanner) : dès que l'utilisateur est
 * authentifié (login OU fin d'inscription) et qu'un token d'invitation est en
 * attente (posé par InvitePage dans localStorage), claim le lien via la RPC
 * `claim_share_link` puis affiche la popup Accepter/Refuser de la tâche
 * partagée. Survit aux changements de route — c'est ce qui permet d'afficher
 * la popup « à la fin de l'inscription » sans coupler signup et partage.
 */
const ShareInviteClaimer: React.FC = () => {
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
    try { localStorage.removeItem(PENDING_INVITE_STORAGE_KEY); } catch { /* no-op */ }

    claimMutation.mutate(token, {
      onSuccess: (result) => {
        // L'amitié vient d'être créée côté DB → rafraîchir amis + tâches.
        queryClient.invalidateQueries({ queryKey: friendKeys.all });
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
        if (result.already_accepted) {
          toast.info(`Vous collaborez déjà sur « ${result.task_name} ».`);
          return;
        }
        setInvite(result);
      },
      onError: (error: Error) => {
        const msg = error.message || '';
        if (msg.includes('own_link')) {
          toast.info("Ce lien d'invitation pointe vers votre propre tâche.");
        } else if (msg.includes('expired_link')) {
          toast.error("Ce lien d'invitation a expiré. Demandez-en un nouveau.");
        } else {
          toast.error("Ce lien d'invitation est invalide ou a été révoqué.");
        }
      },
    });
    // claimMutation/queryClient stables (React Query) — on ne déclenche que
    // sur changement d'état d'auth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading, isDemo]);

  const closeAfter = () => setInvite(null);

  const handleAccept = () => {
    if (!invite) return;
    acceptMutation.mutate(invite.task_id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
        toast.success(`Tâche « ${invite.task_name} » acceptée !`);
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
          toast.success('Invitation refusée.');
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
            className="relative w-full sm:max-w-md bg-[rgb(var(--color-surface))] rounded-t-[28px] sm:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl overflow-hidden flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '110%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
          >
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="h-[5px] w-10 rounded-full bg-[rgb(var(--color-border-strong))]" />
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
                Tâche partagée avec vous
              </h2>
              <p className="text-sm text-[rgb(var(--color-text-secondary))] mb-6">
                <span className="font-semibold text-[rgb(var(--color-text-primary))]">{invite.owner_name}</span>
                {' '}vous propose de collaborer sur{' '}
                <span className="font-semibold text-[rgb(var(--color-text-primary))]">« {invite.task_name} »</span>.
              </p>

              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <button
                  onClick={handleRefuse}
                  disabled={busy}
                  className="flex-1 min-h-11 px-4 py-2.5 rounded-xl text-sm font-semibold text-[rgb(var(--color-text-secondary))] border border-[rgb(var(--color-border))] hover:border-red-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    <X size={15} aria-hidden="true" /> Refuser
                  </span>
                </button>
                <button
                  onClick={handleAccept}
                  disabled={busy}
                  className="flex-1 min-h-11 px-4 py-2.5 rounded-xl text-sm font-bold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] transition-colors shadow-md shadow-blue-500/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                    Accepter la tâche
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
