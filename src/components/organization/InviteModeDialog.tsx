import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { ChevronRight, Mail, UserPlus, X } from 'lucide-react';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { orgSectionPath } from './deep-link.helpers';
import { useT } from '@/i18n/useT';

interface InviteModeDialogProps {
  /** Absent : l'invitation par e-mail n'est pas ouverte à ce membre (mig. 161). */
  onChooseEmail?: () => void;
  emailDisabled?: boolean;
  onClose: () => void;
}

const OPTION =
  'w-full flex items-center gap-3 p-4 rounded-xl border border-[rgb(var(--color-border))] text-left hover:bg-[rgb(var(--color-hover))] transition-colors disabled:opacity-50 disabled:pointer-events-none';
const OPTION_ICON =
  'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-[rgb(var(--color-accent)/0.12)] text-[rgb(var(--color-accent))]';

/**
 * Un seul bouton « Inviter » sur la page Personnes : cette modale demande le
 * canal. E-mail ouvre `InviteByEmailDialog` ; code, lien direct et contacts
 * COSMO vivent dans Paramètres, lisibles par chaque membre.
 */
const InviteModeDialog = ({ onChooseEmail, emailDisabled, onClose }: InviteModeDialogProps) => {
  const { t } = useT('org');
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({ open: true, onClose, label: t('settings.inviteTitle') });

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={ref}
        {...dialogProps}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-[28px] sm:rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] shadow-2xl p-5 space-y-4"
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

        <div className="space-y-2">
          {onChooseEmail && (
            <button type="button" onClick={onChooseEmail} disabled={emailDisabled} className={OPTION}>
              <span className={OPTION_ICON}><Mail size={18} aria-hidden="true" /></span>
              <span className="flex-1 min-w-0 text-sm font-semibold text-[rgb(var(--color-text-primary))]">
                {t('settings.inviteByEmail')}
              </span>
              <ChevronRight size={16} aria-hidden="true" className="text-[rgb(var(--color-text-muted))]" />
            </button>
          )}
          <Link to={orgSectionPath('settings')} onClick={onClose} className={OPTION}>
            <span className={OPTION_ICON}><UserPlus size={18} aria-hidden="true" /></span>
            <span className="flex-1 min-w-0 text-sm font-semibold text-[rgb(var(--color-text-primary))]">
              {t('settings.otherInvites')}
            </span>
            <ChevronRight size={16} aria-hidden="true" className="text-[rgb(var(--color-text-muted))]" />
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default InviteModeDialog;
