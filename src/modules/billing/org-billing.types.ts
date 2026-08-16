// ═══════════════════════════════════════════════════════════════════
// BILLING — Abonnement d'ORGANISATION (mode entreprise)
//
// Distinct de `Subscription` (billing.repository.ts), qui porte l'abonnement
// PARTICULIER : jetons premium, win_streak, plan 3,50 €/mois. Les deux ne
// partagent aucune colonne et ne doivent jamais être confondus.
// ═══════════════════════════════════════════════════════════════════
import type { OrgTierKey } from './premium-config';

export type OrgSubscriptionStatus = 'active' | 'past_due' | 'cancelled';

export interface OrgSubscription {
  orgId: string;
  tierKey: OrgTierKey;
  /** `null` = palier sans plafond. */
  maxMembers: number | null;
  status: OrgSubscriptionStatus;
  currentPeriodEnd: string | null;
  /** Code promo appliqué — informatif, jamais utilisé pour un calcul. */
  discountCode: string | null;
}
