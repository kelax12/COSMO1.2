import { ExternalLink, Receipt } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { formatCurrency, formatDate } from '@/i18n/format';
import type { KeyOf } from '@/i18n/catalog';
import { useOrgBillingHistory } from '@/modules/billing/org-billing.hooks';
import type { OrgBillingHistoryEntry } from '@/modules/billing/org-billing.types';

interface Props {
  orgId: string;
}

/** Libellé d'une ligne du journal. Un type inconnu reste lisible, jamais masqué. */
const EVENT_KEYS: Record<string, KeyOf<'org'>> = {
  'invoice.payment_succeeded': 'billing.historyPaid',
  'invoice.payment_failed': 'billing.historyFailed',
  'charge.refunded': 'billing.historyRefund',
};

/**
 * Historique des factures, lu dans le journal fiscal (`get_org_billing_history`,
 * mig. 180). Propriétaire seul : l'appelant ne monte ce bloc que pour lui.
 *
 * ⚠️ Le montant est celui du JOURNAL, en centimes, négatif pour un
 * remboursement : rien n'est recalculé ici. Un échec de paiement affiche le
 * montant DÛ, barré, parce que rien n'a été encaissé.
 */
export function OrgBillingHistory({ orgId }: Props) {
  const { t } = useT('org');
  const { data: entries = [], isLoading, isError } = useOrgBillingHistory(orgId, true);

  const amount = (e: OrgBillingHistoryEntry) =>
    formatCurrency(e.amountCents / 100, undefined, { currency: e.currency.toUpperCase() });

  return (
    <section
      aria-labelledby="org-billing-history"
      className="rounded-xl border border-[rgb(var(--color-border))] p-4 flex flex-col gap-3"
    >
      <h3 id="org-billing-history" className="flex items-center gap-2 text-sm font-semibold text-[rgb(var(--color-text-primary))]">
        <Receipt size={15} aria-hidden="true" />
        {t('billing.historyTitle')}
      </h3>

      {isLoading ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('billing.historyLoading')}</p>
      ) : isError ? (
        <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('billing.historyError')}</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('billing.historyEmpty')}</p>
      ) : (
        <ul className="divide-y divide-[rgb(var(--color-border))]">
          {entries.map((e) => {
            const failed = e.eventType === 'invoice.payment_failed';
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[rgb(var(--color-text-primary))]">
                    {t(EVENT_KEYS[e.eventType] ?? 'billing.historyOther')}
                    {e.invoiceNumber && (
                      <span className="text-[rgb(var(--color-text-muted))]"> · {e.invoiceNumber}</span>
                    )}
                  </p>
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">
                    {formatDate(new Date(e.occurredAt))}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    failed
                      ? 'line-through text-[rgb(var(--color-text-muted))]'
                      : 'text-[rgb(var(--color-text-primary))]'
                  }`}
                >
                  {amount(e)}
                </span>
                {/* Seul un lien https part d'ici : la valeur vient du journal, écrit par
                    le webhook, mais un `javascript:` n'a rien à faire dans un href. */}
                {e.hostedInvoiceUrl?.startsWith('https://') && (
                  <a
                    href={e.hostedInvoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[rgb(var(--color-accent))] hover:underline"
                  >
                    {t('billing.historyInvoice')} <ExternalLink size={12} aria-hidden="true" />
                    <span className="sr-only">{t('billing.historyNewTab')}</span>
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default OrgBillingHistory;
