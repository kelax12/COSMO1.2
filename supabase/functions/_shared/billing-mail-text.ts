// ═══════════════════════════════════════════════════════════════════
// Textes des emails de facturation (REMBOURSEMENT-RESILIATION.md §6).
// Module PUR, exécuté par vitest (`src/modules/billing/billing-mail-text.test.ts`).
// ═══════════════════════════════════════════════════════════════════
//
// Un email par événement, expédié depuis l'adresse de facturation :
// souscription, rétractation, remboursement, résiliation, prélèvement.
// Le rappel J-45 vit dans `renewal-notice-text.ts`.
//
// Mise en page : `billing-mail-layout.ts` (gabarit commun). Le nom d'organisation
// est écrit par ses admins : le gabarit l'échappe dans le HTML (SV-5).

import { renderBillingMail, type BillingMail } from './billing-mail-layout.ts'
import { tierByKey } from './org-tiers.ts'

export type { BillingMail } from './billing-mail-layout.ts'

/** Version des CGV en vigueur. Miroir : `src/modules/billing/cgv-version.ts`. */
export const CGV_VERSION = '2026-11-01'

export function euros(cents: number): string {
  return `${(Math.max(0, cents) / 100).toFixed(2).replace('.', ',')} €`
}

/** JJ/MM/AAAA depuis un instant ISO ou des secondes epoch, en heure de Paris. */
export function frDate(at: string | number): string {
  const d = typeof at === 'number' ? new Date(at * 1000) : new Date(at)
  return d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function frDateTime(at: string): string {
  return new Date(at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })
}

/** Les URLs que les e-mails ouvrent. `?tab=billing` reste redirigé pour les e-mails déjà partis. */
const billingUrl = (appUrl: string) => `${appUrl}/entreprise/billing`
const membersUrl = (appUrl: string) => `${appUrl}/entreprise/members`

/** Le palier comme l'écran l'écrit : l'effectif, ou « Illimité ». */
function tierLabel(key: string | null): string | null {
  const tier = key ? tierByKey(key) : undefined
  if (!tier) return null
  return tier.maxMembers === null ? 'Illimité' : `${tier.minMembers} à ${tier.maxMembers} membres`
}

const VAT = 'TVA non applicable, art. 293 B du CGI.'

export function subscriptionConfirmationMail(p: {
  orgName: string
  amountCents: number
  interval: 'monthly' | 'yearly'
  tierKey: string | null
  /** Conclusion du contrat, secondes epoch. */
  paidAt: number
  /** Fin de la première période, secondes epoch. */
  nextDueAt: number | null
  immediateAccessAt: string | null
  withdrawalDeadline: number
  invoiceUrl?: string | null
  appUrl: string
}): BillingMail {
  const label = tierLabel(p.tierKey)
  const max = p.tierKey ? tierByKey(p.tierKey)?.maxMembers ?? null : null
  const rows: Array<[string, string]> = [
    ...(label ? [['Palier', label] as [string, string]] : []),
    ['Montant', `${euros(p.amountCents)} TTC / ${p.interval === 'yearly' ? 'an' : 'mois'}`],
    ['Payé le', frDate(p.paidAt)],
    ...(p.nextDueAt ? [['Prochaine échéance', frDate(p.nextDueAt)] as [string, string]] : []),
  ]
  return renderBillingMail({
    subject: 'Votre abonnement COSMO Entreprise est actif',
    title: 'Votre abonnement est actif',
    intro: max
      ? `Merci, ${p.orgName}. Vos membres ont accès à tout, et vous pouvez inviter jusqu'à ${max} personnes.`
      : `Merci, ${p.orgName}. Vos membres ont accès à tout, sans limite de places.`,
    rows,
    cta: { label: 'Inviter des membres', url: membersUrl(p.appUrl) },
    secondary: p.invoiceUrl ? { label: 'Télécharger la facture', url: p.invoiceUrl } : undefined,
    legal: [
      `Nous confirmons votre commande : abonnement COSMO Entreprise pour l'organisation « ${p.orgName} », ${euros(p.amountCents)} TTC par ${p.interval === 'yearly' ? 'an' : 'mois'}. ${VAT}`,
      p.interval === 'yearly'
        ? "L'abonnement annuel est reconduit automatiquement à chaque échéance. Nous vous rappellerons la date de renouvellement 45 jours avant."
        : "L'abonnement mensuel est sans engagement et résiliable à tout moment.",
      `Conditions générales de vente (version ${CGV_VERSION}) : ${p.appUrl}/cgu`,
      `Droit de rétractation. Vous disposez de 14 jours à compter de la souscription, soit jusqu'au ${frDate(p.withdrawalDeadline)}, pour vous rétracter sans motif. Le plus simple : le bouton « Se rétracter du contrat ici » de la page Facturation, ${billingUrl(p.appUrl)}. Toute déclaration sans ambiguïté (e-mail à contact@thecosmo.app, courrier) est aussi acceptée, et le formulaire type figure dans les CGV.`,
      p.immediateAccessAt
        ? `Vous avez demandé expressément l'accès immédiat au service le ${frDateTime(p.immediateAccessAt)} et reconnu qu'en cas de rétractation, la période déjà utilisée vous sera facturée au prorata. Nous vous confirmons cette demande.`
        : 'En cas de rétractation, le montant payé vous sera remboursé intégralement.',
      'Le remboursement intervient au plus tard 14 jours après la rétractation, avec le même moyen de paiement, sans frais.',
    ],
    orgName: p.orgName,
    appUrl: p.appUrl,
  })
}

export function withdrawalAckMail(p: { orgName: string; withdrawnAt: string; amountCents: number; appUrl?: string }): BillingMail {
  return renderBillingMail({
    subject: 'Accusé de réception de votre rétractation COSMO',
    title: 'Votre rétractation est enregistrée',
    intro: `L'abonnement COSMO Entreprise de « ${p.orgName} » est arrêté.`,
    rows: [
      ['Rétractation le', `${frDateTime(p.withdrawnAt)} (heure de Paris)`],
      ['Montant remboursé', euros(p.amountCents)],
    ],
    legal: [
      `Nous accusons réception de votre rétractation du contrat d'abonnement COSMO Entreprise de l'organisation « ${p.orgName} », le ${frDateTime(p.withdrawnAt)} (heure de Paris).`,
      `Montant qui vous sera remboursé : ${euros(p.amountCents)}, sur le moyen de paiement utilisé, au plus tard 14 jours après cette date, sans frais.`,
    ],
    orgName: p.orgName,
    appUrl: p.appUrl ?? 'https://thecosmo.app',
  })
}

export function refundDoneMail(p: { orgName: string; amountCents: number; refundedAt: string; appUrl?: string }): BillingMail {
  return renderBillingMail({
    subject: 'Votre remboursement COSMO',
    title: 'Votre remboursement est parti',
    intro: 'Le montant apparaît sous quelques jours ouvrés sur le moyen de paiement utilisé.',
    rows: [
      ['Montant', euros(p.amountCents)],
      ['Remboursé le', frDate(p.refundedAt)],
    ],
    legal: [
      `Nous avons remboursé ${euros(p.amountCents)} le ${frDate(p.refundedAt)} pour l'abonnement COSMO Entreprise de l'organisation « ${p.orgName} ».`,
    ],
    orgName: p.orgName,
    appUrl: p.appUrl ?? 'https://thecosmo.app',
  })
}

export function cancellationMail(p: { orgName: string; accessUntil: string; appUrl: string }): BillingMail {
  const until = frDate(p.accessUntil)
  return renderBillingMail({
    subject: 'Confirmation de résiliation de votre abonnement COSMO',
    title: 'Votre résiliation est enregistrée',
    intro: `« ${p.orgName} » garde tout son accès jusqu'à la fin de la période payée. Aucun prélèvement n'aura lieu ensuite.`,
    rows: [
      ['Fin d’accès', until],
      ['Prochain prélèvement', 'aucun'],
      ['Après cette date', 'palier gratuit, 5 places'],
    ],
    cta: { label: 'Reprendre mon abonnement', url: billingUrl(p.appUrl) },
    afterCta: `Possible jusqu'au ${until}, même palier, même prix.`,
    legal: [
      `Nous confirmons la résiliation de l'abonnement COSMO Entreprise de l'organisation « ${p.orgName} ».`,
      `L'accès continue jusqu'au ${until}, fin de la période déjà payée. Aucun prélèvement n'aura lieu ensuite. Aucun remboursement n'est effectué.`,
    ],
    orgName: p.orgName,
    appUrl: p.appUrl,
  })
}

export function receiptMail(p: { orgName: string; amountCents: number; paidAt: number; appUrl: string; invoiceUrl?: string | null }): BillingMail {
  return renderBillingMail({
    subject: 'Reçu de paiement COSMO',
    title: 'Paiement reçu',
    intro: `Merci, ${p.orgName}. Votre abonnement COSMO Entreprise continue.`,
    rows: [
      ['Montant', `${euros(p.amountCents)} TTC`],
      ['Payé le', frDate(p.paidAt)],
    ],
    cta: { label: 'Gérer mon abonnement', url: billingUrl(p.appUrl) },
    secondary: p.invoiceUrl ? { label: 'Télécharger la facture', url: p.invoiceUrl } : undefined,
    legal: [
      `Nous avons reçu votre paiement de ${euros(p.amountCents)} TTC le ${frDate(p.paidAt)} pour l'abonnement COSMO Entreprise de l'organisation « ${p.orgName} ». ${VAT}`,
      `Gérer ou résilier mon abonnement : ${billingUrl(p.appUrl)}`,
    ],
    orgName: p.orgName,
    appUrl: p.appUrl,
  })
}
