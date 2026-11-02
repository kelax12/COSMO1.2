// ═══════════════════════════════════════════════════════════════════
// Un abonnement existant interdit-il un NOUVEAU checkout d'organisation ?
//
// 🔴 POURQUOI (revue finale du lot 1 facturation, 2026-11-02). Seuls `active`
// et `trialing` étaient refusés. Une organisation en `past_due` (Stripe
// retente le prélèvement) ou `unpaid` (relances épuisées, abonnement gardé)
// pouvait ouvrir un second Checkout : deux abonnements sur le même customer,
// et Stripe qui continue de retenter le premier. Double prélèvement.
// L'interface bloque déjà ces chemins ; le verrou réel est ici.
//
// La sortie d'un impayé, c'est la carte mise à jour dans le portail
// (`stripe-org-portal`), jamais un abonnement de plus.
//
// ⚠️ TS PUR, AUCUNE API DENO, AUCUN `npm:` — comme `stripe-errors.ts` — pour
// rester testable depuis Vitest (`src/modules/billing/org-checkout-gate.test.ts`).
// ═══════════════════════════════════════════════════════════════════

/** Code métier renvoyé par `stripe-org-checkout`, lu sur `.code` côté client (C-62). */
export type CheckoutBlockCode = 'already_subscribed' | 'subscription_past_due'

/**
 * Le refus à opposer à un checkout, d'après le statut Stripe de l'abonnement
 * déjà enregistré pour l'organisation. `null` : rien ne s'y oppose
 * (`canceled`, `incomplete_expired`, ou aucun abonnement retrouvé).
 */
export function checkoutBlockFor(status: string | null | undefined): CheckoutBlockCode | null {
  if (status === 'active' || status === 'trialing') return 'already_subscribed'
  if (status === 'past_due' || status === 'unpaid') return 'subscription_past_due'
  return null
}
