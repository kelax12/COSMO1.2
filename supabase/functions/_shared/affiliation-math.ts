// ═══════════════════════════════════════════════════════════════════
// Commission d'affiliation (spec AFFILIATION.md, mig. 236, formule mig. 238)
// Module PUR, exécuté par vitest (`src/affiliation-math.guard.test.ts`).
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 C'est la RÉFÉRENCE : `affiliate_compute()` (mig. 236) reproduit ces
// formules au centime. Toute modification ici se reporte dans le SQL.
//
// Les arrondis sont ceux de `round()` de PostgreSQL sur un numeric
// (demi vers l'infini) : `Math.round` sur des montants positifs donne le
// même résultat, et on n'arrondit que des valeurs positives.

export interface CommissionInput {
  grossCents: number;
  vatBp: number;
  /** Part du montant payé retirée avant commission (mig. 238, 2560 = 25,6 %). */
  deductionBp: number;
  feeBp: number;
  feeFixedCents: number;
  rateBp: number;
}

export interface CommissionResult {
  vatCents: number;
  deductionCents: number;
  feeCents: number;
  baseCents: number;
  commissionCents: number;
}

export function computeCommission({
  grossCents,
  vatBp,
  deductionBp,
  feeBp,
  feeFixedCents,
  rateBp,
}: CommissionInput): CommissionResult {
  const vatCents = grossCents - Math.round(grossCents / (1 + vatBp / 10000));
  const deductionCents = Math.round((grossCents * deductionBp) / 10000);
  // Stripe prélève sur le montant réellement débité, TVA comprise.
  const feeCents = Math.round((grossCents * feeBp) / 10000) + feeFixedCents;
  const baseCents = Math.max(grossCents - vatCents - deductionCents - feeCents, 0);
  const commissionCents = Math.round((baseCents * rateBp) / 10000);
  return { vatCents, deductionCents, feeCents, baseCents, commissionCents };
}

export interface RefundInput {
  refundCents: number;
  originGross: number;
  originCommission: number;
}

/** Commission négative, au prorata du remboursement, aux taux du paiement d'origine. */
export function refundCommission({ refundCents, originGross, originCommission }: RefundInput): number {
  if (originGross <= 0) return 0;
  const c = Math.round((Math.abs(refundCents) / originGross) * originCommission);
  return c === 0 ? 0 : -c;
}
