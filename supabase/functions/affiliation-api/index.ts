// ═══════════════════════════════════════════════════════════════════
// API affiliation (mig. 236), seul client : cosmo-analytics
// Spec : docs/AFFILIATION.md de cosmo-analytics ; contrat : son
// `src/affiliation/types.ts`. Routage, droits, corps et agrégats :
// `_shared/affiliation-api.ts`, testé par `src/affiliation-api.guard.test.ts`.
//
// ── AUTORISATION ────────────────────────────────────────────────────
//
// `verify_jwt = false` : la fonction juge elle-même l'appelant.
//   · `X-Affiliation-Token` : jeton du code commun (`_shared/affiliation-token.ts`),
//     signé par `affiliate_settings.token_secret` ;
//   · sinon `Authorization` : JWT dont `is_admin()` est vrai (allowlist + aal2),
//     évalué SOUS ce JWT, jamais sous service_role.
// `/session` et `/click` sont publics, plafonnés par IP (`callerIp`).
// Les tables 236 n'ont aucune policy : tout passe par service_role, APRÈS la garde.
//
// ❌ Aucun corps de requête n'est journalisé (codes, noms, e-mails, téléphones).
// ⚠️ Une lecture qui échoue rend 503, jamais une réponse vide.
// ═══════════════════════════════════════════════════════════════════
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { consumeRateLimits, callerIp } from '../_shared/rate-limit.ts'
import { signAffiliateToken, verifyAffiliateToken, AFFILIATE_TOKEN_TTL_MS } from '../_shared/affiliation-token.ts'
import { hashAffiliateCode, verifyAffiliateCode } from '../_shared/affiliation-code.ts'
import {
  SLUG_RE, affiliateTotals, authorize, customerFacts, linksWithClicks, monthlySeries, parseContact,
  parseCreate, parsePatch, parsePayout, parseRoute, parseSettings, toPayout,
  type CommissionRow, type ContactRow, type CustomerFacts, type LinkRow, type OrgSubRow,
  type PayoutRow, type PremiumRow, type ProfileRow, type Role,
} from '../_shared/affiliation-api.ts'

const FN = 'affiliation-api'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get('AFFILIATION_ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
)

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-affiliation-token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
    'Vary': 'Origin',
  }
  if (ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function json(body: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeadersFor(req) } })
}
const noContent = (req: Request) => new Response(null, { status: 204, headers: corsHeadersFor(req) })
const unavailable = (req: Request) => json({ error: 'unavailable' }, 503, req)

function newTokenSecret(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function readBody(req: Request): Promise<unknown> {
  try { return await req.json() } catch { return undefined }
}

class ReadError extends Error {}
function must<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw new ReadError()
  return r.data as T
}

interface Settings {
  commission_bp: number; fee_bp: number; fee_fixed_cents: number; vat_bp: number
  code_hash: string | null; token_secret: string; code_changed_at: string | null
}

async function loadSettings(db: SupabaseClient): Promise<Settings> {
  return must(await db.from('affiliate_settings').select('*').eq('id', true).single()) as Settings
}

function settingsResponse(s: Settings) {
  return {
    commission_bp: s.commission_bp, fee_bp: s.fee_bp, fee_fixed_cents: s.fee_fixed_cents, vat_bp: s.vat_bp,
    code_set: s.code_hash !== null, code_changed_at: s.code_changed_at,
  }
}

/** Qui appelle : `code`, `admin`, ou personne. Lève sur une panne de lecture. */
async function resolveRole(req: Request, settings: Settings): Promise<Role | null> {
  const token = req.headers.get('X-Affiliation-Token')
  if (token) return (await verifyAffiliateToken(token, settings.token_secret)) ? 'code' : null
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  const asUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
  const { data, error } = await asUser.rpc('is_admin')
  // Clé anon ou JWT invalide : PostgREST refuse (401/403) ; ce n'est pas un admin.
  if (error) {
    if (error.code === 'PGRST301' || error.code === '42501' || /JWT/i.test(error.message)) return null
    throw new ReadError()
  }
  return data === true ? 'admin' : null
}

// ── Données d'un ou de tous les affiliateurs ─────────────────────────

interface Dataset {
  links: LinkRow[]
  clicks: Map<string, number>
  facts: Map<string, CustomerFacts[]>
  commissions: Map<string, CommissionRow[]>
  payouts: Map<string, PayoutRow[]>
}

function groupBy<T>(rows: T[], key: (r: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const r of rows) {
    const k = key(r)
    if (k === null) continue
    const list = out.get(k)
    if (list) list.push(r)
    else out.set(k, [r])
  }
  return out
}

async function loadDataset(db: SupabaseClient, affiliateIds: string[]): Promise<Dataset> {
  const [links, profiles, commissions, payouts] = await Promise.all([
    db.from('affiliate_links').select('slug, affiliate_id, created_at').in('affiliate_id', affiliateIds),
    db.from('profiles').select('id, display_name, email, affiliate_id, affiliated_at').in('affiliate_id', affiliateIds),
    db.from('affiliate_commissions').select('affiliate_id, customer_id, gross_cents, base_cents, commission_cents, occurred_at').in('affiliate_id', affiliateIds),
    db.from('affiliate_payouts').select('*').in('affiliate_id', affiliateIds).order('paid_on', { ascending: false }).order('created_at', { ascending: false }),
  ]).then((rs) => rs.map(must)) as [LinkRow[], ProfileRow[], CommissionRow[], PayoutRow[]]

  const userIds = profiles.map((p) => p.id)
  const slugs = links.map((l) => l.slug)
  const [contacts, premiums, orgs, clickRows] = await Promise.all([
    userIds.length ? db.from('affiliate_contacts').select('user_id, name, email, phone').in('user_id', userIds) : { data: [], error: null },
    userIds.length ? db.from('subscriptions').select('user_id, plan, status, updated_at').in('user_id', userIds) : { data: [], error: null },
    userIds.length ? db.from('org_subscriptions').select('purchased_by, tier_key, status, billing_interval, updated_at').in('purchased_by', userIds) : { data: [], error: null },
    slugs.length ? db.from('affiliate_clicks').select('slug').in('slug', slugs) : { data: [], error: null },
  ]).then((rs) => rs.map(must)) as [ContactRow[], PremiumRow[], OrgSubRow[], { slug: string }[]]

  const clicks = new Map<string, number>()
  for (const c of clickRows) clicks.set(c.slug, (clicks.get(c.slug) ?? 0) + 1)
  const byCustomer = groupBy(commissions, (c) => c.customer_id)
  const contactOf = new Map(contacts.map((c) => [c.user_id, c]))
  const premiumOf = new Map(premiums.map((p) => [p.user_id, p]))
  const orgOf = new Map(orgs.map((o) => [o.purchased_by, o]))

  const facts = new Map<string, CustomerFacts[]>()
  for (const p of profiles) {
    const f = customerFacts(p, {
      contact: contactOf.get(p.id), premium: premiumOf.get(p.id), org: orgOf.get(p.id),
      commissions: byCustomer.get(p.id) ?? [],
    })
    const list = facts.get(p.affiliate_id)
    if (list) list.push(f)
    else facts.set(p.affiliate_id, [f])
  }
  return {
    links, clicks, facts,
    commissions: groupBy(commissions, (c) => c.affiliate_id),
    payouts: groupBy(payouts, (p) => p.affiliate_id),
  }
}

// ── Routes ───────────────────────────────────────────────────────────

async function handleSession(req: Request, db: SupabaseClient): Promise<Response> {
  // Un jeton par tentative, AVANT la vérification : un IP bloquée ne peut plus
  // apprendre qu'un code est bon. Le compteur RPC ne rend pas son reste.
  const verdict = await consumeRateLimits(FN, [{ domain: 'affiliation-session', value: callerIp(req), limit: 5, window: '15 minutes' }])
  if (!verdict.allowed) {
    if (verdict.misconfigured) return unavailable(req)
    return json({ error: 'rate_limited', retry_after_s: 900 }, 429, req)
  }
  const body = await readBody(req) as { code?: unknown } | undefined
  const code = typeof body?.code === 'string' ? body.code : ''
  const settings = await loadSettings(db)
  if (!(await verifyAffiliateCode(code, settings.code_hash))) return json({ error: 'invalid_code' }, 401, req)
  const now = Date.now()
  return json({ token: await signAffiliateToken(settings.token_secret, now), expires_at: new Date(now + AFFILIATE_TOKEN_TTL_MS).toISOString() }, 200, req)
}

async function handleClick(req: Request, db: SupabaseClient): Promise<Response> {
  const verdict = await consumeRateLimits(FN, [{ domain: 'affiliation-click', value: callerIp(req), limit: 60, window: '1 hour' }])
  if (!verdict.allowed) return noContent(req)
  const body = await readBody(req) as { slug?: unknown } | undefined
  const slug = typeof body?.slug === 'string' && SLUG_RE.test(body.slug) ? body.slug : null
  if (!slug) return noContent(req)
  const { data } = await db.from('affiliate_links').select('slug').eq('slug', slug).maybeSingle()
  // Toujours 204 : un échec d'écriture ne coûte qu'un clic au compteur.
  if (data) await db.from('affiliate_clicks').insert({ slug })
  return noContent(req)
}

async function handleOverview(req: Request, db: SupabaseClient, settings: Settings): Promise<Response> {
  const affiliates = must(await db.from('affiliates').select('id, name, created_at').is('archived_at', null).order('created_at')) as { id: string; name: string }[]
  const ids = affiliates.map((a) => a.id)
  const data = ids.length ? await loadDataset(db, ids) : null
  const rows = affiliates.map((a) => {
    const t = affiliateTotals(data?.facts.get(a.id) ?? [], data?.commissions.get(a.id) ?? [], data?.payouts.get(a.id) ?? [], settings.commission_bp)
    const slug = linksWithClicks((data?.links ?? []).filter((l) => l.affiliate_id === a.id), new Map())[0]?.slug ?? ''
    return {
      id: a.id, name: a.name, slug, active: t.active, total: t.total, stopped: t.stopped, ltv_cents: t.ltv_cents,
      retention_months: t.retention_months, mrr_cents: t.mrr_cents, earned_cents: t.earned_cents, due_cents: t.due_cents,
    }
  })
  const sum = (k: 'active' | 'total' | 'mrr_cents' | 'earned_cents' | 'due_cents') => rows.reduce((s, r) => s + r[k], 0)
  return json({
    kpis: {
      active: sum('active'), total: sum('total'), mrr_cents: sum('mrr_cents'), earned_cents: sum('earned_cents'),
      due_cents: rows.reduce((s, r) => s + Math.max(r.due_cents, 0), 0),
      due_count: rows.filter((r) => r.due_cents > 0).length,
    },
    affiliates: rows,
    commission_bp: settings.commission_bp,
  }, 200, req)
}

async function handleProfile(req: Request, db: SupabaseClient, settings: Settings, id: string): Promise<Response> {
  const affiliate = must(await db.from('affiliates').select('id, name, email, phone, notes, created_at').eq('id', id).maybeSingle())
  if (!affiliate) return json({ error: 'not_found' }, 404, req)
  const data = await loadDataset(db, [id])
  const facts = data.facts.get(id) ?? []
  const commissions = data.commissions.get(id) ?? []
  const payouts = data.payouts.get(id) ?? []
  const t = affiliateTotals(facts, commissions, payouts, settings.commission_bp)
  const links = linksWithClicks(data.links, data.clicks)
  return json({
    affiliate: { ...affiliate, email: (affiliate as { email: string | null }).email ?? '' },
    kpis: {
      earned_cents: t.earned_cents, paid_cents: t.paid_cents, due_cents: t.due_cents, mrr_cents: t.mrr_cents,
      mrr_net_cents: t.mrr_net_cents, active: t.active, total: t.total, last_payout_on: payouts[0]?.paid_on ?? null,
    },
    links,
    link_stats: { clicks: links.reduce((s, l) => s + l.clicks, 0), signups: t.total, paying: t.active },
    monthly: monthlySeries(commissions),
    customers: facts.map((f) => f.customer).filter((c) => c !== null),
    payouts: payouts.map(toPayout),
  }, 200, req)
}

async function slugFree(db: SupabaseClient, slug: string): Promise<boolean> {
  return !must(await db.from('affiliate_links').select('slug').eq('slug', slug).maybeSingle())
}

async function handleCreate(req: Request, db: SupabaseClient): Promise<Response> {
  const b = parseCreate(await readBody(req))
  if (!b) return json({ error: 'invalid_body' }, 400, req)
  if (!(await slugFree(db, b.slug))) return json({ error: 'slug_taken' }, 409, req)
  const created = must(await db.from('affiliates').insert({ name: b.name, email: b.email, phone: b.phone }).select('id').single()) as { id: string }
  const { error } = await db.from('affiliate_links').insert({ slug: b.slug, affiliate_id: created.id })
  if (error) {
    await db.from('affiliates').delete().eq('id', created.id)
    return error.code === '23505' ? json({ error: 'slug_taken' }, 409, req) : unavailable(req)
  }
  return json({ id: created.id, slug: b.slug }, 200, req)
}

async function handlePatch(req: Request, db: SupabaseClient, id: string): Promise<Response> {
  const b = parsePatch(await readBody(req))
  if (!b) return json({ error: 'invalid_body' }, 400, req)
  const row = must(await db.from('affiliates').update(b).eq('id', id).select('id').maybeSingle())
  return row ? noContent(req) : json({ error: 'not_found' }, 404, req)
}

async function handleLinks(req: Request, db: SupabaseClient, id: string): Promise<Response> {
  const body = await readBody(req) as { slug?: unknown } | undefined
  const slug = typeof body?.slug === 'string' && SLUG_RE.test(body.slug) ? body.slug : null
  if (!slug) return json({ error: 'invalid_body' }, 400, req)
  if (!must(await db.from('affiliates').select('id').eq('id', id).maybeSingle())) return json({ error: 'not_found' }, 404, req)
  const { error } = await db.from('affiliate_links').insert({ slug, affiliate_id: id })
  if (error) return error.code === '23505' ? json({ error: 'slug_taken' }, 409, req) : unavailable(req)
  const data = await loadDataset(db, [id])
  return json({ links: linksWithClicks(data.links, data.clicks) }, 200, req)
}

async function handleContact(req: Request, db: SupabaseClient, userId: string): Promise<Response> {
  const b = parseContact(await readBody(req))
  if (!b) return json({ error: 'invalid_body' }, 400, req)
  // Seule la fiche d'un compte AFFILIÉ s'édite ici.
  const p = must(await db.from('profiles').select('id').eq('id', userId).not('affiliate_id', 'is', null).maybeSingle())
  if (!p) return json({ error: 'not_found' }, 404, req)
  must(await db.from('affiliate_contacts').upsert({ user_id: userId, ...b, updated_at: new Date().toISOString() }).select('user_id'))
  return noContent(req)
}

async function handleAttach(req: Request, db: SupabaseClient, id: string): Promise<Response> {
  const body = await readBody(req) as { email?: unknown } | undefined
  if (typeof body?.email !== 'string' || !body.email.trim()) return json({ error: 'invalid_body' }, 400, req)
  const { data, error } = await db.rpc('affiliate_attach', { p_affiliate_id: id, p_email: body.email })
  if (error) {
    if (error.code === 'P0002') return json({ error: 'not_found' }, 404, req)
    if (error.code === '23505') return json({ error: 'already_attached' }, 409, req)
    return unavailable(req)
  }
  return json({ user_id: data }, 200, req)
}

async function handlePayout(req: Request, db: SupabaseClient, id: string, role: Role): Promise<Response> {
  const b = parsePayout(await readBody(req))
  if (!b) return json({ error: 'invalid_body' }, 400, req)
  if (!must(await db.from('affiliates').select('id').eq('id', id).maybeSingle())) return json({ error: 'not_found' }, 404, req)
  const row = must(await db.from('affiliate_payouts').insert({ affiliate_id: id, ...b, created_by: role }).select('*').single()) as PayoutRow
  return json(toPayout(row), 200, req)
}

async function handleSettingsPut(req: Request, db: SupabaseClient): Promise<Response> {
  const b = parseSettings(await readBody(req))
  if (!b) return json({ error: 'invalid_body' }, 400, req)
  const { code, ...rates } = b
  const patch = code
    ? { ...rates, code_hash: await hashAffiliateCode(code), token_secret: newTokenSecret(), code_changed_at: new Date().toISOString() }
    : rates
  const row = must(await db.from('affiliate_settings').update(patch).eq('id', true).select('*').single()) as Settings
  return json(settingsResponse(row), 200, req)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) })
  const route = parseRoute(req.method, new URL(req.url).pathname)
  if (!route) return json({ error: 'not_found' }, 404, req)

  const db = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } })
  try {
    if (route.name === 'session') return await handleSession(req, db)
    if (route.name === 'click') return await handleClick(req, db)

    const settings = await loadSettings(db)
    const role = await resolveRole(req, settings)
    const verdict = authorize(route.name, role)
    if (verdict === 'unauthorized') return json({ error: 'unauthorized' }, 401, req)
    if (verdict === 'forbidden') return json({ error: 'forbidden' }, 403, req)

    switch (route.name) {
      case 'overview': return await handleOverview(req, db, settings)
      case 'profile': return await handleProfile(req, db, settings, route.id!)
      case 'create': return await handleCreate(req, db)
      case 'patch': return await handlePatch(req, db, route.id!)
      case 'links': return await handleLinks(req, db, route.id!)
      case 'slug': {
        const slug = route.id!
        const valid = SLUG_RE.test(slug)
        return json({ valid, free: valid ? await slugFree(db, slug) : false }, 200, req)
      }
      case 'contact': return await handleContact(req, db, route.id!)
      case 'attach': return await handleAttach(req, db, route.id!)
      case 'payout': return await handlePayout(req, db, route.id!, role!)
      case 'settings_get': return json(settingsResponse(settings), 200, req)
      case 'settings_put': return await handleSettingsPut(req, db)
    }
    return json({ error: 'not_found' }, 404, req)
  } catch (e) {
    // Le nom de la route seulement : jamais le corps.
    console.error(`${FN} ${route.name}: ${e instanceof ReadError ? 'read failed' : 'unexpected error'}`)
    return unavailable(req)
  }
})
