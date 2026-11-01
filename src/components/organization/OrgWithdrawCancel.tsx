import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { useT } from '@/i18n/useT';
import { formatDate } from '@/i18n/format';
import { orgBillingKeys } from '@/modules/billing/org-billing.hooks';
import {
  useOrgSubscriptionAction,
  useWithdrawalPreview,
  type OrgSubscriptionAction,
} from '@/modules/billing/org-billing.mutations';
import type { OrgSubscription } from '@/modules/billing/org-billing.types';
import { ORG_TIER_LABEL_KEYS } from '@/modules/billing/org-tier-labels';
import { useAuth } from '@/modules/auth/AuthContext';
import { withdrawalOpen } from '@/modules/billing/withdrawal-window';

interface Props {
  orgId: string;
  subscription: OrgSubscription;
}

/**
 * Rétractation et résiliation (REMBOURSEMENT-RESILIATION.md, 2026-11-01).
 *
 * - « Se rétracter du contrat ici » (L221-21) : visible pendant les 14 jours
 *   suivant la conclusion, puis masqué. Ouvre un récapitulatif prérempli, puis
 *   un second bouton « Confirmer la rétractation ». Arrêt immédiat ; le
 *   remboursement est fait à la main par l'équipe.
 * - « Résilier mon abonnement » (L215-1-1) : une seule page de confirmation, un
 *   seul bouton, aucune case ni questionnaire. Arrêt en fin de période, ❌
 *   jamais de remboursement. Annulable tant que la période court.
 *
 * Les confirmations sont des panneaux en ligne, pas des modales : « une seule
 * page de confirmation », sans piège de focus à câbler.
 */
export function OrgWithdrawCancel({ orgId, subscription }: Props) {
  const { t } = useT('orgAdmin');
  const { t: tc } = useT('common');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'idle' | 'withdraw' | 'cancel'>('idle');

  const canWithdraw = withdrawalOpen(subscription.startedAt);
  const preview = useWithdrawalPreview(orgId, canWithdraw && step === 'withdraw');
  const planName = tc(ORG_TIER_LABEL_KEYS[subscription.tierKey]);
  const periodEnd = subscription.currentPeriodEnd ? formatDate(new Date(subscription.currentPeriodEnd)) : '';

  const action = useOrgSubscriptionAction((done: OrgSubscriptionAction) => {
    setStep('idle');
    // L'abonnement est RELU : l'écran doit dire ce qui vient de se passer sans
    // rechargement, et ne plus offrir le bouton qu'on vient d'utiliser.
    void queryClient.invalidateQueries({ queryKey: orgBillingKeys.subscription(orgId) });
    if (done === 'withdraw') toast.success(t('billing.withdrawDone'));
    if (done === 'cancel') toast.success(t('billing.cancelScheduled', { date: periodEnd }));
    if (done === 'resume') toast.success(t('billing.resumeDone'));
  });

  const amount = preview.data ? (preview.data.amountCents / 100).toFixed(2).replace('.', ',') : null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-[rgb(var(--color-border))] p-3">
      {subscription.cancelAtPeriodEnd ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[rgb(var(--color-text-primary))]">
            {t('billing.cancelPending', { date: periodEnd })}
          </p>
          <button
            type="button"
            disabled={action.isPending}
            onClick={() => action.mutate({ orgId, action: 'resume' })}
            className="self-start rounded-lg border border-[rgb(var(--color-border))] px-3 py-2 text-sm disabled:opacity-60"
          >
            {t('billing.resumeCta')}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {canWithdraw && (
            <button
              type="button"
              onClick={() => setStep('withdraw')}
              className="rounded-lg border border-[rgb(var(--color-text-primary))] px-3 py-2 text-sm font-semibold"
            >
              {t('billing.withdrawCta')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setStep('cancel')}
            className="rounded-lg border border-[rgb(var(--color-border))] px-3 py-2 text-sm"
          >
            {t('billing.cancelCta')}
          </button>
        </div>
      )}

      {canWithdraw && !subscription.cancelAtPeriodEnd && (
        <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('billing.withdrawVsCancel')}</p>
      )}

      {step === 'withdraw' && canWithdraw && (
        <div role="region" aria-label={t('billing.withdrawTitle')} className="flex flex-col gap-2 rounded-lg border border-[rgb(var(--color-border))] p-3">
          <h3 className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('billing.withdrawTitle')}</h3>
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-[rgb(var(--color-text-secondary))]">{t('billing.recapName')}</dt>
            <dd>{user?.name ?? ''}</dd>
            <dt className="text-[rgb(var(--color-text-secondary))]">{t('billing.recapEmail')}</dt>
            <dd>{preview.data?.recipient || user?.email || ''}</dd>
            <dt className="text-[rgb(var(--color-text-secondary))]">{t('billing.recapPlan')}</dt>
            <dd>{planName}</dd>
            <dt className="text-[rgb(var(--color-text-secondary))]">{t('billing.recapAmount')}</dt>
            <dd>{amount === null ? '…' : `${amount} €`}</dd>
          </dl>
          <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('billing.withdrawExplain')}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={action.isPending || !preview.data}
              onClick={() => action.mutate({ orgId, action: 'withdraw' })}
              className="rounded-lg border-2 border-[rgb(var(--color-text-primary))] px-3 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {t('billing.withdrawConfirm')}
            </button>
            <button type="button" onClick={() => setStep('idle')} className="px-3 py-2 text-sm">
              {t('billing.back')}
            </button>
          </div>
        </div>
      )}

      {step === 'cancel' && !subscription.cancelAtPeriodEnd && (
        <div role="region" aria-label={t('billing.cancelTitle')} className="flex flex-col gap-2 rounded-lg border border-[rgb(var(--color-border))] p-3">
          <h3 className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('billing.cancelTitle')}</h3>
          <p className="text-sm">{t('billing.cancelRecap', { plan: planName, date: periodEnd })}</p>
          <p className="text-sm font-semibold">{t('billing.cancelNoRefund')}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={action.isPending}
              onClick={() => action.mutate({ orgId, action: 'cancel' })}
              className="rounded-lg border-2 border-[rgb(var(--color-text-primary))] px-3 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {t('billing.cancelConfirm')}
            </button>
            <button type="button" onClick={() => setStep('idle')} className="px-3 py-2 text-sm">
              {t('billing.back')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
