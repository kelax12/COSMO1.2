// `_shared/affiliation-api.ts` (routage, droits, corps, agrégats), module PUR exécuté ici,
// et l'index de `affiliation-api` lu comme texte pour ses interdits.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  COMMISSION_HOLD_DAYS, affiliateTotals, authorize, customerFacts, isCommissionSettled, monthlySeries, parseCreate, parsePatch, parsePayout,
  parseRoute, parseSettings, type CommissionRow, type ProfileRow,
} from '../supabase/functions/_shared/affiliation-api'

const ID = '11111111-2222-3333-4444-555555555555'
const P = '/functions/v1/affiliation-api'
const TODAY = new Date(Date.UTC(2026, 9, 31))

describe('routage', () => {
  it('reconnaît chaque route du contrat', () => {
    expect(parseRoute('POST', `${P}/session`)).toEqual({ name: 'session' })
    expect(parseRoute('POST', `/affiliation-api/click`)).toEqual({ name: 'click' })
    expect(parseRoute('GET', `${P}/overview`)).toEqual({ name: 'overview' })
    expect(parseRoute('GET', `${P}/affiliates/${ID}`)).toEqual({ name: 'profile', id: ID })
    expect(parseRoute('POST', `${P}/affiliates`)).toEqual({ name: 'create' })
    expect(parseRoute('PATCH', `${P}/affiliates/${ID}`)).toEqual({ name: 'patch', id: ID })
    expect(parseRoute('POST', `${P}/affiliates/${ID}/links`)).toEqual({ name: 'links', id: ID })
    expect(parseRoute('POST', `${P}/affiliates/${ID}/attach`)).toEqual({ name: 'attach', id: ID })
    expect(parseRoute('POST', `${P}/affiliates/${ID}/payouts`)).toEqual({ name: 'payout', id: ID })
    expect(parseRoute('GET', `${P}/slugs/julien`)).toEqual({ name: 'slug', id: 'julien' })
    expect(parseRoute('PUT', `${P}/contacts/${ID}`)).toEqual({ name: 'contact', id: ID })
    expect(parseRoute('GET', `${P}/settings`)).toEqual({ name: 'settings_get' })
    expect(parseRoute('PUT', `${P}/settings`)).toEqual({ name: 'settings_put' })
  })

  it('refuse le reste', () => {
    expect(parseRoute('GET', P)).toBeNull()
    expect(parseRoute('GET', `${P}/session`)).toBeNull()
    expect(parseRoute('GET', `${P}/affiliates/pas-un-uuid`)).toBeNull()
    expect(parseRoute('DELETE', `${P}/affiliates/${ID}`)).toBeNull()
  })
})

describe('droits', () => {
  it('session et click publics, settings et attach admin seulement', () => {
    expect(authorize('session', null)).toBe('ok')
    expect(authorize('click', null)).toBe('ok')
    expect(authorize('overview', null)).toBe('unauthorized')
    expect(authorize('overview', 'code')).toBe('ok')
    for (const r of ['settings_get', 'settings_put', 'attach'] as const) {
      expect(authorize(r, 'code')).toBe('forbidden')
      expect(authorize(r, 'admin')).toBe('ok')
    }
  })
})

describe('corps', () => {
  it('création : slug et email validés', () => {
    expect(parseCreate({ name: 'Julien', email: 'j@x.fr', phone: null, slug: 'julien' })).toMatchObject({ slug: 'julien' })
    expect(parseCreate({ name: 'Julien', email: 'j@x.fr', phone: null, slug: 'Julien!' })).toBeNull()
    expect(parseCreate({ name: 'Julien', email: 'pas-un-mail', phone: null, slug: 'julien' })).toBeNull()
  })
  it('patch : aucune clé hors fiche', () => {
    expect(parsePatch({ notes: 'ok' })).toEqual({ notes: 'ok' })
    expect(parsePatch({ archived_at: 'x' })).toBeNull()
    expect(parsePatch({})).toBeNull()
  })
  it('versement : montant positif entier, date jour', () => {
    expect(parsePayout({ amount_cents: 1000, paid_on: '2026-10-31', method: 'virement', note: null })).not.toBeNull()
    expect(parsePayout({ amount_cents: -1, paid_on: '2026-10-31', method: 'v', note: null })).toBeNull()
    expect(parsePayout({ amount_cents: 1.5, paid_on: '2026-10-31', method: 'v', note: null })).toBeNull()
    expect(parsePayout({ amount_cents: 1, paid_on: '31/10/2026', method: 'v', note: null })).toBeNull()
  })
  it('réglages : taux bornés, code optionnel et assez long', () => {
    const base = { commission_bp: 5000, deduction_bp: 2560, fee_bp: 150, fee_fixed_cents: 25, vat_bp: 0 }
    expect(parseSettings(base)).toEqual(base)
    expect(parseSettings({ ...base, commission_bp: 10001 })).toBeNull()
    expect(parseSettings({ ...base, code: 'court' })).toBeNull()
    expect(parseSettings({ ...base, code: 'assez-long' })).toEqual({ ...base, code: 'assez-long' })
  })
})

describe('agrégats', () => {
  const profile: ProfileRow = { id: ID, display_name: 'Bea', email: 'b@x.fr', affiliate_id: 'A', affiliated_at: '2026-01-10T00:00:00Z' }
  const comm = (at: string, gross: number, base: number, c: number): CommissionRow =>
    ({ affiliate_id: 'A', customer_id: ID, gross_cents: gross, base_cents: base, commission_cents: c, occurred_at: at })

  it('un Premium mensuel actif : statut, LTV, MRR, rétention', () => {
    const commissions = [comm('2026-02-01T00:00:00Z', 1000, 960, 379), comm('2026-03-01T00:00:00Z', 1000, 960, 379)]
    const f = customerFacts(profile, { premium: { user_id: ID, plan: 'monthly', status: 'active', updated_at: '2026-02-01T00:00:00Z' }, commissions }, TODAY)
    expect(f.customer).toMatchObject({ status: 'active', premium: 'monthly', org_tier: null, ltv_cents: 2000, commission_cents: 758, retention_months: 8 })
    const t = affiliateTotals([f], commissions, [{ id: 'p', affiliate_id: 'A', amount_cents: 500, paid_on: '2026-10-01', method: 'v', note: null, created_by: 'admin', created_at: '' }], 3950)
    expect(t).toMatchObject({ active: 1, total: 1, stopped: 0, mrr_net_cents: 960, mrr_cents: 379, earned_cents: 758, paid_cents: 500, due_cents: 258 })
  })

  it('retenue de 14 jours : une commission récente est en attente, hors reste à payer ; un remboursement se déduit tout de suite', () => {
    const today = new Date('2026-11-01T12:00:00Z')
    const commissions = [
      comm('2026-10-01T00:00:00Z', 1000, 960, 379), // versable
      comm('2026-10-25T00:00:00Z', 1000, 960, 379), // en attente (7 jours)
      comm('2026-10-28T00:00:00Z', -1000, -960, -379), // remboursement : déduit
    ]
    const t = affiliateTotals([], commissions, [], 3950, today)
    expect(t.pending_cents).toBe(379)
    expect(t.due_cents).toBe(0)
    expect(t.earned_cents).toBe(379)
  })

  it('retenue de 14 jours : avant, à la limite, après', () => {
    expect(COMMISSION_HOLD_DAYS).toBe(14)
    const today = new Date('2026-11-15T12:00:00Z')
    const at = (iso: string) => ({ commission_cents: 717, occurred_at: iso })
    expect(isCommissionSettled(at('2026-11-01T12:00:01Z'), today)).toBe(false) // 13 j 23 h 59 min 59 s
    expect(isCommissionSettled(at('2026-11-01T12:00:00Z'), today)).toBe(true) // 14 j pile
    expect(isCommissionSettled(at('2026-10-31T12:00:00Z'), today)).toBe(true) // 15 j
    expect(isCommissionSettled({ commission_cents: -359, occurred_at: '2026-11-15T11:00:00Z' }, today)).toBe(true)
  })

  it('jamais payé, jamais souscrit : compté dans total, absent des affiliés', () => {
    const f = customerFacts(profile, { commissions: [] }, TODAY)
    expect(f.customer).toBeNull()
    expect(affiliateTotals([f], [], [], 3950)).toMatchObject({ total: 1, active: 0, stopped: 0 })
  })

  it('unpaid devient past_due, compté arrêté', () => {
    const f = customerFacts(profile, { premium: { user_id: ID, plan: 'yearly', status: 'unpaid', updated_at: '2026-06-01T00:00:00Z' }, commissions: [comm('2026-02-01T00:00:00Z', 12000, 11800, 4661)] }, TODAY)
    expect(f.customer?.status).toBe('past_due')
    expect(f.activeNetMonthlyCents).toBe(0)
  })

  it('série mensuelle : 12 mois, le mois courant en dernier', () => {
    const s = monthlySeries([comm('2026-10-05T00:00:00Z', 0, 0, 300), comm('2025-01-01T00:00:00Z', 0, 0, 999)], TODAY)
    expect(s).toHaveLength(12)
    expect(s[0].month).toBe('2025-11')
    expect(s[11]).toEqual({ month: '2026-10', commission_cents: 300 })
  })
})

describe('index de affiliation-api (texte)', () => {
  const src = readFileSync('supabase/functions/affiliation-api/index.ts', 'utf8')
  it('ne journalise jamais un corps de requête', () => {
    expect(src).not.toMatch(/console\.(log|info|warn|error|debug)\([^)]*(body|payload|req\.json)/)
  })
  it('plafonds par IP : 5 codes / 15 min, 60 clics / h', () => {
    expect(src).toContain('callerIp(req)')
    expect(src).toMatch(/limit:\s*5,\s*window:\s*'15 minutes'/)
    expect(src).toMatch(/limit:\s*60,\s*window:\s*'1 hour'/)
    expect(src).toMatch(/'affiliation-session-global', value: 'all', limit: 200/)
  })
  it('changer le code régénère token_secret', () => {
    expect(src).toMatch(/token_secret:\s*newTokenSecret\(\)/)
  })
  it('admin jugé par is_admin(), jamais par admin_allowlisted()', () => {
    expect(src).toContain("rpc('is_admin')")
    expect(src).not.toContain('admin_allowlisted')
  })
})
