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
