// ═══════════════════════════════════════════════════════════════════
// Paliers d'abonnement entreprise — mapping partagé par les Edge Functions.
//
// ⚠️ TS PUR, AUCUNE API DENO. C'est délibéré : ce fichier est importé par un
// test Vitest (`src/modules/billing/org-tiers.parity.test.ts`) qui prouve
// qu'il ne diverge pas de `ENTERPRISE_PRICING_TIERS`. Un seul `Deno.env` ici
// rendrait ce test impossible, donc l'environnement est passé en argument.
//
// ⚠️ Les price IDs ne sont PAS écrits ici, seulement les NOMS de variables
// d'environnement : la grille Stripe reste dans les secrets Supabase, et un
// client ne peut ni la lire ni forger un prix (il n'envoie qu'une `tierKey`).
//
// `maxMembers` sert de QUOTA : la règle serveur est `COUNT(membres) < maxMembers`,
// donc un palier « 10 à 20 membres » autorise jusqu'à 20 membres inclus.
// `null` = aucun plafond.
// ═══════════════════════════════════════════════════════════════════

export type OrgTierKey = 'free' | 't10' | 't20' | 't50' | 'tmax'

export interface OrgTier {
  key: OrgTierKey
  minMembers: number
  maxMembers: number | null
  priceEurPerMonth: number
  /** Nom du secret Supabase portant le price ID. `null` = palier gratuit. */
  priceEnvVar: string | null
}

/** Lecteur d'environnement injecté (`Deno.env.get` en production). */
export type EnvReader = (name: string) => string | undefined

export const ORG_TIERS: readonly OrgTier[] = [
  { key: 'free', minMembers: 0, maxMembers: 5, priceEurPerMonth: 0, priceEnvVar: null },
  { key: 't10', minMembers: 5, maxMembers: 10, priceEurPerMonth: 20, priceEnvVar: 'STRIPE_ORG_PRICE_T10' },
  { key: 't20', minMembers: 10, maxMembers: 20, priceEurPerMonth: 50, priceEnvVar: 'STRIPE_ORG_PRICE_T20' },
  { key: 't50', minMembers: 20, maxMembers: 50, priceEurPerMonth: 100, priceEnvVar: 'STRIPE_ORG_PRICE_T50' },
  { key: 'tmax', minMembers: 50, maxMembers: null, priceEurPerMonth: 200, priceEnvVar: 'STRIPE_ORG_PRICE_TMAX' },
] as const

/** Quota appliqué à une org sans abonnement actif. */
export const FREE_TIER_MAX_MEMBERS = 5

export function tierByKey(key: string): OrgTier | undefined {
  return ORG_TIERS.find((t) => t.key === key)
}

/** Price ID Stripe d'un palier, ou `null` (palier gratuit / secret absent). */
export function priceIdForTier(key: string, env: EnvReader): string | null {
  const tier = tierByKey(key)
  if (!tier || !tier.priceEnvVar) return null
  return env(tier.priceEnvVar) ?? null
}

/**
 * Sens inverse : retrouver le palier depuis un price ID Stripe.
 *
 * Indispensable pour `customer.subscription.updated` — un changement de palier
 * fait depuis le Billing Portal ne passe pas par notre checkout, donc la seule
 * information disponible est le price ID. Sans ce mapping, un client paierait
 * 100 € en restant bloqué au quota de 20 membres.
 *
 * `undefined` pour un price inconnu : l'appelant DOIT alerter et ne rien
 * écrire, plutôt que de dégrader l'org au palier gratuit.
 */
export function tierFromPriceId(priceId: string, env: EnvReader): OrgTier | undefined {
  return ORG_TIERS.find((t) => t.priceEnvVar !== null && env(t.priceEnvVar) === priceId)
}
