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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

export function renewalNoticeMail(org: RenewalNoticeOrg, appUrl: string): { subject: string; text: string; html: string } {
  const date = frenchDate(org.period_end)
  const lastDay = frenchDate(dayBefore(org.period_end))
  const manage = `${appUrl}/entreprise?tab=billing`
  const tier = org.tier_key ? tierByKey(org.tier_key) : undefined
  const amount = tier ? `${yearlyTotalEur(tier.priceEurPerMonth).toFixed(2).replace('.', ',')} € TTC` : null

  const box = [
    `Votre abonnement sera renouvele automatiquement le ${date}${amount ? `, pour un montant de ${amount}` : ''}.`,
    `Vous pouvez refuser ce renouvellement en resiliant depuis la page Facturation, jusqu'au ${lastDay} inclus : ${manage}`,
    `Sans resiliation, le montant sera preleve le ${date}.`,
  ]
  const before = [
    `Bonjour,`,
    ``,
    `Conformement a l'article L215-1 du Code de la consommation, voici le rappel de renouvellement de l'abonnement COSMO Entreprise de l'organisation « ${org.org_name} ».`,
    ``,
  ]
  const after = [
    ``,
    `La resiliation prend effet au terme de la periode deja payee, sans frais ni justification.`,
    ``,
    `L'equipe COSMO`,
    `contact@thecosmo.app`,
  ]
  const lines = [...before, ...box.map((l) => `> ${l}`), ...after]
  const para = (l: string) => (l === '' ? '<br>' : `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`)
  return {
    subject: `Votre abonnement COSMO sera renouvelé le ${date}`,
    text: lines.join('\n'),
    html:
      before.map(para).join('')
      + `<div style="border:2px solid #111;border-radius:8px;padding:12px 16px;margin:8px 0">${box.map((l) => `<p style="margin:0 0 8px"><strong>${escapeHtml(l)}</strong></p>`).join('')}</div>`
      + after.map(para).join(''),
  }
}
