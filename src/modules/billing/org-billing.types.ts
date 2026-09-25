// ═══════════════════════════════════════════════════════════════════
// BILLING — Abonnement d'ORGANISATION (mode entreprise)
//
// Distinct de `Subscription` (billing.repository.ts), qui porte l'abonnement
// PARTICULIER : plan, statut et période, 3,50 €/mois. Les deux ne
// partagent aucune colonne et ne doivent jamais être confondus.
// ═══════════════════════════════════════════════════════════════════
import type { OrgBillingInterval, OrgTierKey } from './premium-config';

export type OrgSubscriptionStatus = 'active' | 'past_due' | 'cancelled';

export interface OrgSubscription {
  orgId: string;
  tierKey: OrgTierKey;
  /** `null` = palier sans plafond. */
  maxMembers: number | null;
  status: OrgSubscriptionStatus;
  /**
   * Périodicité réellement facturée. Descriptive : le quota de sièges vient du
   * palier seul, jamais d'ici — un client annuel et un client mensuel du même
   * palier ont exactement les mêmes droits.
   */
  billingInterval: OrgBillingInterval;
  currentPeriodEnd: string | null;
  /** Code promo appliqué — informatif, jamais utilisé pour un calcul. */
  discountCode: string | null;
}

/**
 * Une ligne de l'historique de facturation, lue dans le journal fiscal
 * (`get_org_billing_history`, mig. 180). Montant en CENTIMES, négatif pour un
 * remboursement : c'est ainsi que le journal l'écrit, et l'écran ne recalcule
 * rien.
 */
export interface OrgBillingHistoryEntry {
  id: number;
  /** `invoice.payment_succeeded`, `invoice.payment_failed`, `charge.refunded`… */
  eventType: string;
  invoiceNumber: string | null;
  hostedInvoiceUrl: string | null;
  amountCents: number;
  currency: string;
  occurredAt: string;
}

/** Contact de facturation distinct du propriétaire (mig. 180). */
export interface OrgBillingContact {
  orgId: string;
  name: string | null;
  email: string;
}
