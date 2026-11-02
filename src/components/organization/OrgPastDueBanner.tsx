import { CreditCard } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { formatDate } from '@/i18n/format';
import { useOrgBillingHistory } from '@/modules/billing/org-billing-account.hooks';
import { useOpenOrgPortal } from '@/modules/billing/org-billing.mutations';
import { lastFailedPaymentAt } from '@/modules/billing/org-billing.logic';

interface Props {
  orgId: string;
  memberCount: number;
}

/**
 * Impayé (spec 2026-11-02 § 5.2), en tête de TOUT l'espace entreprise, pour
 * le propriétaire seul. Monté en `lazy` par `OrganizationPage` et seulement
 * quand l'abonnement est `past_due` : son code ne pèse pas dans le chunk de la
 * page. Aucune date de nouvelle tentative : elle n'est pas lue (v1).
 * `role="status"` n'enveloppe que le texte, jamais le bouton.
 */
export function OrgPastDueBanner({ orgId, memberCount }: Props) {
  const { t } = useT('orgAdmin');
  const { data: history = [] } = useOrgBillingHistory(orgId, true);
  const portal = useOpenOrgPortal();
  const failedAt = lastFailedPaymentAt(history);

  return (
    <div className="mb-5 flex flex-wrap items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700/60 dark:bg-amber-900/20">
      <CreditCard size={18} aria-hidden className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" />
      <div role="status" className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {failedAt ? t('billing.pastDueTitle', { date: formatDate(new Date(failedAt)) }) : t('billing.pastDueTitleNoDate')}
        </p>
        <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">{t('billing.pastDueBody', { count: memberCount })}</p>
      </div>
      <button
        type="button"
        disabled={portal.isPending}
        onClick={() => portal.mutate({ orgId })}
        className="shrink-0 rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-semibold text-amber-800 disabled:opacity-60 dark:border-amber-700 dark:bg-transparent dark:text-amber-300"
      >
        {t('billing.pastDueCta')}
      </button>
    </div>
  );
}

export default OrgPastDueBanner;
