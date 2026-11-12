// ═══════════════════════════════════════════════════════════════════
// Routage, validation et agrégats de `affiliation-api`
// Module PUR, exécuté par vitest (`src/affiliation-api.guard.test.ts`).
// ═══════════════════════════════════════════════════════════════════
//
// L'index ne fait que lire les tables 236 et appeler ces fonctions : tout ce
// qui décide d'une forme de réponse, d'un droit ou d'un montant vit ici.
// Formes : `src/affiliation/types.ts` de cosmo-analytics, à l'identique.

import { affiliateStatus, amountDueCents, retentionMonths, type AffiliateStatus } from './affiliation-metrics.ts'

export const SLUG_RE = /^[a-z0-9-]{2,40}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// ── Routage ──────────────────────────────────────────────────────────

export type RouteName =
  | 'session' | 'click' | 'overview' | 'profile' | 'create' | 'patch' | 'links'
  | 'slug' | 'contact' | 'attach' | 'payout' | 'settings_get' | 'settings_put'

export interface Route { name: RouteName; id?: string }

export const PUBLIC_ROUTES: ReadonlySet<RouteName> = new Set(['session', 'click'])
export const ADMIN_ROUTES: ReadonlySet<RouteName> = new Set(['attach', 'settings_get', 'settings_put'])

/** `pathname` complet (`/functions/v1/affiliation-api/…` ou `/affiliation-api/…`). */
export function parseRoute(method: string, pathname: string): Route | null {
  const at = pathname.indexOf('/affiliation-api')
  if (at < 0) return null
  const parts = pathname.slice(at + '/affiliation-api'.length).split('/').filter(Boolean).map(decodeURIComponent)
  const [a, b, c] = parts
  const key = `${method} ${a ?? ''}${parts.length > 1 ? '/:' : ''}${c ? `/${c}` : ''}`
  const uuid = (v: string | undefined) => (v && UUID_RE.test(v) ? v : undefined)
  switch (key) {
    case 'POST session': return parts.length === 1 ? { name: 'session' } : null
    case 'POST click': return parts.length === 1 ? { name: 'click' } : null
    case 'GET overview': return parts.length === 1 ? { name: 'overview' } : null
    case 'POST affiliates': return parts.length === 1 ? { name: 'create' } : null
    case 'GET settings': return parts.length === 1 ? { name: 'settings_get' } : null
    case 'PUT settings': return parts.length === 1 ? { name: 'settings_put' } : null
    case 'GET affiliates/:': return uuid(b) ? { name: 'profile', id: b } : null
    case 'PATCH affiliates/:': return uuid(b) ? { name: 'patch', id: b } : null
    case 'POST affiliates/:/links': return uuid(b) ? { name: 'links', id: b } : null
    case 'POST affiliates/:/attach': return uuid(b) ? { name: 'attach', id: b } : null
    case 'POST affiliates/:/payouts': return uuid(b) ? { name: 'payout', id: b } : null
    case 'GET slugs/:': return parts.length === 2 ? { name: 'slug', id: b } : null
    case 'PUT contacts/:': return uuid(b) ? { name: 'contact', id: b } : null
    default: return null
  }
}

export type Role = 'admin' | 'code'

/** Qui peut appeler quoi. `null` : non authentifié. */
export function authorize(route: RouteName, role: Role | null): 'ok' | 'unauthorized' | 'forbidden' {
  if (PUBLIC_ROUTES.has(route)) return 'ok'
  if (!role) return 'unauthorized'
  if (ADMIN_ROUTES.has(route) && role !== 'admin') return 'forbidden'
  return 'ok'
}

// ── Validation des corps ─────────────────────────────────────────────

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max
const optStr = (v: unknown, max: number) => v === null || (typeof v === 'string' && v.length <= max)
const email = (v: unknown) => str(v, 320) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v as string)
const bp = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 10000

export interface CreateBody { name: string; email: string; phone: string | null; slug: string }
export function parseCreate(v: unknown): CreateBody | null {
  if (!isObj(v) || !str(v.name, 200) || !email(v.email) || !optStr(v.phone ?? null, 40)) return null
  if (typeof v.slug !== 'string' || !SLUG_RE.test(v.slug)) return null
  return { name: (v.name as string).trim(), email: (v.email as string).trim(), phone: (v.phone as string | null) ?? null, slug: v.slug }
}

export type PatchBody = Partial<{ name: string; email: string; phone: string | null; notes: string | null }>
export function parsePatch(v: unknown): PatchBody | null {
  if (!isObj(v)) return null
  const out: PatchBody = {}
  for (const k of Object.keys(v)) {
    if (k === 'name') { if (!str(v.name, 200)) return null; out.name = (v.name as string).trim() }
    else if (k === 'email') { if (!email(v.email)) return null; out.email = (v.email as string).trim() }
    else if (k === 'phone') { if (!optStr(v.phone, 40)) return null; out.phone = v.phone as string | null }
    else if (k === 'notes') { if (!optStr(v.notes, 5000)) return null; out.notes = v.notes as string | null }
    else return null
  }
  return Object.keys(out).length ? out : null
}

export interface ContactBody { name: string; email: string; phone: string | null }
export function parseContact(v: unknown): ContactBody | null {
  if (!isObj(v) || !str(v.name, 200) || !email(v.email) || !optStr(v.phone ?? null, 40)) return null
  return { name: (v.name as string).trim(), email: (v.email as string).trim(), phone: (v.phone as string | null) ?? null }
}

export interface PayoutBody { amount_cents: number; paid_on: string; method: string; note: string | null }
export function parsePayout(v: unknown): PayoutBody | null {
  if (!isObj(v) || !Number.isInteger(v.amount_cents) || (v.amount_cents as number) <= 0) return null
  if ((v.amount_cents as number) > 100_000_000) return null
  if (typeof v.paid_on !== 'string' || !DATE_RE.test(v.paid_on) || Number.isNaN(Date.parse(v.paid_on))) return null
  if (!str(v.method, 100) || !optStr(v.note ?? null, 2000)) return null
  return { amount_cents: v.amount_cents as number, paid_on: v.paid_on, method: (v.method as string).trim(), note: (v.note as string | null) ?? null }
}

export interface SettingsBody { commission_bp: number; deduction_bp: number; fee_bp: number; fee_fixed_cents: number; vat_bp: number; code?: string }
export const MIN_CODE_LENGTH = 8
export function parseSettings(v: unknown): SettingsBody | null {
  if (!isObj(v) || !bp(v.commission_bp) || !bp(v.deduction_bp) || !bp(v.fee_bp) || !bp(v.vat_bp)) return null
  if (!Number.isInteger(v.fee_fixed_cents) || (v.fee_fixed_cents as number) < 0 || (v.fee_fixed_cents as number) > 10000) return null
  const out: SettingsBody = {
    commission_bp: v.commission_bp as number, deduction_bp: v.deduction_bp as number, fee_bp: v.fee_bp as number,
    fee_fixed_cents: v.fee_fixed_cents as number, vat_bp: v.vat_bp as number,
  }
  if (v.code !== undefined) {
    if (typeof v.code !== 'string' || v.code.length < MIN_CODE_LENGTH || v.code.length > 200) return null
    out.code = v.code
  }
  return out
}

// ── Agrégats ─────────────────────────────────────────────────────────

export type CustomerStatus = 'active' | 'past_due' | 'cancelled'
export type OrgTier = 't10' | 't20' | 't50' | 'tmax'
export type PremiumPlan = 'monthly' | 'yearly'

export interface ProfileRow { id: string; display_name: string | null; email: string | null; affiliate_id: string; affiliated_at: string }
export interface ContactRow { user_id: string; name: string | null; email: string | null; phone: string | null }
export interface PremiumRow { user_id: string; plan: string; status: string; updated_at: string | null }
export interface OrgSubRow { purchased_by: string; tier_key: string; status: string; billing_interval: string | null; updated_at: string | null }
export interface CommissionRow { affiliate_id: string; customer_id: string | null; gross_cents: number; base_cents: number; commission_cents: number; occurred_at: string }
export interface PayoutRow { id: string; affiliate_id: string; amount_cents: number; paid_on: string; method: string | null; note: string | null; created_by: 'admin' | 'code'; created_at: string }
export interface LinkRow { slug: string; affiliate_id: string; created_at: string }

export interface Customer {
  user_id: string; name: string; email: string; phone: string | null
  premium: PremiumPlan | null; org_tier: OrgTier | null; status: CustomerStatus
  status_since: string; signed_up_at: string
  ltv_cents: number; retention_months: number; commission_cents: number
}

/** Un affilié B avec ce qu'il faut pour les sommes de son affiliateur. */
export interface CustomerFacts { customer: Customer | null; activeNetMonthlyCents: number }

const TIERS = new Set(['t10', 't20', 't50', 'tmax'])
const STATUS_MAP: Record<AffiliateStatus, CustomerStatus> = { active: 'active', failed: 'past_due', cancelled: 'cancelled' }

/**
 * Fiche d'un B. `customer` est null tant qu'il n'a jamais payé ni souscrit :
 * il compte dans `total`, mais le contrat n'a pas de statut « gratuit ».
 * L'abonnement suivi est le Premium s'il en a un, sinon l'org qu'il paie.
 */
export function customerFacts(
  p: ProfileRow,
  input: { contact?: ContactRow; premium?: PremiumRow; org?: OrgSubRow; commissions: CommissionRow[] },
  today = new Date(),
): CustomerFacts {
  const premiumPlan = input.premium && (input.premium.plan === 'monthly' || input.premium.plan === 'yearly') ? input.premium.plan : null
  const orgTier = input.org && TIERS.has(input.org.tier_key) ? (input.org.tier_key as OrgTier) : null
  const sub = premiumPlan ? input.premium! : orgTier ? input.org! : null
  const paid = input.commissions.filter((c) => c.commission_cents > 0 || c.gross_cents > 0)
  const st = affiliateStatus({ subscriptionStatus: sub?.status ?? null, paidCount: paid.length })
  if (!st) return { customer: null, activeNetMonthlyCents: 0 }

  const sorted = [...paid].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
  const firstPaid = sorted[0]?.occurred_at ?? null
  const lastPaid = sorted[sorted.length - 1]
  const statusSince = sub?.updated_at ?? lastPaid?.occurred_at ?? p.affiliated_at
  const yearly = premiumPlan ? premiumPlan === 'yearly' : input.org?.billing_interval === 'yearly'
  const net = st === 'active' && lastPaid ? (yearly ? lastPaid.base_cents / 12 : lastPaid.base_cents) : 0

  const c = input.contact
  return {
    activeNetMonthlyCents: net,
    customer: {
      user_id: p.id,
      name: c?.name ?? p.display_name ?? '',
      email: c?.email ?? p.email ?? '',
      phone: c?.phone ?? null,
      premium: premiumPlan,
      org_tier: orgTier,
      status: STATUS_MAP[st],
      status_since: statusSince,
      signed_up_at: p.affiliated_at,
      ltv_cents: input.commissions.reduce((s, x) => s + x.gross_cents, 0),
      retention_months: retentionMonths(firstPaid, st === 'active' ? null : statusSince, today),
      commission_cents: input.commissions.reduce((s, x) => s + x.commission_cents, 0),
    },
  }
}

export interface AffiliateTotals {
  active: number; total: number; stopped: number; ltv_cents: number; retention_months: number
  mrr_cents: number; mrr_net_cents: number; earned_cents: number; paid_cents: number; due_cents: number
  /** Commissions positives de moins de 14 jours : « en attente », hors reste à payer. */
  pending_cents: number
}

/**
 * Retenue de 14 jours (REMBOURSEMENT-RESILIATION.md §9) : une commission ne
 * devient versable que 14 jours après le paiement, le temps du délai de
 * rétractation. Une commission NÉGATIVE (remboursement) se déduit tout de
 * suite : la retenir gonflerait le reste à payer.
 */
export const COMMISSION_HOLD_DAYS = 14

export function isCommissionSettled(c: Pick<CommissionRow, 'commission_cents' | 'occurred_at'>, today: Date): boolean {
  if (c.commission_cents <= 0) return true
  return Date.parse(c.occurred_at) <= today.getTime() - COMMISSION_HOLD_DAYS * 24 * 3600 * 1000
}

export function affiliateTotals(
  facts: CustomerFacts[], commissions: CommissionRow[], payouts: PayoutRow[], rateBp: number, today = new Date(),
): AffiliateTotals {
  const customers = facts.map((f) => f.customer).filter((c): c is Customer => c !== null)
  const net = facts.reduce((s, f) => s + f.activeNetMonthlyCents, 0)
  const earned = commissions.map((c) => c.commission_cents)
  const settled = commissions.filter((c) => isCommissionSettled(c, today)).map((c) => c.commission_cents)
  const pending = commissions.filter((c) => !isCommissionSettled(c, today)).reduce((s, c) => s + c.commission_cents, 0)
  const paid = payouts.map((p) => p.amount_cents)
  const retention = customers.length ? customers.reduce((s, c) => s + c.retention_months, 0) / customers.length : 0
  return {
    active: customers.filter((c) => c.status === 'active').length,
    total: facts.length,
    stopped: customers.filter((c) => c.status !== 'active').length,
    ltv_cents: customers.reduce((s, c) => s + c.ltv_cents, 0),
    retention_months: Math.round(retention * 10) / 10,
    mrr_cents: Math.round((net * rateBp) / 10000),
    mrr_net_cents: Math.round(net),
    earned_cents: earned.reduce((a, b) => a + b, 0),
    paid_cents: paid.reduce((a, b) => a + b, 0),
    due_cents: amountDueCents(settled, paid),
    pending_cents: pending,
  }
}

/** 12 mois, du plus ancien au mois en cours (UTC). */
export function monthlySeries(commissions: CommissionRow[], today = new Date()): Array<{ month: string; commission_cents: number }> {
  const out: Array<{ month: string; commission_cents: number }> = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1))
    out.push({ month: d.toISOString().slice(0, 7), commission_cents: 0 })
  }
  const idx = new Map(out.map((m, i) => [m.month, i]))
  for (const c of commissions) {
    const i = idx.get(c.occurred_at.slice(0, 7))
    if (i !== undefined) out[i].commission_cents += c.commission_cents
  }
  return out
}

export function toPayout(p: PayoutRow) {
  return { id: p.id, amount_cents: p.amount_cents, paid_on: p.paid_on, method: p.method ?? '', note: p.note, created_by: p.created_by }
}

/** Liens du plus récent au plus ancien, avec leurs clics. */
export function linksWithClicks(links: LinkRow[], clicks: Map<string, number>) {
  return [...links]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((l) => ({ slug: l.slug, created_at: l.created_at, clicks: clicks.get(l.slug) ?? 0 }))
}
