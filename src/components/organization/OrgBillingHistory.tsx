import { useT } from '@/i18n/useT';
import { formatCurrency, formatDate } from '@/i18n/format';
import type { KeyOf } from '@/i18n/catalog';
import { Download } from 'lucide-react';
import { useOrgBillingContact, useOrgBillingHistory } from '@/modules/billing/org-billing-account.hooks';
import type { OrgBillingHistoryEntry } from '@/modules/billing/org-billing.types';
import { PILL_BASE, PILL_TONE, type PillTone } from './billing-ui';

interface Props {
  orgId: string;
  /** Destinataire par défaut des factures quand aucun contact n'est enregistré. */
  ownerEmail?: string;
}

/** Libellé d'une ligne du journal. Un type inconnu reste lisible, jamais masqué. */
const EVENT_KEYS: Record<string, KeyOf<'orgAccount'>> = {
  'invoice.payment_succeeded': 'historyPaid',
  'invoice.payment_failed': 'historyFailed',
  'charge.refunded': 'historyRefund',
};

/** Pastille d'état d'une ligne. Un type inconnu prend la pastille neutre « Autre ». */
const PILLS: Record<string, { key: KeyOf<'orgAccount'>; tone: PillTone }> = {
  'invoice.payment_succeeded': { key: 'historyPillPaid', tone: 'success' },
  'invoice.payment_failed': { key: 'historyPillFailed', tone: 'danger' },
  'charge.refunded': { key: 'historyPillRefund', tone: 'neutral' },
};

/**
 * Historique des factures, lu dans le journal fiscal (`get_org_billing_history`,
 * mig. 180). Propriétaire seul : l'appelant ne monte ce bloc que pour lui.
 *
 * ⚠️ Le montant est celui du JOURNAL, en centimes, négatif pour un
 * remboursement : rien n'est recalculé ici. Un échec de paiement affiche le
 * montant DÛ, barré, parce que rien n'a été encaissé.
 */
export function OrgBillingHistory({ orgId, ownerEmail }: Props) {
  const { t } = useT('orgAccount');
  const { data: entries = [], isLoading, isError } = useOrgBillingHistory(orgId, true);
  // Même clé de cache que la carte de contact : aucune requête de plus.
  const { data: contact } = useOrgBillingContact(orgId, true);
  const recipient = contact?.email ?? ownerEmail;

  const amount = (e: OrgBillingHistoryEntry) =>
    formatCurrency(e.amountCents / 100, undefined, { currency: e.currency.toUpperCase() });

  return (
    <section
      aria-labelledby="org-billing-history"
      className="rounded-xl border border-[rgb(var(--color-border))] p-4 flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="org-billing-history" className="flex items-center gap-2 text-sm font-semibold text-[rgb(var(--color-text-primary))]">
          {t('historyTitle')}
        </h3>
        {recipient && (
          <p className="text-xs text-[rgb(var(--color-text-secondary))]">
            {t('historySentTo', { email: recipient })} ·{' '}
            <a href="#org-billing-contact" className="underline">{t('historyEdit')}</a>
          </p>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('historyLoading')}</p>
      ) : isError ? (
        <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('historyError')}</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('historyEmpty')}</p>
      ) : (
        <ul className="divide-y divide-[rgb(var(--color-border))]">
          {entries.map((e) => {
            const failed = e.eventType === 'invoice.payment_failed';
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[rgb(var(--color-text-primary))]">
                    {t(EVENT_KEYS[e.eventType] ?? 'historyOther')}
                    {e.invoiceNumber && (
                      <span className="text-[rgb(var(--color-text-muted))]"> · {e.invoiceNumber}</span>
                    )}
                  </p>
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">
                    {formatDate(new Date(e.occurredAt))}
                  </p>
                </div>
                {(() => {
                  const pill = PILLS[e.eventType] ?? { key: 'historyPillOther' as const, tone: 'neutral' as const };
                  return <span className={`${PILL_BASE} ${PILL_TONE[pill.tone]}`}>{t(pill.key)}</span>;
                })()}
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
                    <Download size={14} aria-hidden /> {t('historyInvoice')}
                    <span className="sr-only">{t('historyNewTab')}</span>
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
