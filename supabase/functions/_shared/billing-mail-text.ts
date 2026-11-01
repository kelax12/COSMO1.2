// ═══════════════════════════════════════════════════════════════════
// Textes des emails de facturation (REMBOURSEMENT-RESILIATION.md §6).
// Module PUR, exécuté par vitest (`src/modules/billing/billing-mail-text.test.ts`).
// ═══════════════════════════════════════════════════════════════════
//
// Un email par événement, expédié depuis l'adresse de facturation :
// souscription, rétractation, remboursement, résiliation, prélèvement.
// Le rappel J-45 vit dans `renewal-notice-text.ts`.
//
// ⚠️ Le nom d'organisation est écrit par ses admins : il est échappé dans le
// HTML (SV-5), comme dans `renewal-notice-text.ts`.

/** Version des CGV en vigueur. Miroir : `src/modules/billing/cgv-version.ts`. */
export const CGV_VERSION = '2026-11-01'

export interface BillingMail {
  subject: string
  text: string
  html: string
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

function toMail(subject: string, lines: string[]): BillingMail {
  return {
    subject,
    text: lines.join('\n'),
    html: lines.map((l) => (l === '' ? '<br>' : `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`)).join(''),
  }
}

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

const SIGN = ["L'equipe COSMO", 'contact@thecosmo.app']

function billingUrl(appUrl: string): string {
  return `${appUrl}/entreprise?tab=billing`
}

export function subscriptionConfirmationMail(p: {
  orgName: string
  amountCents: number
  interval: 'monthly' | 'yearly'
  immediateAccessAt: string | null
  withdrawalDeadline: number
  appUrl: string
}): BillingMail {
  const lines = [
    'Bonjour,',
    '',
    `Nous confirmons votre commande : abonnement COSMO Entreprise pour l'organisation « ${p.orgName} », ${euros(p.amountCents)} TTC par ${p.interval === 'yearly' ? 'an' : 'mois'}. TVA non applicable, art. 293 B du CGI.`,
    p.interval === 'yearly'
      ? "L'abonnement annuel est reconduit automatiquement a chaque echeance. Nous vous rappellerons la date de renouvellement 45 jours avant."
      : "L'abonnement mensuel est sans engagement et resiliable a tout moment.",
    '',
    `Conditions generales de vente (version ${CGV_VERSION}) : ${p.appUrl}/cgu`,
    '',
    'DROIT DE RETRACTATION',
    `Vous disposez de 14 jours a compter de la souscription, soit jusqu'au ${frDate(p.withdrawalDeadline)}, pour vous retracter sans motif. Le plus simple : le bouton « Se retracter du contrat ici » de la page Facturation, ${billingUrl(p.appUrl)}. Toute declaration sans ambiguite (email a contact@thecosmo.app, courrier) est aussi acceptee, et le formulaire type figure dans les CGV.`,
    p.immediateAccessAt
      ? `Vous avez demande expressement l'acces immediat au service le ${frDateTime(p.immediateAccessAt)} et reconnu qu'en cas de retractation, la periode deja utilisee vous sera facturee au prorata. Nous vous confirmons cette demande.`
      : "En cas de retractation, le montant paye vous sera rembourse integralement.",
    'Le remboursement intervient au plus tard 14 jours apres la retractation, avec le meme moyen de paiement, sans frais.',
    '',
    ...SIGN,
  ]
  return toMail('Confirmation de votre abonnement COSMO', lines)
}

export function withdrawalAckMail(p: { orgName: string; withdrawnAt: string; amountCents: number }): BillingMail {
  const lines = [
    'Bonjour,',
    '',
    `Nous accusons reception de votre retractation du contrat d'abonnement COSMO Entreprise de l'organisation « ${p.orgName} », le ${frDateTime(p.withdrawnAt)} (heure de Paris).`,
    "L'abonnement est arrete.",
    `Montant qui vous sera rembourse : ${euros(p.amountCents)}, sur le moyen de paiement utilise, au plus tard 14 jours apres cette date, sans frais.`,
    '',
    ...SIGN,
  ]
  return toMail('Accuse de reception de votre retractation COSMO', lines)
}

export function refundDoneMail(p: { orgName: string; amountCents: number; refundedAt: string }): BillingMail {
  const lines = [
    'Bonjour,',
    '',
    `Nous avons rembourse ${euros(p.amountCents)} le ${frDate(p.refundedAt)} pour l'abonnement COSMO Entreprise de l'organisation « ${p.orgName} ».`,
    'Le montant apparait sous quelques jours ouvres sur le moyen de paiement utilise.',
    '',
    ...SIGN,
  ]
  return toMail('Votre remboursement COSMO', lines)
}

export function cancellationMail(p: { orgName: string; accessUntil: string; appUrl: string }): BillingMail {
  const lines = [
    'Bonjour,',
    '',
    `Nous confirmons la resiliation de l'abonnement COSMO Entreprise de l'organisation « ${p.orgName} ».`,
    `L'acces continue jusqu'au ${frDate(p.accessUntil)}, fin de la periode deja payee. Aucun prelevement n'aura lieu ensuite. Aucun remboursement n'est effectue.`,
    `Vous pouvez annuler cette resiliation jusqu'a cette date depuis la page Facturation : ${billingUrl(p.appUrl)}`,
    '',
    ...SIGN,
  ]
  return toMail('Confirmation de resiliation de votre abonnement COSMO', lines)
}

export function receiptMail(p: { orgName: string; amountCents: number; paidAt: number; appUrl: string; invoiceUrl?: string | null }): BillingMail {
  const lines = [
    'Bonjour,',
    '',
    `Nous avons recu votre paiement de ${euros(p.amountCents)} TTC le ${frDate(p.paidAt)} pour l'abonnement COSMO Entreprise de l'organisation « ${p.orgName} ». TVA non applicable, art. 293 B du CGI.`,
    ...(p.invoiceUrl ? [`Facture : ${p.invoiceUrl}`] : []),
    '',
    `Gerer / resilier mon abonnement : ${billingUrl(p.appUrl)}`,
    '',
    ...SIGN,
  ]
  return toMail('Recu de paiement COSMO', lines)
}
