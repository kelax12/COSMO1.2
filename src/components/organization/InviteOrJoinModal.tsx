// ═══════════════════════════════════════════════════════════════════
// InviteOrJoinModal — le « + » de la barre de navigation
// ═══════════════════════════════════════════════════════════════════
//
// Deux colonnes, les deux seules façons d'obtenir une entreprise quand on n'en
// a pas :
//
//   • GAUCHE — j'en crée une. Une fois créée, on enchaîne SUR PLACE avec son
//     code à partager et l'invitation de ses contacts : c'est le seul moment
//     où l'organisation est vide, donc le seul moment où cet enchaînement
//     tombe juste.
//   • DROITE — j'en rejoins une avec son code.
//
// ⚠️ Pourquoi « inviter un ami » N'EST PLUS une colonne autonome ici : ce
// bouton est monté pour tout le monde, y compris pour quelqu'un qui
// n'appartient à aucune organisation. Proposer d'inviter dans une entreprise
// qu'on n'a pas est une impasse. L'invitation vit désormais là où elle a du
// sens — après la création (ci-dessous) et dans l'onglet « Membres »
// (`InviteFriendsToOrg`, même composant).
//
// Sur mobile, les deux colonnes s'empilent — l'ordre reste créer puis
// rejoindre.

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Building2, Check, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCreateOrganization,
  useRequestJoinOrganization,
  useMySentJoinRequest,
  useCancelJoinRequest,
  type Organization,
} from '@/modules/organizations';
import OrgConsentNotice from './OrgConsentNotice';
import InviteFriendsToOrg from './InviteFriendsToOrg';
import { useT } from '@/i18n/useT';

interface InviteOrJoinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const inputClasses =
  'w-full bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] rounded-xl px-4 py-3 text-sm text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]/40 transition-all';

const primaryBtn =
  'w-full py-3 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-40 transition-all inline-flex items-center justify-center gap-2';

const columnClasses =
  'flex flex-col gap-4 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-5';

const InviteOrJoinModal: React.FC<InviteOrJoinModalProps> = ({ open, onOpenChange }) => {
  const { t } = useT('org');

  const createMutation = useCreateOrganization();
  const { data: sentJoinRequest } = useMySentJoinRequest();
  const requestJoinMutation = useRequestJoinOrganization();
  const cancelJoinMutation = useCancelJoinRequest();

  const [orgName, setOrgName] = useState('');
  const [createdOrg, setCreatedOrg] = useState<Organization | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [code, setCode] = useState('');
  const [consent, setConsent] = useState(false);
  // Une demande pending n'empêche pas d'en envoyer une autre vers une autre
  // org (contrainte UNIQUE (org_id, user_id) côté serveur, cf. mig. 065) —
  // ce flag rouvre le formulaire de code par-dessus l'écran d'attente.
  const [joiningAnother, setJoiningAnother] = useState(false);

  const close = () => {
    onOpenChange(false);
    // L'écran « entreprise créée » est un état de PASSAGE : le rouvrir plus
    // tard doit repartir du formulaire, pas rejouer une création déjà faite.
    setCreatedOrg(null);
    setOrgName('');
    setJoiningAnother(false);
  };

  const handleCreate = () => {
    const name = orgName.trim();
    if (name.length < 2) return;
    createMutation.mutate(name, { onSuccess: (org) => setCreatedOrg(org) });
  };

  const copyCode = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCodeCopied(true);
      toast.success(t('createJoin.codeCopied'));
      setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      toast.error(t('createJoin.copyFailed'));
    }
  };

  const handleJoin = () => {
    requestJoinMutation.mutate(code.trim(), {
      onSuccess: () => {
        setCode('');
        setJoiningAnother(false);
      },
    });
  };

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm overflow-y-auto"
        onClick={close}
        role="presentation"
      >
        {/* C-56 — `items-center` ET `overflow-y-auto` sur le MEME element est
            le piege CSS classique : quand l'enfant depasse, le debordement se
            repartit DES DEUX COTES, et la partie qui sort par le haut n'entre
            pas dans `scrollHeight`. `scrollTop` etant borne a zero, aucun geste
            ne la ramene. Mesure a 375x350 (viewport Android clavier ouvert) :
            haut de la carte a -55,8 px, et le defilement l'ELOIGNE encore. Le
            scroll appartient donc au conteneur, le centrage a un enfant
            `min-h-full` — apres correctif, +16 px, atteignable. */}
        <div className="flex min-h-full items-center justify-center p-4">
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

          {createdOrg ? (
            /* ── Entreprise créée : code à partager + invitation des amis ── */
            <div className="p-5 sm:p-6 flex flex-col gap-5">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                  <Building2 size={26} className="text-indigo-500" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">
                  {t('createJoin.orgCreated', { name: createdOrg.name })}
                </h3>
                <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                  {t('createJoin.shareCode')}
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-base font-bold tracking-widest px-4 py-2.5 rounded-xl bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))]">
                    {createdOrg.joinCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => createdOrg.joinCode && copyCode(createdOrg.joinCode)}
                    className="w-11 h-11 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] hover:bg-[rgb(var(--color-border))] flex items-center justify-center text-[rgb(var(--color-text-secondary))] transition-colors"
                    aria-label={t('invite.copyCodeAria')}
                  >
                    {codeCopied
                      ? <Check size={18} className="text-green-500" aria-hidden="true" />
                      : <Copy size={18} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div className="border-t border-[rgb(var(--color-border))] pt-5">
                <InviteFriendsToOrg orgId={createdOrg.id} />
              </div>

              <button type="button" onClick={close} className={primaryBtn}>
                {t('inviteJoin.done')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 sm:p-6">
              {/* ─── Colonne 1 : créer ────────────────────────────────── */}
              <section className={columnClasses} aria-labelledby="create-col-title">
                <h3 id="create-col-title" className="text-sm font-bold text-[rgb(var(--color-text-primary))]">
                  {t('createJoin.createOrg')}
                </h3>

                <p className="text-xs text-[rgb(var(--color-text-muted))]">
                  {t('createJoin.createOrgHint')}
                </p>

                <div className="space-y-3">
                  <label htmlFor="new-org-name" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))]">
                    {t('common.orgNameLabel')}
                  </label>
                  <input
                    id="new-org-name"
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    placeholder="Nova Studio"
                    className={inputClasses}
                    maxLength={80}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={orgName.trim().length < 2 || createMutation.isPending}
                    className={primaryBtn}
                  >
                    {createMutation.isPending
                      ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      : <Building2 size={16} aria-hidden="true" />}
                    {createMutation.isPending ? t('createJoin.creating') : t('createJoin.createCta')}
                  </button>
                </div>
              </section>

              {/* ─── Colonne 2 : rejoindre ────────────────────────────── */}
              <section className={columnClasses} aria-labelledby="join-col-title">
                <h3 id="join-col-title" className="text-sm font-bold text-[rgb(var(--color-text-primary))]">
                  {t('inviteJoin.joinColTitle')}
                </h3>

                {sentJoinRequest && !joiningAnother ? (
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
                    <button
                      type="button"
                      onClick={() => setJoiningAnother(true)}
                      className="block text-xs font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] underline underline-offset-2 transition-colors"
                    >
                      {t('inviteJoin.joinAnother')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sentJoinRequest && (
                      <button
                        type="button"
                        onClick={() => setJoiningAnother(false)}
                        className="text-xs font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] underline underline-offset-2 transition-colors"
                      >
                        {t('inviteJoin.backToPending')}
                      </button>
                    )}
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
          )}
        </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};

export default InviteOrJoinModal;
