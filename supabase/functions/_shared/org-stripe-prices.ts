// ═══════════════════════════════════════════════════════════════════
// Résolution des price IDs Stripe d'un palier entreprise.
//
// ── POURQUOI CE FICHIER EXISTE (2026-08-25) ────────────────────────
//
// Le tarif MENSUEL est désigné par un secret Supabase (`STRIPE_ORG_PRICE_*`).
// Le tarif ANNUEL aurait pu suivre le même chemin : quatre secrets de plus.
// C'est le design qui a été écrit d'abord, et il a un défaut qui n'apparaît
// qu'au moment du passage en production : ces quatre secrets doivent être posés
// à la main, ET re-posés à l'identique le jour du basculement du compte Stripe
// de test vers le compte live. Un oubli ne casse rien visiblement : le bouton
// « Annuel » reste cliquable et le checkout répond `tier_unavailable`. Une
// impasse silencieuse sur la seule page qui encaisse.
//
// L'annuel est donc DÉRIVÉ, exactement comme son montant l'est déjà :
//
//   le prix annuel d'un palier = le prix récurrent annuel, actif, dans la même
//   devise et du montant attendu, porté par LE MÊME PRODUIT STRIPE que son prix
//   mensuel.
//
// Le produit Stripe devient l'ancre unique. Zéro secret à poser, zéro secret à
// re-poser, et le jour où `STRIPE_ORG_PRICE_T20` pointe vers le compte live,
// l'annuel suit tout seul.
//
// ── CE QUI EST VÉRIFIÉ AVANT DE FACTURER ───────────────────────────
//
// La résolution refuse de deviner. Elle exige UNE seule candidate, du montant
// exact annoncé par `ENTERPRISE_PRICING_TIERS` (via `yearlyTotalEur`), dans la
// devise du prix mensuel. Zéro candidate ou plusieurs → on n'ouvre pas de
// session de paiement du tout. C'est plus strict que le chemin mensuel, qui ne
// vérifie aucun montant : là, le secret DÉSIGNE le prix, donc il n'y a rien à
// choisir. Ici il y a un choix, donc il y a une vérification.
//
// ⚠️ `priceEnvVarYearly` reste lu EN PREMIER. Ce n'est plus une obligation mais
// une porte de sortie : si un jour un palier annuel doit vivre sur un autre
// produit (migration, prix négocié), poser le secret court-circuite toute la
// dérivation sans toucher au code.
// ═══════════════════════════════════════════════════════════════════
import {
  ORG_TIERS,
  priceEnvVarFor,
  yearlyTotalEur,
  type EnvReader,
  type OrgTier,
  type OrgTierKey,
  type OrgTierMatch,
} from './org-tiers.ts'

// ─── Surface Stripe minimale ─────────────────────────────────────────
//
// On ne dépend PAS du type `Stripe` du SDK : ce fichier serait alors
// intestable depuis Vitest (spécificateur `npm:`), comme `org-tiers.ts` qui
// évite `Deno.env` pour la même raison. Le client réel satisfait cette forme.

export interface StripePriceLike {
  id: string
  product: string | { id: string }
  unit_amount: number | null
  currency: string
  active?: boolean
  recurring?: { interval: string; interval_count?: number | null } | null
}

export interface StripeLike {
  prices: {
    retrieve(id: string): Promise<StripePriceLike>
    list(params: { product: string; active?: boolean; limit?: number }): Promise<{
      data: StripePriceLike[]
    }>
  }
}

/** L'id du produit, que Stripe l'ait développé ou non. */
function productIdOf(price: StripePriceLike): string {
  return typeof price.product === 'string' ? price.product : price.product.id
}

/** Montant annuel attendu, en centimes. Dérivé de la grille, jamais saisi. */
export function yearlyUnitAmountCents(tier: OrgTier): number {
  return Math.round(yearlyTotalEur(tier.priceEurPerMonth) * 100)
}

/** Une candidate annuelle plausible pour ce palier. */
function isYearlyCandidate(price: StripePriceLike, currency: string, cents: number): boolean {
  return (
    price.recurring?.interval === 'year' &&
    (price.recurring?.interval_count ?? 1) === 1 &&
    price.currency === currency &&
    price.unit_amount === cents &&
    price.active !== false
  )
}

export type YearlyResolution =
  | { ok: true; priceId: string; source: 'env' | 'derived' }
  | { ok: false; reason: 'monthly_missing' | 'not_found' | 'ambiguous' | 'stripe_error'; detail: string }

/**
 * Le price ID annuel d'un palier.
 *
 * Ne renvoie jamais un prix « probable » : soit la candidate est unique et du
 * bon montant, soit on échoue en disant pourquoi.
 */
export async function resolveYearlyPriceId(
  stripe: StripeLike,
  tier: OrgTier,
  env: EnvReader,
): Promise<YearlyResolution> {
  const override = priceEnvVarFor(tier, 'yearly')
  const explicit = override ? env(override) : undefined
  if (explicit) return { ok: true, priceId: explicit, source: 'env' }

  const monthlyVar = priceEnvVarFor(tier, 'monthly')
  const monthlyId = monthlyVar ? env(monthlyVar) : undefined
  if (!monthlyId) {
    return { ok: false, reason: 'monthly_missing', detail: `${monthlyVar ?? 'n/a'} absent` }
  }

  const cents = yearlyUnitAmountCents(tier)

  try {
    const monthly = await stripe.prices.retrieve(monthlyId)
    const product = productIdOf(monthly)
    const { data } = await stripe.prices.list({ product, active: true, limit: 100 })
    const candidates = data.filter((p) => isYearlyCandidate(p, monthly.currency, cents))

    if (candidates.length === 1) return { ok: true, priceId: candidates[0].id, source: 'derived' }
    if (candidates.length === 0) {
      return {
        ok: false,
        reason: 'not_found',
        detail: `aucun prix annuel de ${cents} ${monthly.currency} sur le produit ${product}`,
      }
    }
    // Plusieurs prix identiques sur le même produit : Stripe l'autorise, nous
    // non. Choisir au hasard, c'est facturer sur un prix que personne n'a
    // désigné, et rendre le rapprochement comptable impossible.
    return {
      ok: false,
      reason: 'ambiguous',
      detail: `${candidates.length} prix annuels concurrents sur le produit ${product}`,
    }
  } catch (err) {
    return { ok: false, reason: 'stripe_error', detail: String(err).slice(0, 200) }
  }
}

// ─── Sens inverse : price ID → palier + périodicité ──────────────────

/**
 * Table produit → palier, construite une fois par isolate.
 *
 * Le webhook reçoit un price ID nu et doit en déduire le palier. Pour les prix
 * MENSUELS, les secrets suffisent (comparaison de chaînes, aucun appel réseau).
 * Pour les ANNUELS dérivés, il faut remonter au produit, donc lire les prix
 * mensuels une fois. Sans ce cache, chaque event Stripe coûterait quatre
 * `prices.retrieve` — un webhook qui appelle Stripe en boucle finit par se
 * faire limiter, et un webhook limité, c'est une facture non appliquée.
 */
let productIndex: Map<string, OrgTierKey> | null = null

/** Testabilité : un isolate long ne doit pas garder un index périmé. */
export function resetProductIndex(): void {
  productIndex = null
}

async function getProductIndex(
  stripe: StripeLike,
  env: EnvReader,
): Promise<Map<string, OrgTierKey>> {
  if (productIndex) return productIndex
  const index = new Map<string, OrgTierKey>()
  for (const tier of ORG_TIERS) {
    const monthlyVar = priceEnvVarFor(tier, 'monthly')
    const monthlyId = monthlyVar ? env(monthlyVar) : undefined
    if (!monthlyId) continue
    try {
      const monthly = await stripe.prices.retrieve(monthlyId)
      index.set(productIdOf(monthly), tier.key)
    } catch {
      // Un palier illisible ne doit pas empêcher les autres d'être indexés :
      // l'appelant traitera « palier introuvable » comme un prix inconnu, ce
      // qui alerte et force un retry Stripe plutôt que de dégrader une org.
    }
  }
  productIndex = index
  return index
}

/**
 * Palier + périodicité d'un price ID, y compris annuel dérivé.
 *
 * Renvoie `undefined` plutôt qu'une approximation : l'appelant DOIT alerter et
 * ne rien écrire, jamais dégrader l'organisation au palier gratuit.
 */
export async function resolveTierMatch(
  stripe: StripeLike,
  priceId: string,
  env: EnvReader,
  /** Court-circuit synchrone : correspondance exacte avec un secret. */
  fastPath: (priceId: string, env: EnvReader) => OrgTierMatch | undefined,
): Promise<OrgTierMatch | undefined> {
  if (!priceId) return undefined

  const direct = fastPath(priceId, env)
  if (direct) return direct

  let price: StripePriceLike
  try {
    price = await stripe.prices.retrieve(priceId)
  } catch {
    return undefined
  }

  const interval = price.recurring?.interval
  // Un prix mensuel inconnu des secrets reste inconnu : la dérivation ne
  // couvre que l'annuel, et inventer un palier pour un mensuel non désigné
  // reviendrait à accepter n'importe quel prix du produit.
  if (interval !== 'year' || (price.recurring?.interval_count ?? 1) !== 1) return undefined

  const index = await getProductIndex(stripe, env)
  const tierKey = index.get(productIdOf(price))
  if (!tierKey) return undefined

  const tier = ORG_TIERS.find((t) => t.key === tierKey)
  if (!tier) return undefined

  // Dernier verrou : le montant doit être celui que le site annonce. Un prix
  // annuel bricolé à la main sur le bon produit ne doit pas ouvrir le quota
  // d'un palier qu'il ne paie pas.
  if (price.unit_amount !== yearlyUnitAmountCents(tier)) return undefined

  return { tier, interval: 'yearly' }
}
