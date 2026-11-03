// ═══════════════════════════════════════════════════════════════════
// Alerte 80 % des sièges (spec 2026-11-02 § 6.3) : sélection et texte.
// Module PUR, exécuté par vitest (`src/modules/billing/seat-alert-text.test.ts`).
// Point d'entrée : `supabase/functions/seat-alert/index.ts`.
// ═══════════════════════════════════════════════════════════════════
//
// Informatif, aucune promotion. Une alerte par palier : l'unicité vit en base
// (`org_seat_alerts`, mig. 240), pas ici.
//
// 🔴 SV-5 : le nom d'organisation est écrit par ses admins. Le gabarit
// (`billing-mail-layout.ts`) l'échappe dans le HTML ; ce module n'écrit
// jamais de HTML lui-même.

import { renderBillingMail, type BillingMail } from './billing-mail-layout.ts'
import { FREE_TIER_MAX_MEMBERS, ORG_TIERS, tierByKey, type OrgTier } from './org-tiers.ts'

/** Seuil d'alerte, en fraction du quota. */
export const SEAT_ALERT_RATIO = 0.8

/**
 * Quota effectif, miroir de `org_seats_allowed` (mig. 101) : un abonnement
 * non actif retombe au palier gratuit ; `null` = aucun plafond.
 */
export function effectiveSeatQuota(status: string | null, maxMembers: number | null): number | null {
  if (status !== 'active') return FREE_TIER_MAX_MEMBERS
  return maxMembers
}

/** Palier effectif, même règle : sans abonnement actif, c'est le gratuit. */
export function effectiveTierKey(status: string | null, tierKey: string | null): string {
  return status === 'active' && tierKey ? tierKey : 'free'
}

/** Vrai quand l'effectif atteint au moins 80 % du quota. Illimité exclu. */
export function shouldAlert(memberCount: number, quota: number | null): boolean {
  if (quota === null || !Number.isFinite(quota) || quota <= 0) return false
  if (!Number.isFinite(memberCount) || memberCount < 0) return false
  // Entiers des deux côtés : 4 sur 5 alerte, 7 sur 10 non, sans flottant.
  return memberCount * 10 >= quota * Math.round(SEAT_ALERT_RATIO * 10)
}

/** Le palier au-dessus, ou `undefined` pour le dernier. */
export function nextTier(key: string): OrgTier | undefined {
  const i = ORG_TIERS.findIndex((t) => t.key === key)
  return i >= 0 ? ORG_TIERS[i + 1] : undefined
}

function tierText(t: OrgTier): string {
  const size = t.maxMembers === null
    ? 'Illimité'
    : t.minMembers === 0
      ? `Jusqu'à ${t.maxMembers} membres`
      : `${t.minMembers} à ${t.maxMembers} membres`
  const price = t.priceEurPerMonth === 0 ? 'gratuit' : `${t.priceEurPerMonth} € TTC / mois`
  return `${size}, ${price}`
}

export function seatAlertMail(p: {
  orgName: string
  tierKey: string
  memberCount: number
  quota: number
  appUrl: string
}): BillingMail {
  const current = tierByKey(p.tierKey)
  const next = nextTier(p.tierKey)
  const rows: Array<[string, string]> = [
    ['Membres', `${p.memberCount} sur ${p.quota} places`],
    ...(current ? [['Palier actuel', tierText(current)] as [string, string]] : []),
    ...(next ? [['Palier suivant', tierText(next)] as [string, string]] : []),
  ]
  return renderBillingMail({
    subject: 'Votre équipe COSMO approche de sa limite de places',
    title: 'Votre équipe grandit',
    intro: `« ${p.orgName} » occupe ${p.memberCount} places sur ${p.quota}. Quand toutes sont prises, les nouvelles invitations attendent qu'une place se libère ou que le palier change.`,
    rows,
    cta: { label: 'Voir les paliers', url: `${p.appUrl}/entreprise/billing` },
    secondary: { label: 'Gérer les membres', url: `${p.appUrl}/entreprise/members` },
    legal: [
      "Cet e-mail est envoyé une seule fois, quand l'organisation franchit 80 % de ses places. Rien ne change sur votre abonnement sans votre accord.",
    ],
    orgName: p.orgName,
    appUrl: p.appUrl,
  })
}
