// ═══════════════════════════════════════════════════════════════════
// Contact de facturation d'une organisation (mig. 180) → customer Stripe.
//
// Module TS PUR, comme `refund-replay.ts` : aucun import Deno ni Stripe, donc
// exécutable par Vitest (`src/modules/billing/org-billing-contact.test.ts`).
//
// Stripe envoie factures et reçus à `customer.email`. Sans contact, c'est
// l'adresse du propriétaire, exactement comme avant la mig. 180.
// ═══════════════════════════════════════════════════════════════════

export interface BillingContactRow {
  name: string | null
  email: string
}

export interface CustomerContactFields {
  email: string | undefined
  /** Absent = on ne touche pas au nom du customer. */
  name?: string
}

/** Les champs à poser sur le customer Stripe d'une organisation. */
export function customerContactFields(
  contact: BillingContactRow | null,
  ownerEmail: string | undefined,
): CustomerContactFields {
  if (!contact) return { email: ownerEmail }
  const name = contact.name?.trim()
  return name ? { email: contact.email, name } : { email: contact.email }
}
