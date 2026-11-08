import type { KeyOf } from '@/i18n/catalog';
import type { OrgBillingHistoryEntry } from '@/modules/billing/org-billing.types';

/** Libellé d'une ligne du journal. Un type inconnu reste lisible, jamais masqué. */
const EVENT_KEYS: Record<string, KeyOf<'orgAccount'>> = {
  'invoice.payment_succeeded': 'historyPaid',
  'invoice.payment_failed': 'historyFailed',
  'charge.refunded': 'historyRefund',
};

/**
 * Motif d'un paiement réussi, quand le journal le connaît (mig. 241). Depuis
 * que le portail facture le prorata immédiatement, une organisation
 * peut payer deux fois dans le mois : la ligne doit dire pourquoi.
 */
const REASON_KEYS: Record<string, KeyOf<'orgAccount'>> = {
  subscription_create: 'historyReasonCreate',
  subscription_cycle: 'historyReasonCycle',
  subscription_update: 'historyReasonUpdate',
};

export function historyLabelKey(e: Pick<OrgBillingHistoryEntry, 'eventType' | 'billingReason'>): KeyOf<'orgAccount'> {
  if (e.eventType === 'invoice.payment_succeeded' && e.billingReason && REASON_KEYS[e.billingReason]) {
    return REASON_KEYS[e.billingReason];
  }
  return EVENT_KEYS[e.eventType] ?? 'historyOther';
}
