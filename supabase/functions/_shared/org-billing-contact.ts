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

/**
 * Mention portée au pied de CHAQUE facture tant que la franchise en base
 * s'applique (CGI art. 293 B). Posée sur le customer, donc reprise par toutes
 * ses factures d'abonnement, sans dépendre d'un réglage du Dashboard que
 * rien dans ce dépôt ne vérifie.
 *
 * 🔴 À retirer le jour où la franchise cesse (dépassement du seuil) : une
 * facture qui l'affiche à tort annonce une TVA non collectée qui est due.
 */
export const INVOICE_FOOTER = 'TVA non applicable, art. 293 B du CGI'

export interface CustomerContactFields {
  email: string | undefined
  /** Absent = on ne touche pas au nom du customer. */
  name?: string
  invoice_settings: { footer: string }
}

/** Les champs à poser sur le customer Stripe d'une organisation. */
export function customerContactFields(
  contact: BillingContactRow | null,
  ownerEmail: string | undefined,
): CustomerContactFields {
  const invoice_settings = { footer: INVOICE_FOOTER }
  if (!contact) return { email: ownerEmail, invoice_settings }
  const name = contact.name?.trim()
  return name
    ? { email: contact.email, name, invoice_settings }
    : { email: contact.email, invoice_settings }
}
