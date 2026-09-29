import { Suspense, useState } from 'react';
import { createPortal } from 'react-dom';
import { Contact, Hash, Link2, Mail, X, type LucideIcon } from 'lucide-react';
import type { Organization } from '@/modules/organizations';
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
const InviteModeDialog = ({ org, currentUserId, isAdmin, canInvite, seatsFull, onChooseEmail, onClose }: InviteModeDialogProps) => {
  const { t } = useT('org');
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({ open: true, onClose, label: t('settings.inviteTitle') });
  const [emails, setEmails] = useState('');

  const modes: { id: Mode; icon: LucideIcon; label: string }[] = [
    ...(onChooseEmail ? [{ id: 'email' as const, icon: Mail, label: t('settings.tabEmail') }] : []),
    { id: 'code', icon: Hash, label: t('settings.tabCode') },
    ...(canInvite ? [{ id: 'link' as const, icon: Link2, label: t('settings.tabLink') }] : []),
    ...(isAdmin ? [{ id: 'contacts' as const, icon: Contact, label: t('settings.tabContacts') }] : []),
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
            <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">{t('settings.inviteTitle')}</h2>
            <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-1">{t('settings.inviteHint')}</p>
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
          aria-label={t('settings.inviteTitle')}
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
              onSubmit={(e) => { e.preventDefault(); onChooseEmail(emails); }}
            >
              <label htmlFor="invite-mode-emails" className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))]">
                {t('invites.emailTitle')}
              </label>
              <textarea
                id="invite-mode-emails"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                rows={3}
                placeholder={t('invite.emailPlaceholder')}
                className="w-full rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2 text-sm text-[rgb(var(--color-text-primary))]"
              />
              <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('invites.emailIntro')}</p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-[rgb(var(--color-text-muted))]">{t('invite.moreOptions')}</span>
                <button
                  type="submit"
                  disabled={seatsFull}
                  className="shrink-0 min-h-11 px-4 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-50"
                >
                  {t('settings.emailContinue')}
                </button>
              </div>
            </form>
          )}
          <Suspense fallback={null}>
            {mode !== 'email' && (
              <div className="rounded-2xl border border-[rgb(var(--color-border))]">
                {mode === 'code' && <OrgJoinCodeCard code={org.joinCode ?? ''} orgId={org.id} isAdmin={isAdmin} seatsFull={seatsFull} />}
                {mode === 'link' && <OrgInviteLinkCard orgId={org.id} managerId={currentUserId} seatsFull={seatsFull} />}
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
