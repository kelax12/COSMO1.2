import { useState } from 'react';
import { Copy, Check, RefreshCw } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useRegenerateJoinCode } from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import OrgConfirmDialog from './OrgConfirmDialog';

interface OrgJoinCodeCardProps {
  code: string;
  orgId: string;
  /** Quota atteint : une demande faite avec ce code serait refusée à l'acceptation. */
  seatsFull?: boolean;
  /** Admin : peut régénérer le code (invalide l'ancien). */
  isAdmin?: boolean;
}

/**
 * Carte « Code d'invitation » — visible par tous les membres, copiable.
 * Le code circule pour inviter ; l'admin valide chaque demande (pattern inbox).
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
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">{t('invite.codeTitle')}</h3>
      <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">
        {t('invite.codeHint')}
      </p>
      {seatsFull && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-3" role="status">
          {t('invite.seatsFullCode')}
        </p>
      )}
      <div className="flex items-center gap-2">
        <code className="flex-1 text-base font-bold tracking-widest px-3 py-2.5 rounded-xl bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] text-center">
          {code}
        </code>
        <button
          type="button"
          onClick={copy}
          className="w-11 h-11 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] hover:bg-[rgb(var(--color-border))] flex items-center justify-center text-[rgb(var(--color-text-secondary))] transition-colors"
          aria-label={t('invite.copyCodeAria')}
        >
          {copied ? <Check size={18} className="text-green-500" aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={regenerateMutation.isPending}
            className="w-11 h-11 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] hover:bg-[rgb(var(--color-border))] hover:text-amber-500 flex items-center justify-center text-[rgb(var(--color-text-secondary))] transition-colors disabled:opacity-50"
            aria-label={t('invite.regenerateAria')}
            title={t('invite.regenerate')}
          >
            <RefreshCw size={18} className={regenerateMutation.isPending ? 'animate-spin' : ''} aria-hidden="true" />
          </button>
        )}
      </div>
      {confirming && (
        <OrgConfirmDialog
          title={t('invite.regenerateTitle')}
          impact={[t('invite.regenerateImpactOld'), t('invite.regenerateImpactShared'), t('invite.regenerateImpactPending')]}
          confirmLabel={t('invite.regenerateAction')}
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
