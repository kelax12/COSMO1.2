// ═══════════════════════════════════════════════════════════════════
// Invitations d'entreprise par e-mail (mig. 161, audit 2026-09-23, M11)
//
// Le client crée les liens nominatifs par la RPC `create_org_email_invitations`
// (droits vérifiés en base), puis demande ici leur ENVOI, relances comprises.
//
// ── AUTORISATION ────────────────────────────────────────────────────
//
// L'appelant vient du JWT, jamais du corps. Un lien n'est envoyé que si
// l'appelant l'a créé, ou s'il est admin de l'organisation du lien. Le service
// role ne sert qu'à LIRE ces liens et à noter l'envoi ; il n'élargit rien.
//
// ── CE QUI EST REFUSÉ ───────────────────────────────────────────────
//
// ❌ Aucune valeur par défaut d'expéditeur (C-36) : sans `BUG_REPORT_FROM`,
//    la fonction répond 503 et le dit, au lieu d'échouer en silence.
// ❌ Aucun corps de réponse du fournisseur relayé au client.
// ⚠️ Une relance au plus par heure et par lien : au-delà, c'est du
//    harcèlement, et la réputation du domaine d'envoi en paie le prix.
// 🔴 Plafond de débit PAR E-MAIL, par compte et par organisation (audit du
//    2026-09-30, `ORG_INVITE_LIMITS`) : sans lui, un compte gratuit crée une
//    organisation et expédie sans fin depuis le domaine qui porte aussi les
//    e-mails d'authentification.
// 🔴 Le nom de l'organisation et celui de l'invitant sont du texte LIBRE,
//    passé par `mailSafeText` : pas d'URL explicite dans un e-mail signé COSMO.
// ❌ Un membre suspendu OU dont l'accès a expiré n'envoie rien.
// ═══════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2'
import { opsAlert } from '../_shared/alert.ts'
import { mailSafeText } from '../_shared/mail-text.ts'
import { ORG_INVITE_LIMITS, consumeRateLimits } from '../_shared/rate-limit.ts'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://thecosmo.app'
const MAIL_FROM = Deno.env.get('BUG_REPORT_FROM')
const MAX_TOKENS = 50
const RESEND_COOLDOWN_MS = 60 * 60 * 1000
const LINK_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000

const ALLOWED_ORIGINS = new Set([APP_URL, 'http://localhost:5173', 'http://localhost:3000'])

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
  if (ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function json(body: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeadersFor(req) },
  })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface LinkRow {
  id: string
  org_id: string
  email: string | null
  created_by: string
  claimed_at: string | null
  last_sent_at: string | null
  sent_count: number
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

function mailBody(orgName: string, inviterName: string, link: string): { text: string; html: string } {
  const lines = [
    `Bonjour,`,
    ``,
    `${inviterName} vous invite à rejoindre l'organisation « ${orgName} » sur Cosmo.`,
    ``,
    `Pour accepter, ouvrez ce lien avec le compte Cosmo de cette adresse (ou créez-le) : ${link}`,
    ``,
    `Le lien est valable 7 jours et ne fonctionne que pour cette adresse.`,
    `Si vous ne vous attendiez pas à cette invitation, ignorez simplement ce message.`,
    ``,
    `L'équipe Cosmo`,
  ]
  return {
    text: lines.join('\n'),
    html: lines.map((l) => (l === '' ? '<br>' : `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`)).join(''),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, req)

  if (!MAIL_FROM) {
    await opsAlert('send-org-invite', 'BUG_REPORT_FROM absent : aucune invitation d entreprise ne peut partir')
    return json({ error: 'sender_not_configured' }, 503, req)
  }
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    await opsAlert('send-org-invite', 'RESEND_API_KEY absent : aucune invitation d entreprise ne peut partir')
    return json({ error: 'mail_not_configured' }, 503, req)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ error: 'not_authenticated' }, 401, req)
  const asUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: userData, error: userError } = await asUser.auth.getUser()
  // Une panne de l'API auth n'est pas un « non connecté » : on le dit, et le
  // client peut réessayer.
  if (userError) return json({ error: 'auth_unavailable' }, 503, req)
  const caller = userData.user
  if (!caller) return json({ error: 'not_authenticated' }, 401, req)

  let payload: { orgId?: unknown; tokens?: unknown }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid_body' }, 400, req)
  }
  const orgId = typeof payload.orgId === 'string' && UUID_RE.test(payload.orgId) ? payload.orgId : null
  const tokens = Array.isArray(payload.tokens)
    ? [...new Set(payload.tokens.filter((x): x is string => typeof x === 'string' && UUID_RE.test(x)))]
    : []
  if (!orgId || tokens.length === 0 || tokens.length > MAX_TOKENS) return json({ error: 'invalid_body' }, 400, req)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const [{ data: membership, error: memberError }, { data: org, error: orgError }, { data: profile }] = await Promise.all([
    admin.from('organization_members').select('role, suspended_at, access_expires_at')
      .eq('org_id', orgId).eq('user_id', caller.id).maybeSingle(),
    admin.from('organizations').select('name').eq('id', orgId).maybeSingle(),
    admin.from('profiles').select('display_name').eq('id', caller.id).maybeSingle(),
  ])
  // Une lecture qui décide d'une autorisation ne se devine pas : en cas de
  // panne, on refuse et on fait réessayer, jamais l'inverse.
  if (memberError || orgError) return json({ error: 'lookup_failed' }, 503, req)
  const expired = membership?.access_expires_at != null && Date.parse(membership.access_expires_at as string) <= Date.now()
  if (!membership || membership.suspended_at || expired || !org) return json({ error: 'forbidden' }, 403, req)
  const isAdmin = membership.role === 'admin'

  const { data: rows, error: linksError } = await admin
    .from('org_invite_links')
    .select('id, org_id, email, created_by, claimed_at, last_sent_at, sent_count')
    .eq('org_id', orgId)
    .in('id', tokens)
  if (linksError) return json({ error: 'lookup_failed' }, 503, req)

  const inviterName = mailSafeText((profile?.display_name as string | undefined) || caller.email?.split('@')[0] || '', 60) || 'Un membre'
  const orgName = mailSafeText(org.name as string, 80) || 'Cosmo'
  let sent = 0
  let failed = 0
  let limited = false
  const now = Date.now()

  for (const link of (rows ?? []) as LinkRow[]) {
    if (!link.email || link.claimed_at) { failed++; continue }
    if (!isAdmin && link.created_by !== caller.id) { failed++; continue }
    if (link.last_sent_at && now - Date.parse(link.last_sent_at) < RESEND_COOLDOWN_MS) { failed++; continue }
    // Un jeton PAR e-mail : c'est l'envoi qui coûte, pas l'appel.
    const verdict = await consumeRateLimits('send-org-invite', [
      { domain: 'org-invite-acct-h', value: caller.id, ...ORG_INVITE_LIMITS.perAccountHour },
      { domain: 'org-invite-acct-d', value: caller.id, ...ORG_INVITE_LIMITS.perAccountDay },
      { domain: 'org-invite-org-d', value: orgId, ...ORG_INVITE_LIMITS.perOrgDay },
    ])
    if (verdict.misconfigured) return json({ error: 'rate_limit_not_configured', sent }, 503, req)
    if (!verdict.allowed) { limited = true; break }
    try {
      const { text, html } = mailBody(orgName, inviterName, `${APP_URL}/org-invite/${link.id}`)
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: MAIL_FROM,
          to: [link.email],
          subject: `Invitation à rejoindre ${orgName} sur Cosmo`,
          text,
          html,
        }),
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) { failed++; continue }
      // APRÈS l'envoi : la relance prolonge la validité du lien.
      await admin.from('org_invite_links').update({
        sent_count: link.sent_count + 1,
        last_sent_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + LINK_VALIDITY_MS).toISOString(),
      }).eq('id', link.id)
      sent++
    } catch {
      failed++
    }
  }
  failed += tokens.length - (rows?.length ?? 0)

  // Plafond atteint : ce qui est parti est parti, le reste se relancera plus
  // tard. 429 pour que l'écran le dise au lieu d'annoncer un échec d'envoi.
  if (limited) return json({ error: 'too_many_requests', sent }, 429, req)

  if (failed > 0 && sent === 0) {
    await opsAlert('send-org-invite', `aucune des ${tokens.length} invitation(s) demandee(s) n est partie`)
  }
  return json({ sent, failed }, 200, req)
})
