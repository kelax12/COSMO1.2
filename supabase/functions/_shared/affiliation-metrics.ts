// ═══════════════════════════════════════════════════════════════════
// Indicateurs dérivés de l'affiliation (statut, rétention, MRR, LTV, solde)
// Module PUR, exécuté par vitest (`src/affiliation-metrics.guard.test.ts`).
// ═══════════════════════════════════════════════════════════════════
//
// Montants en centimes HT. Le calcul de la commission elle-même (frais Stripe
// estimés, TVA) vit dans `_shared/affiliation-math.ts` ; ici on agrège.

export type AffiliateStatus = 'active' | 'failed' | 'cancelled'
export type BillingInterval = 'month' | 'year'

export function affiliateStatus(input: { subscriptionStatus: string | null; paidCount: number }): AffiliateStatus | null {
  const s = input.subscriptionStatus
  if (s === 'active') return 'active'
  if (s === 'past_due' || s === 'unpaid') return 'failed'
  if (s === 'cancelled' || s === 'canceled') return 'cancelled'
  // Repassé en gratuit (plus d'abonnement) après au moins un paiement.
  return input.paidCount > 0 ? 'cancelled' : null
}

// Mois pleins entre le premier paiement réussi et l'arrêt (ou aujourd'hui).
export function retentionMonths(firstPaidAt: string | null, stoppedAt: string | null, today = new Date()): number {
  if (!firstPaidAt) return 0
  const a = new Date(firstPaidAt)
  const b = stoppedAt ? new Date(stoppedAt) : today
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
  if (b.getUTCDate() < a.getUTCDate()) months -= 1
  return Math.max(0, months)
}

export function monthlyAmountCents(netCents: number, interval: BillingInterval): number {
  return interval === 'year' ? netCents / 12 : netCents
}

export function affiliateMrrCents(
  subs: ReadonlyArray<{ netCents: number; interval: BillingInterval; status: AffiliateStatus | null }>,
  rateBp: number,
): number {
  const mrr = subs.filter((s) => s.status === 'active').reduce((sum, s) => sum + monthlyAmountCents(s.netCents, s.interval), 0)
  return Math.round((mrr * rateBp) / 10000)
}

// Somme réellement payée, remboursements déduits (frais Stripe non déduits).
export function ltvCents(payments: ReadonlyArray<{ amountCents: number; refundedCents: number }>): number {
  return payments.reduce((sum, p) => sum + p.amountCents - p.refundedCents, 0)
}

// Gagné − versé. Négatif si l'on a trop versé : on ne le masque pas.
export function amountDueCents(earnedCents: ReadonlyArray<number>, paidOutCents: ReadonlyArray<number>): number {
  const sum = (xs: ReadonlyArray<number>) => xs.reduce((a, b) => a + b, 0)
  return sum(earnedCents) - sum(paidOutCents)
}

const TIER_LABELS: Record<string, string> = {
  t10: 'Entreprise 10',
  t20: 'Entreprise 20',
  t50: 'Entreprise 50',
  tmax: 'Illimité',
}

export function tierLabel(tierKey: string): string {
  return TIER_LABELS[tierKey] ?? tierKey
}
