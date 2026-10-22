// ═══════════════════════════════════════════════════════════════════
// Reconnaître un identifiant Stripe absent du compte présenté (C-71).
//
// Stripe répond `resource_missing` (HTTP 404) dès qu'un `stripe_customer_id`
// ou `stripe_subscription_id` porté par `org_subscriptions` ne vit pas dans le
// compte Stripe visé — ce sera le cas de TOUS les identifiants de test le jour
// du passage en compte live (CLAUDE.md § Facturation entreprise, réserve n°1),
// et de tout identifiant supprimé côté Stripe après coup.
//
// La migration 140 (`reset_stripe_identifiers`) traite la DONNÉE ; ce fichier
// rend le CODE tolérant à sa présentation d'un identifiant obsolète — les deux
// sont nécessaires, et celui-ci protège aussi si la 140 n'a pas encore été
// jouée.
//
// ⚠️ TS PUR, AUCUNE API DENO, AUCUN `npm:` — comme `org-tiers.ts` et
// `org-stripe-prices.ts` — pour rester testable depuis Vitest
// (`src/modules/billing/stripe-errors.test.ts`).
// ═══════════════════════════════════════════════════════════════════

export interface StripeErrorLike {
  code?: string
}

/**
 * `true` seulement pour un 404 Stripe sur un identifiant inconnu du compte
 * présenté. Toute autre erreur (réseau, rate limit, panne Stripe) rend
 * `false` : « en cas de doute, faire retenter Stripe, jamais deviner ».
 */
export function isResourceMissing(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  return (err as StripeErrorLike).code === 'resource_missing'
}
