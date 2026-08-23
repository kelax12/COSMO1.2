// ═══════════════════════════════════════════════════════════════════
// InviteOrJoinModal — le « + » de la barre de navigation
// ═══════════════════════════════════════════════════════════════════
//
// Deux colonnes, deux directions opposées du même geste social :
//
//   • GAUCHE  — je fais venir quelqu'un. Ajouter un contact COSMO par email,
//               et/ou inviter un contact existant dans mon entreprise.
//   • DROITE  — j'entre quelque part. Rejoindre une entreprise avec son code.
//
// Le bouton est monté que l'utilisateur appartienne ou non à une organisation
// (c'est la demande explicite) : sans org, la colonne « inviter dans mon
// entreprise » explique simplement qu'il n'y a rien à rejoindre encore, la
// colonne de droite reste pleinement utilisable.
//
// Sur mobile, les deux colonnes s'empilent — l'ordre reste inviter puis
// rejoindre.

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Building2, Check, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/AuthContext';
import { useIsDemo } from '@/lib/app-mode.store';
import { useFriends, useSendFriendRequest, useSentFriendRequests } from '@/modules/friends';
import {
  useActiveOrganization,
  useRequestJoinOrganization,
  useMySentJoinRequest,
  useCancelJoinRequest,
  useInviteFriendToOrg,
} from '@/modules/organizations';
import OrgConsentNotice from './OrgConsentNotice';
import { useT } from '@/i18n/useT';

interface InviteOrJoinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const inputClasses =
  'w-full bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] rounded-xl px-4 py-3 text-sm text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]/40 transition-all';

const primaryBtn =
  'w-full py-3 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-50 transition-all inline-flex items-center justify-center gap-2';

const columnClasses =
  'flex flex-col gap-4 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-5';

const InviteOrJoinModal: React.FC<InviteOrJoinModalProps> = ({ open, onOpenChange }) => {
  const { t, tp } = useT('org');
  const { user } = useAuth();
  const isDemo = useIsDemo();
  const { activeOrg } = useActiveOrganization();

  const { data: friends = [] } = useFriends();
  const { data: sentRequests = [] } = useSentFriendRequests();
  const sendFriendMutation = useSendFriendRequest();
  const inviteToOrgMutation = useInviteFriendToOrg();

  const { data: sentJoinRequest } = useMySentJoinRequest();
  const requestJoinMutation = useRequestJoinOrganization();
  const cancelJoinMutation = useCancelJoinRequest();

  const [friendEmail, setFriendEmail] = useState('');
  const [code, setCode] = useState('');
  const [consent, setConsent] = useState(false);

  const close = () => onOpenChange(false);

  const handleAddFriend = () => {
    const email = friendEmail.trim().toLowerCase();
    if (!email) return;
    if (email === user?.email?.toLowerCase()) {
      toast.error(t('inviteJoin.cannotInviteSelf'));
      return;
    }
    sendFriendMutation.mutate({ email }, { onSuccess: () => setFriendEmail('') });
  };

  const handleJoin = () => {
    requestJoinMutation.mutate(code.trim(), { onSuccess: () => setCode('') });
  };

  // Contacts invitables : ceux dont on connaît l'auth.uid (obligatoire pour la
  // RPC) et qui ne sont pas déjà dans l'organisation active. On ne dispose pas
  // ici de la liste des membres — la RPC refuse proprement un doublon avec
  // `already_a_member`, et le message est déjà traduit par normalizeApiError.
  const invitableFriends = friends.filter((f) => !!f.userId);

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        onClick={close}
        role="presentation"
      >
        <motion.div
          // La position vient du CSS (flex centering), l'animation ne porte
          // que sur l'opacité et l'échelle — sous prefers-reduced-motion la
          // valeur `initial` reste appliquée, un décalage en `y` laisserait la
          // modale hors écran (cf. garde-fou animations, CLAUDE.md).
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={t('inviteJoin.title')}
          className="w-full max-w-3xl my-auto rounded-3xl bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] shadow-2xl overflow-hidden"
        >
          {/* En-tête */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[rgb(var(--color-border))]">
            <h2 className="text-base sm:text-lg font-bold text-[rgb(var(--color-text-primary))]">
              {t('inviteJoin.title')}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={t('inviteJoin.close')}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 sm:p-6">
            {/* ─── Colonne 1 : inviter ─────────────────────────────── */}
            <section className={columnClasses} aria-labelledby="invite-col-title">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <UserPlus size={18} className="text-blue-500" aria-hidden="true" />
                </div>
                <h3 id="invite-col-title" className="text-sm font-bold text-[rgb(var(--color-text-primary))]">
                  {t('inviteJoin.inviteColTitle')}
                </h3>
              </div>

              {/* Ajouter un contact COSMO par email */}
              <div className="space-y-2">
                <label htmlFor="invite-friend-email" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))]">
                  {t('inviteJoin.addByEmail')}
                </label>
                <input
                  id="invite-friend-email"
                  type="email"
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
                  placeholder={t('inviteJoin.emailPlaceholder')}
                  className={inputClasses}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={handleAddFriend}
                  disabled={!friendEmail.trim() || sendFriendMutation.isPending}
                  className={primaryBtn}
                >
                  {sendFriendMutation.isPending
                    ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    : <Send size={16} aria-hidden="true" />}
                  {sendFriendMutation.isPending ? t('inviteJoin.sending') : t('inviteJoin.sendRequest')}
                </button>
                {sentRequests.length > 0 && (
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">
                    {tp('inviteJoin.pendingSent', sentRequests.length)}
                  </p>
                )}
              </div>

              {/* Inviter un contact existant dans mon entreprise */}
              <div className="pt-1 border-t border-[rgb(var(--color-border))] space-y-2">
                <p className="text-xs font-medium text-[rgb(var(--color-text-secondary))] pt-3">
                  {t('inviteJoin.inviteToOrg')}
                </p>

                {!activeOrg ? (
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">
                    {t('inviteJoin.noOrgYet')}
                  </p>
                ) : isDemo ? (
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">
                    {t('inviteJoin.demoNotice')}
                  </p>
                ) : invitableFriends.length === 0 ? (
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">
                    {t('inviteJoin.noFriendYet')}
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-[rgb(var(--color-text-muted))]">
                      {t('inviteJoin.inviteHint')}
                    </p>
                    <ul className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
                      {invitableFriends.map((friend) => (
                        <li key={friend.id}>
                          <div className="flex items-center gap-2.5 rounded-xl border border-[rgb(var(--color-border))] px-3 py-2">
                            <span className="w-7 h-7 rounded-full bg-[rgb(var(--color-hover))] flex items-center justify-center text-xs font-semibold text-[rgb(var(--color-text-secondary))] shrink-0 overflow-hidden">
                              {friend.avatar
                                ? <img src={friend.avatar} alt="" className="w-full h-full object-cover" />
                                : friend.name.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="flex-1 min-w-0 text-xs text-[rgb(var(--color-text-primary))] truncate">
                              {friend.name}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                inviteToOrgMutation.mutate({
                                  orgId: activeOrg.id,
                                  friendUserId: friend.userId as string,
                                })
                              }
                              disabled={inviteToOrgMutation.isPending}
                              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-50 transition-colors shrink-0"
                            >
                              {t('inviteJoin.inviteCta')}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </section>

            {/* ─── Colonne 2 : rejoindre ───────────────────────────── */}
            <section className={columnClasses} aria-labelledby="join-col-title">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-indigo-500" aria-hidden="true" />
                </div>
                <h3 id="join-col-title" className="text-sm font-bold text-[rgb(var(--color-text-primary))]">
                  {t('inviteJoin.joinColTitle')}
                </h3>
              </div>

              {sentJoinRequest ? (
                <div className="space-y-3">
                  <p className="text-sm text-[rgb(var(--color-text-primary))] font-medium">
                    {t('inviteJoin.requestSent')}
                  </p>
                  <p className="text-xs text-[rgb(var(--color-text-secondary))]">
                    {t('inviteJoin.requestPending')}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      cancelJoinMutation.mutate(sentJoinRequest.id, {
                        onSuccess: () => toast.success(t('inviteJoin.requestCancelled')),
                      })
                    }
                    disabled={cancelJoinMutation.isPending}
                    className="text-xs font-medium text-[rgb(var(--color-text-secondary))] hover:text-red-500 underline underline-offset-2 disabled:opacity-60 transition-colors"
                  >
                    {t('inviteJoin.cancelRequest')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <label htmlFor="join-org-code" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))]">
                    {t('inviteJoin.codeLabel')}
                  </label>
                  <input
                    id="join-org-code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && code.trim() && consent && handleJoin()}
                    placeholder="COSMO-XXXXXXXXXX"
                    // 'COSMO-' + 10 caractères depuis la mig. 083 = 16. Une
                    // valeur plus courte tronquerait un code valide à la saisie.
                    maxLength={16}
                    className={`${inputClasses} tracking-widest font-mono`}
                    autoComplete="off"
                  />
                  <OrgConsentNotice checked={consent} onChange={setConsent} />
                  <button
                    type="button"
                    onClick={handleJoin}
                    disabled={!code.trim() || !consent || requestJoinMutation.isPending}
                    className={primaryBtn}
                  >
                    {requestJoinMutation.isPending
                      ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      : <Check size={16} aria-hidden="true" />}
                    {requestJoinMutation.isPending ? t('inviteJoin.sending') : t('inviteJoin.sendRequest')}
                  </button>
                </div>
              )}
            </section>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};

export default InviteOrJoinModal;
