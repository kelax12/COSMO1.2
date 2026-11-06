// ═══════════════════════════════════════════════════════════════════
// COMBIEN ON REMBOURSE — la seule ligne de ce dépôt qui décide d'un montant
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CE FICHIER EST SÉPARÉ, ET SANS AUCUNE API DENO.
//
// Un remboursement est le seul endroit où COSMO choisit un montant au lieu de
// se le faire désigner par Stripe : se tromper coûte directement. Ces
// fonctions sont donc du TS pur, exécutables par vitest
// (`src/modules/billing/refund-amount.test.ts`), même montage que
// `_shared/org-tiers.ts`.
//
// ── LA RÈGLE (décision d'Axel du 2026-11-01) ────────────────────────
//
// Source : `Documents/analytics/docs/REMBOURSEMENT-RESILIATION.md`. Elle
// REMPLACE la décision du 2026-09-03 (« rembourser le mois en cours à tout
// moment »), qui n'existe plus.
//
//   1. Rétractation (art. L221-18) : 14 jours à compter de la CONCLUSION du
//      contrat, c'est-à-dire de la première souscription payée. Un
//      renouvellement n'ouvre pas de nouveau délai.
//   2. Montant (art. L221-25) : prorata JOURNALIER de la période non utilisée.
//      Le jour de la rétractation compte comme utilisé. Arrondi au centime
//      INFÉRIEUR. Jamais plus que l'encaissé, jamais négatif.
//   3. Ce prorata n'est opposable que si le client a DEMANDÉ EXPRESSÉMENT
//      l'accès immédiat au paiement (case cochée, `billing_acceptances`).
//      Sans cette demande : remboursement INTÉGRAL.
//   4. Après 14 jours : aucun remboursement, sauf exceptions légales traitées
//      par l'admin (défaut de conformité, rappel de renouvellement non
//      envoyé), au même prorata journalier.
//
// ❌ Aucuns frais de rétractation, jamais.

/** Périodicité facturée, telle que `org_subscriptions.billing_interval` la porte. */
export type BillingInterval = 'monthly' | 'yearly';

/** Durée du droit de rétractation, en jours (art. L221-18). */
export const WITHDRAWAL_DAYS = 14;

const DAY_SECONDS = 24 * 60 * 60;

/** Exceptions légales au « pas de remboursement après 14 jours » (§3). */
export type RefundException = 'conformity' | 'renewal_notice_missed';

export interface RefundInput {
  /** Ce que Stripe a réellement encaissé sur la facture de la période. */
  amountPaidCents: number;
  /** Début de la période payée (secondes epoch, comme Stripe les rend). */
  periodStart: number;
  /** Fin de la période payée (secondes epoch). */
  periodEnd: number;
  /** Instant de la rétractation ou de la demande (secondes epoch). */
  now: number;
  /**
   * Le client a-t-il demandé expressément l'accès immédiat au paiement ?
   * `false` = remboursement intégral (art. L221-25 al. 2).
   */
  immediateAccessRequested: boolean;
}

export interface RefundDecision {
  amountCents: number;
  reason: 'full_no_immediate_access' | 'daily_prorata' | 'nothing_to_refund';
  /** Jours non utilisés remboursés (informatif, pour l'écran et le journal). */
  daysRemaining: number;
  /** Jours de la période (informatif). */
  daysInPeriod: number;
}

/** Le délai de 14 jours est-il encore ouvert ? `contractStart` = conclusion (secondes epoch). */
export function withinWithdrawalWindow(contractStart: number, now: number): boolean {
  // Aucune garde `Number.isFinite` : `NaN` et `±Infinity` ferment la fenêtre
  // d'eux-mêmes, car `now >= contractStart` ou `now < contractStart + 14 j`
  // est alors faux pour toute combinaison (vérifié cas par cas, 2026-11-06).
  // Une garde ici serait équivalente à son absence, donc intestable (AM-3) ;
  // `refund-amount.test.ts` fige le comportement pour NaN et ±Infinity.
  return now >= contractStart && now < contractStart + WITHDRAWAL_DAYS * DAY_SECONDS;
}

/** Fin du délai de rétractation (secondes epoch). */
export function withdrawalDeadline(contractStart: number): number {
  return contractStart + WITHDRAWAL_DAYS * DAY_SECONDS;
}

/**
 * Combien rendre, et pourquoi.
 *
 * `remboursement = payé × (jours restants / jours de la période)`, où le jour
 * en cours est compté comme utilisé : jours utilisés = jours entamés depuis le
 * début de période.
 */
export function refundAmount(input: RefundInput): RefundDecision {
  const { amountPaidCents, periodStart, periodEnd, now, immediateAccessRequested } = input;
  const nothing: RefundDecision = { amountCents: 0, reason: 'nothing_to_refund', daysRemaining: 0, daysInPeriod: 0 };

  if (!Number.isFinite(amountPaidCents) || amountPaidCents <= 0) return nothing;
  if (!Number.isFinite(periodStart) || !Number.isFinite(periodEnd) || periodEnd <= periodStart) return nothing;

  const daysInPeriod = Math.max(1, Math.round((periodEnd - periodStart) / DAY_SECONDS));

  // Sans demande expresse d'accès immédiat, la période utilisée ne peut pas
  // être facturée : on rend tout.
  if (!immediateAccessRequested) {
    return { amountCents: amountPaidCents, reason: 'full_no_immediate_access', daysRemaining: daysInPeriod, daysInPeriod };
  }

  // `now >= periodEnd` n'est pas testé ici : un instant à la fin de période ou
  // après donne `daysUsed = daysInPeriod`, donc `daysRemaining = 0`, et la
  // sortie « rien à rendre » de plus bas rend exactement la même décision.
  if (!Number.isFinite(now)) return { ...nothing, daysInPeriod };

  // Jours entamés : le jour de la rétractation compte comme utilisé.
  const daysUsed = Math.min(daysInPeriod, Math.max(1, Math.floor((now - periodStart) / DAY_SECONDS) + 1));
  const daysRemaining = daysInPeriod - daysUsed;
  if (daysRemaining <= 0) return { ...nothing, daysInPeriod };

  const prorata = Math.floor((amountPaidCents * daysRemaining) / daysInPeriod);

  return {
    // 🔴 CLAMP FINAL, redondant exprès : on ne rend jamais plus que l'encaissé.
    amountCents: Math.min(Math.max(prorata, 0), amountPaidCents),
    reason: 'daily_prorata',
    daysRemaining,
    daysInPeriod,
  };
}
