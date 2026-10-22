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
// client ne peut ni la lire ni forger un prix (il n'envoie qu'une `tierKey` et
// une périodicité).
//
// `maxMembers` sert de QUOTA : la règle serveur est `COUNT(membres) < maxMembers`,
// donc un palier « 10 à 20 membres » autorise jusqu'à 20 membres inclus.
// `null` = aucun plafond.
//
// ── PÉRIODICITÉ (2026-08-25) ───────────────────────────────────────
// Chaque palier payant a DEUX prix Stripe : un mensuel et un annuel. L'annuel
// ne porte AUCUN montant propre ici — il est DÉRIVÉ du mensuel par
// `ENTERPRISE_YEARLY_DISCOUNT`, exactement comme côté front. Écrire les deux
// grilles à la main, c'est se donner deux occasions de diverger là où une
// seule suffisait déjà à annoncer 50 € et facturer 100 €.
//
// Le QUOTA de sièges ne dépend PAS de la périodicité : `maxMembers` est porté
// par le palier seul. Un client annuel et un client mensuel du même palier ont
// exactement les mêmes droits.
//
// ⚠️ `priceEnvVarYearly` n'est PAS un secret obligatoire. Le price ID annuel
// se DÉRIVE du produit Stripe porteur du prix mensuel
// (`_shared/org-stripe-prices.ts`) : rien à poser, rien à re-poser le jour du
// passage en compte live. Ce nom de variable ne sert plus que de porte de
// sortie, pour épingler explicitement un prix annuel qui vivrait ailleurs.
// ═══════════════════════════════════════════════════════════════════

export type OrgTierKey = 'free' | 't10' | 't20' | 't50' | 'tmax'

/** Périodicité de facturation. `monthly` est le défaut partout. */
export type OrgBillingInterval = 'monthly' | 'yearly'

/**
 * Remise appliquée au tarif mensuel quand la facturation est annuelle.
 *
 * 0.3 = −30 %. Miroir de `ENTERPRISE_YEARLY_DISCOUNT`
 * (src/modules/billing/premium-config.ts), verrouillé par la parité.
 */
export const ENTERPRISE_YEARLY_DISCOUNT = 0.3

export interface OrgTier {
  key: OrgTierKey
  minMembers: number
  maxMembers: number | null
  priceEurPerMonth: number
  /** Nom du secret Supabase portant le price ID mensuel. `null` = palier gratuit. */
  priceEnvVarMonthly: string | null
  /**
   * Nom du secret Supabase portant le price ID annuel. `null` = palier gratuit.
   *
   * OPTIONNEL : s'il n'est pas renseigné, le prix annuel est dérivé du produit
   * Stripe du prix mensuel. Le poser force ce price ID et court-circuite la
   * dérivation.
   */
  priceEnvVarYearly: string | null
}

/** Lecteur d'environnement injecté (`Deno.env.get` en production). */
export type EnvReader = (name: string) => string | undefined

export const ORG_TIERS: readonly OrgTier[] = [
  { key: 'free', minMembers: 0, maxMembers: 5, priceEurPerMonth: 0, priceEnvVarMonthly: null, priceEnvVarYearly: null },
  { key: 't10', minMembers: 5, maxMembers: 10, priceEurPerMonth: 20, priceEnvVarMonthly: 'STRIPE_ORG_PRICE_T10', priceEnvVarYearly: 'STRIPE_ORG_PRICE_T10_YEARLY' },
  { key: 't20', minMembers: 10, maxMembers: 20, priceEurPerMonth: 50, priceEnvVarMonthly: 'STRIPE_ORG_PRICE_T20', priceEnvVarYearly: 'STRIPE_ORG_PRICE_T20_YEARLY' },
  { key: 't50', minMembers: 20, maxMembers: 50, priceEurPerMonth: 100, priceEnvVarMonthly: 'STRIPE_ORG_PRICE_T50', priceEnvVarYearly: 'STRIPE_ORG_PRICE_T50_YEARLY' },
  { key: 'tmax', minMembers: 50, maxMembers: null, priceEurPerMonth: 200, priceEnvVarMonthly: 'STRIPE_ORG_PRICE_TMAX', priceEnvVarYearly: 'STRIPE_ORG_PRICE_TMAX_YEARLY' },
] as const

/** Quota appliqué à une org sans abonnement actif. */
export const FREE_TIER_MAX_MEMBERS = 5

/** Arrondi au centime — deux calculs identiques doivent rendre le même nombre. */
function roundEur(amount: number): number {
  return Math.round(amount * 100) / 100
}

/** Tarif MENSUEL ÉQUIVALENT d'un engagement annuel (mensuel −30 %). */
export function yearlyMonthlyEquivalentEur(priceEurPerMonth: number): number {
  return roundEur(priceEurPerMonth * (1 - ENTERPRISE_YEARLY_DISCOUNT))
}

/**
 * Montant réellement débité une fois par an.
 *
 * Dérivé de l'équivalent mensuel ARRONDI, pas du tarif brut : sinon le total
 * annoncé peut différer d'un centime de « 12 × le prix affiché », et un client
 * a raison de se fier à la multiplication qu'il fait de tête.
 */
export function yearlyTotalEur(priceEurPerMonth: number): number {
  return roundEur(yearlyMonthlyEquivalentEur(priceEurPerMonth) * 12)
}

export function tierByKey(key: string): OrgTier | undefined {
  return ORG_TIERS.find((t) => t.key === key)
}

/** Le secret portant le price ID d'un palier pour une périodicité donnée. */
export function priceEnvVarFor(tier: OrgTier, interval: OrgBillingInterval): string | null {
  return interval === 'yearly' ? tier.priceEnvVarYearly : tier.priceEnvVarMonthly
}

/** Price ID Stripe d'un palier, ou `null` (palier gratuit / secret absent). */
export function priceIdForTier(
  key: string,
  env: EnvReader,
  interval: OrgBillingInterval = 'monthly',
): string | null {
  const tier = tierByKey(key)
  if (!tier) return null
  const envVar = priceEnvVarFor(tier, interval)
  if (!envVar) return null
  return env(envVar) ?? null
}

/** Palier + périodicité retrouvés depuis un price ID Stripe. */
export interface OrgTierMatch {
  tier: OrgTier
  interval: OrgBillingInterval
}

/**
 * Sens inverse SYNCHRONE : retrouver le palier depuis un price ID connu d'un
 * secret. Aucun appel réseau, donc utilisable comme court-circuit.
 *
 * Indispensable pour `customer.subscription.updated` — un changement de palier
 * OU DE PÉRIODICITÉ fait depuis le Billing Portal ne passe pas par notre
 * checkout, donc la seule information disponible est le price ID. Sans ce
 * mapping, un client paierait 100 € en restant bloqué au quota de 20 membres.
 *
 * ⚠️ Ne connaît QUE les price IDs nommés par un secret. Un prix annuel dérivé
 * n'y figure pas : c'est `resolveTierMatch` (`org-stripe-prices.ts`) qui prend
 * le relais, en remontant au produit Stripe. Cette fonction reste son premier
 * essai, parce qu'une comparaison de chaînes ne coûte rien.
 *
 * `undefined` pour un price inconnu : l'appelant DOIT alerter et ne rien
 * écrire, plutôt que de dégrader l'org au palier gratuit.
 */
export function tierFromPriceId(priceId: string, env: EnvReader): OrgTierMatch | undefined {
  for (const tier of ORG_TIERS) {
    if (tier.priceEnvVarMonthly && env(tier.priceEnvVarMonthly) === priceId) {
      return { tier, interval: 'monthly' }
    }
    if (tier.priceEnvVarYearly && env(tier.priceEnvVarYearly) === priceId) {
      return { tier, interval: 'yearly' }
    }
  }
  return undefined
}
