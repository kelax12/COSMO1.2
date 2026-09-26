// ═══════════════════════════════════════════════════════════════════
// Vérification d'un domaine d'organisation (mig. 195, rubrique Sécurité)
//
// Un admin déclare `exemple.fr` ; l'écran lui donne un enregistrement à
// publier : TXT `_cosmo-verify.exemple.fr` = `cosmo-verify=<jeton>`. Cette
// fonction lit le DNS et, s'il correspond, pose `verified_at`. Le client ne
// peut pas l'écrire lui-même (aucune policy UPDATE sur la table).
//
// ── AUTORISATION ────────────────────────────────────────────────────
//
// L'appelant vient du JWT, jamais du corps : il doit être ADMIN actif de
// l'organisation du domaine. Le service role ne sert qu'à lire la ligne et à
// poser la vérification ; il n'élargit rien.
//
// ⚠️ Une panne de lecture qui décide d'une autorisation ne se devine pas :
//    503, et le client réessaie (cf. send-org-invite).
// ⚠️ Un domaine déjà VÉRIFIÉ par une autre organisation est refusé
//    (`domain_taken`) : l'index unique partiel de la 195 le garantit aussi.
// ═══════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2'
import { txtMatches } from '../_shared/org-integrations.ts'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://thecosmo.app'
const ALLOWED_ORIGINS = new Set([APP_URL, 'http://localhost:5173', 'http://localhost:3000'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeadersFor(req) } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(req) })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, req)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ error: 'not_authenticated' }, 401, req)
  const asUser = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await asUser.auth.getUser()
  if (userError) return json({ error: 'auth_unavailable' }, 503, req)
  const caller = userData.user
  if (!caller) return json({ error: 'not_authenticated' }, 401, req)

  let payload: { domainId?: unknown }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid_body' }, 400, req)
  }
  const domainId = typeof payload.domainId === 'string' && UUID_RE.test(payload.domainId) ? payload.domainId : null
  if (!domainId) return json({ error: 'invalid_body' }, 400, req)

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data: row, error: rowError } = await admin
    .from('org_verified_domains')
    .select('id, org_id, domain, verification_token, verified_at')
    .eq('id', domainId)
    .maybeSingle()
  if (rowError) return json({ error: 'lookup_failed' }, 503, req)
  if (!row) return json({ error: 'not_found' }, 404, req)

  const { data: membership, error: memberError } = await admin
    .from('organization_members')
    .select('role, suspended_at')
    .eq('org_id', row.org_id)
    .eq('user_id', caller.id)
    .maybeSingle()
  if (memberError) return json({ error: 'lookup_failed' }, 503, req)
  // Même réponse qu'une ligne absente : pas d'oracle sur les domaines d'autrui.
  if (!membership || membership.suspended_at || membership.role !== 'admin') return json({ error: 'not_found' }, 404, req)
  if (row.verified_at) return json({ verified: true }, 200, req)

  let records: string[][] = []
  try {
    records = await Deno.resolveDns(`_cosmo-verify.${row.domain}`, 'TXT')
  } catch {
    records = []
  }
  const verified = txtMatches(records, row.verification_token as string)
  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .from('org_verified_domains')
    .update(verified ? { verified_at: now, last_checked_at: now } : { last_checked_at: now })
    .eq('id', row.id)
  if (updateError) {
    // 23505 : l'index unique partiel, une autre organisation l'a vérifié avant.
    if ((updateError as { code?: string }).code === '23505') return json({ error: 'domain_taken' }, 409, req)
    return json({ error: 'update_failed' }, 503, req)
  }
  return json({ verified }, 200, req)
})
