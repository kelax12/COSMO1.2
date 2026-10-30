import { Suspense, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Contact, Hash, Link2, Loader2, Mail, X, type LucideIcon } from 'lucide-react';
import type { Organization } from '@/modules/organizations';
import { useInviteByEmail } from '@/modules/organizations/governance.hooks';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { useT } from '@/i18n/useT';

// Même règle que dans `OrgInviteSection` : pas de catalogue demandé ici,
// ceux de l'espace entreprise sont déclarés par la ROUTE.
const OrgJoinCodeCard = lazyWithRetry(() => import('@/components/organization/OrgJoinCodeCard'));
const OrgInviteLinkCard = lazyWithRetry(() => import('@/components/organization/OrgInviteLinkCard'));
const InviteFriendsToOrg = lazyWithRetry(() => import('@/components/organization/InviteFriendsToOrg'));

type Mode = 'email' | 'code' | 'link' | 'contacts';

interface InviteModeDialogProps {
  org: Organization;
  currentUserId?: string;
  isAdmin: boolean;
  canInvite: boolean;
  seatsFull: boolean;
  /** Absent : l'invitation par e-mail n'est pas ouverte à ce membre (mig. 161). */
  onChooseEmail?: (emails: string) => void;
  onClose: () => void;
}

/**
 * Un seul bouton « Inviter » sur la page Personnes (maquette 2 du 2026-09-28) :
 * les quatre canaux en onglets segmentés, un seul affiché en grand. Chaque
 * onglet n'apparaît qu'à qui a le droit correspondant, avec les mêmes règles
 * que la rubrique Inviter de Paramètres (`OrgInviteSection`).
 */
const InviteModeDialog = ({ org, isAdmin, canInvite, seatsFull, onChooseEmail, onClose }: InviteModeDialogProps) => {
  const { t } = useT('org');
  const { t: tOrgAdmin } = useT('orgAdmin');
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({ open: true, onClose, label: tOrgAdmin('settings.inviteTitle') });
  // Une adresse à la fois, envoyée d'ici : le résultat s'affiche sous le champ
  // et le champ se vide, prêt pour la suivante.
  const invite = useInviteByEmail(org.id);
  const [email, setEmail] = useState('');
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);

  const sendInvite = () => {
    const address = email.trim().toLowerCase();
    if (!address || invite.isPending || seatsFull) return;
    // Personne n'est placé sous un supérieur (mig. 229).
    invite.mutate(
      { emails: [address], managerId: null },
      {
        onSuccess: ({ results, sending }) => {
          const r = results[0];
          if (!r || r.status === 'invalid') { setOutcome({ ok: false, text: tOrgAdmin('invites.statusInvalid') }); return; }
          if (r.status === 'already_member') { setOutcome({ ok: false, text: tOrgAdmin('invites.statusAlreadyMember') }); return; }
          if (r.status === 'already_invited') { setOutcome({ ok: false, text: tOrgAdmin('invites.statusAlreadyInvited') }); return; }
          const text = sending.unavailable
            ? tOrgAdmin('invites.statusCreatedNotSent')
            : sending.failed > 0 ? tOrgAdmin('invites.statusCreatedMaybe') : tOrgAdmin('invites.statusSentTo', { email: address });
          setOutcome({ ok: !sending.unavailable && sending.failed === 0, text });
          setEmail('');
        },
        onError: () => setOutcome({ ok: false, text: tOrgAdmin('invites.statusFailed') }),
      },
    );
  };

  const modes: { id: Mode; icon: LucideIcon; label: string }[] = [
    ...(onChooseEmail ? [{ id: 'email' as const, icon: Mail, label: tOrgAdmin('settings.tabEmail') }] : []),
    { id: 'code', icon: Hash, label: tOrgAdmin('settings.tabCode') },
    ...(canInvite ? [{ id: 'link' as const, icon: Link2, label: tOrgAdmin('settings.tabLink') }] : []),
    ...(isAdmin ? [{ id: 'contacts' as const, icon: Contact, label: tOrgAdmin('settings.tabContacts') }] : []),
  ];
  const [mode, setMode] = useState<Mode>(modes[0].id);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={ref}
        {...dialogProps}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-[28px] sm:rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] shadow-2xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">{tOrgAdmin('settings.inviteTitle')}</h2>
            <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-1">{tOrgAdmin('settings.inviteHint')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div
          role="tablist"
          aria-label={tOrgAdmin('settings.inviteTitle')}
          className="grid gap-1 p-1 rounded-xl bg-[rgb(var(--color-hover))]"
          style={{ gridTemplateColumns: `repeat(${modes.length}, minmax(0, 1fr))` }}
        >
          {modes.map(({ id, icon: Icon, label }) => {
            const on = mode === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`invite-tab-${id}`}
                data-guide-id={`invite-mode-${id}`}
                aria-selected={on}
                aria-controls="invite-panel"
                onClick={() => setMode(id)}
                className={`flex flex-col items-center gap-1 min-h-14 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  on
                    ? 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))] shadow-sm'
                    : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]'
                }`}
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>

        <div id="invite-panel" role="tabpanel" aria-labelledby={`invite-tab-${mode}`}>
          {mode === 'email' && onChooseEmail && (
            <form
              className="space-y-3"
              onSubmit={(e) => { e.preventDefault(); sendInvite(); }}
            >
              <label htmlFor="invite-mode-emails" className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))]">
                {tOrgAdmin('invites.emailTitle')}
              </label>
              <div className="flex gap-2">
                <input
                  id="invite-mode-emails"
                  data-guide-id="invite-email-addresses"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setOutcome(null); }}
                  placeholder={t('invite.emailPlaceholder')}
                  aria-describedby="invite-mode-status"
                  className="flex-1 min-w-0 min-h-11 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={seatsFull || invite.isPending || !email.trim()}
                  className="shrink-0 min-h-11 px-4 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-50"
                >
                  {invite.isPending ? tOrgAdmin('invites.sending') : t('invite.emailSubmit')}
                </button>
              </div>
              <p id="invite-mode-status" role="status" aria-live="polite" className="min-h-5 text-sm">
                {invite.isPending ? (
                  <span className="inline-flex items-center gap-1.5 text-[rgb(var(--color-text-secondary))]">
                    <Loader2 size={14} aria-hidden="true" className="motion-safe:animate-spin" /> {tOrgAdmin('invites.sending')}
                  </span>
                ) : outcome ? (
                  <span className={`inline-flex items-start gap-1.5 ${outcome.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {outcome.ok ? <CheckCircle2 size={15} aria-hidden="true" className="shrink-0 mt-0.5" /> : <AlertCircle size={15} aria-hidden="true" className="shrink-0 mt-0.5" />}
                    {outcome.text}
                  </span>
                ) : null}
              </p>
              <p data-guide-id="invite-email-intro" className="text-xs text-[rgb(var(--color-text-muted))]">{tOrgAdmin('invites.emailIntro')}</p>
            </form>
          )}
          <Suspense fallback={null}>
            {mode !== 'email' && (
              <div className="rounded-2xl border border-[rgb(var(--color-border))]">
                {mode === 'code' && <OrgJoinCodeCard code={org.joinCode ?? ''} orgId={org.id} isAdmin={isAdmin} seatsFull={seatsFull} />}
                {mode === 'link' && <OrgInviteLinkCard orgId={org.id} seatsFull={seatsFull} />}
                {mode === 'contacts' && (
                  <div className="p-4">
                    <InviteFriendsToOrg orgId={org.id} variant="inline" />
                  </div>
                )}
              </div>
            )}
          </Suspense>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default InviteModeDialog;
