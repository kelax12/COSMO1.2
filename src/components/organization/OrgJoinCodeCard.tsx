import { useState } from 'react';
import { Copy, Check, Hash, RefreshCw } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useRegenerateJoinCode } from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import OrgConfirmDialog from './OrgConfirmDialog';
import { INVITE_ICON_BTN, INVITE_ROW } from './invite-ui';

interface OrgJoinCodeCardProps {
  code: string;
  orgId: string;
  /** Quota atteint : une demande faite avec ce code serait refusée à l'acceptation. */
  seatsFull?: boolean;
  /** Admin : peut régénérer le code (invalide l'ancien). */
  isAdmin?: boolean;
}

/**
 * Ligne « Code d'invitation » de la rubrique Inviter : visible par tous les
 * membres, copiable. Le code circule pour inviter ; l'admin valide chaque
 * demande (pattern inbox, et la liste « En attente » juste en dessous).
 */
const OrgJoinCodeCard = ({ code, orgId, isAdmin = false, seatsFull = false }: OrgJoinCodeCardProps) => {
  const { t } = useT('org');
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const regenerateMutation = useRegenerateJoinCode();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(t('createJoin.codeCopied'));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t('createJoin.copyFailed'));
    }
  };

  // Niveau LOURD (cf. OrgConfirmDialog) : l'ancien code meurt, on le dit avant.
  const regenerate = () =>
    regenerateMutation.mutate(orgId, { onSettled: () => setConfirming(false) });

  return (
    <div className={INVITE_ROW}>
      <Hash size={18} aria-hidden="true" className="text-[rgb(var(--color-text-muted))] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-[rgb(var(--color-text-primary))]">
          {t('invite.codeTitle')}
          <code className="text-xs font-bold tracking-widest px-1.5 py-0.5 rounded-md bg-[rgb(var(--color-hover))]">{code}</code>
        </p>
        <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">{t('invite.codeRowHint')}</p>
        {seatsFull && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1" role="status">{t('invite.seatsFullCode')}</p>
        )}
      </div>
      <button type="button" onClick={copy} className={INVITE_ICON_BTN} aria-label={t('invite.copyCodeAria')}>
        {copied ? <Check size={16} className="text-green-500" aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      </button>
      {isAdmin && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={regenerateMutation.isPending}
          className={INVITE_ICON_BTN}
          aria-label={t('invite.regenerateAria')}
          title={t('invite.regenerate')}
        >
          <RefreshCw size={16} className={regenerateMutation.isPending ? 'animate-spin' : ''} aria-hidden="true" />
        </button>
      )}
      {confirming && (
        <OrgConfirmDialog
          title={t('invite.regenerate')}
          impact={[t('invite.regenerateImpactOld'), t('invite.regenerateImpactShared')]}
          confirmLabel={t('invite.regenerate')}
          tone="warning"
          pending={regenerateMutation.isPending}
          onConfirm={regenerate}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
};

export default OrgJoinCodeCard;
