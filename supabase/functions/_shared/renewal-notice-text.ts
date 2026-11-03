// ═══════════════════════════════════════════════════════════════════
// Texte de l'avis de reconduction L215-1 (`renewal-notice`). Module PUR,
// exécuté par vitest (`src/edge-audit-serveur.guard.test.ts`).
// ═══════════════════════════════════════════════════════════════════
//
// REMBOURSEMENT-RESILIATION.md §5 (2026-11-01) : email DÉDIÉ (aucune
// promotion), envoyé à J-45, objet clair, et un encadré qui dit la date, le
// montant, comment refuser le renouvellement et jusqu'à quand (la veille).
//
// 🔴 SV-5 (audit serveur du 2026-10-24) : le nom d'organisation est écrit par
// n'importe quel admin et l'avis part au PROPRIÉTAIRE, signé par notre
// domaine. Le HTML est donc échappé.
import { tierByKey, yearlyTotalEur } from './org-tiers.ts'
import { renderBillingMail } from './billing-mail-layout.ts'

export interface RenewalNoticeOrg {
  org_name: string
  period_end: string
  tier_key?: string
}

export function frenchDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** La veille d'une date ISO (AAAA-MM-JJ), dernier jour pour résilier. */
export function dayBefore(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function renewalNoticeMail(org: RenewalNoticeOrg, appUrl: string): { subject: string; text: string; html: string } {
  const date = frenchDate(org.period_end)
  const lastDay = frenchDate(dayBefore(org.period_end))
  const manage = `${appUrl}/entreprise?tab=billing`
  const tier = org.tier_key ? tierByKey(org.tier_key) : undefined
  const amount = tier ? `${yearlyTotalEur(tier.priceEurPerMonth).toFixed(2).replace('.', ',')} € TTC` : null
  const range = tier ? (tier.maxMembers === null ? 'Illimité' : `${tier.minMembers} à ${tier.maxMembers} membres`) : null

  return renderBillingMail({
    subject: `Votre abonnement COSMO sera renouvelé le ${date}`,
    title: 'Renouvellement dans 45 jours',
    intro: `L'abonnement annuel de « ${org.org_name} » sera reconduit automatiquement le ${date}. Rien à faire si vous souhaitez continuer.`,
    rows: [
      ['Renouvellement', date],
      ...(amount ? [['Montant débité', `${amount} pour un an`] as [string, string]] : []),
      ...(range ? [['Palier', range] as [string, string]] : []),
    ],
    cta: { label: 'Gérer mon abonnement', url: manage },
    secondary: { label: `Résilier avant le ${lastDay} inclus`, url: manage },
    legal: [
      `Conformément à l'article L215-1 du Code de la consommation, voici le rappel de renouvellement de l'abonnement COSMO Entreprise de l'organisation « ${org.org_name} ».`,
      `Votre abonnement sera renouvelé automatiquement le ${date}${amount ? `, pour un montant de ${amount}` : ''}.`,
      `Vous pouvez refuser ce renouvellement en résiliant depuis la page Facturation, jusqu'au ${lastDay} inclus : ${manage}`,
      `Sans résiliation, le montant sera prélevé le ${date}.`,
      'La résiliation prend effet au terme de la période déjà payée, sans frais ni justification.',
    ],
    orgName: org.org_name,
    appUrl,
  })
}
