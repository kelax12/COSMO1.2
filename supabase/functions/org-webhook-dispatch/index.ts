// ═══════════════════════════════════════════════════════════════════
// Envoi des webhooks d'organisation (mig. 199, audit entreprise 2026-09-24)
//
// Appelée par `.github/workflows/org-webhook-dispatch.yml` (en-tête
// `x-cron-secret`), comme `org-digest` : pg_net n'est pas installé.
//
// Vide la file `org_webhook_deliveries` par `org_webhook_deliveries_due`
// (service_role). Deux formats :
//   · `slack` : `{ "text": "…" }`, ce qu'attend un Incoming Webhook ;
//   · `json`  : l'événement tel quel, signé en HMAC-SHA256 avec le secret du
//     webhook (`X-Cosmo-Signature: sha256=<hex>`) et horodaté
//     (`X-Cosmo-Timestamp`), pour que le destinataire refuse un rejeu.
//
// ── RÈGLES ─────────────────────────────────────────────────────────
//
// ❌ Échec fermé sans `CRON_SECRET` (cf. renewal-notice) : jamais une garde
//    conditionnée à son propre secret.
// ❌ Aucune redirection suivie (`redirect: 'manual'`) : une URL HTTPS publique
//    ne doit pas pouvoir rebondir vers une adresse interne.
// ⚠️ 5 tentatives au plus par livraison ; au-delà de 20 échecs consécutifs,
//    le webhook est COUPÉ (`enabled = false`) et l'écran le montre : une URL
//    morte ne doit pas coûter un appel toutes les dix minutes pour toujours.
// ❌ Le corps de réponse du destinataire n'est ni stocké ni relayé.
// ═══════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2'
import { opsAlert } from '../_shared/alert.ts'
import { slackText } from '../_shared/org-integrations.ts'
import { checkWebhookDestination } from '../_shared/webhook-destination.ts'

/** Résolveur réel ; le module partagé le reçoit injecté pour rester testable. */
const resolveDns = (host: string, type: 'A' | 'AAAA'): Promise<string[]> =>
  Deno.resolveDns(host, type) as Promise<string[]>

const CRON_SECRET = Deno.env.get('CRON_SECRET')
const APP_URL = Deno.env.get('APP_URL') ?? 'https://thecosmo.app'
const TIMEOUT_MS = 8000
const DISABLE_AFTER_FAILURES = 20

interface Due {
  delivery_id: string
  webhook_id: string
  url: string
  format: 'json' | 'slack'
  secret: string
  event: string
  payload: {
    organization?: string
    task?: { name?: string; status?: string; project?: string; deadline?: string | null }
  }
  attempts: number
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (!CRON_SECRET) {
    await opsAlert('org-webhook-dispatch', 'CRON_SECRET absent, la fonction refuse tout appel : aucun webhook ne part')
    return json({ error: 'cron_secret_not_configured' }, 503)
  }
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) return json({ error: 'unauthorized' }, 401)

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data, error } = await admin.rpc('org_webhook_deliveries_due', { p_limit: 200 })
  if (error) {
    await opsAlert('org-webhook-dispatch', 'lecture de la file des webhooks en echec')
    return json({ error: 'query_failed' }, 500)
  }

  let delivered = 0
  let failed = 0
  const outcome = new Map<string, { ok: boolean; status: number | null }>()

  for (const d of (data ?? []) as Due[]) {
    const body = d.format === 'slack' ? JSON.stringify({ text: slackText(d.event, d.payload, APP_URL) }) : JSON.stringify(d.payload)
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'User-Agent': 'Cosmo-Webhooks/1' }
    if (d.format === 'json') {
      const ts = String(Math.floor(Date.now() / 1000))
      headers['X-Cosmo-Event'] = d.event
      headers['X-Cosmo-Timestamp'] = ts
      headers['X-Cosmo-Signature'] = `sha256=${await hmacHex(d.secret, `${ts}.${body}`)}`
    }
    let status: number | null = null
    // Audit du 2026-09-30 : la contrainte SQL ne suffit pas, la destination se
    // décide sur les adresses RÉSOLUES (cf. `_shared/webhook-destination.ts`).
    const destination = await checkWebhookDestination(d.url, resolveDns)
    if (!destination.ok) {
      failed++
      await admin.from('org_webhook_deliveries')
        .update({ attempts: d.attempts + 1, status_code: null, delivered_at: null })
        .eq('id', d.delivery_id)
      outcome.set(d.webhook_id, { ok: false, status: null })
      continue
    }
    try {
      const res = await fetch(d.url, { method: 'POST', headers, body, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) })
      status = res.status
      await res.body?.cancel()
    } catch {
      status = null
    }
    const ok = status !== null && status >= 200 && status < 300
    if (ok) delivered++
    else failed++
    await admin.from('org_webhook_deliveries')
      .update({ attempts: d.attempts + 1, status_code: status, delivered_at: ok ? new Date().toISOString() : null })
      .eq('id', d.delivery_id)
    outcome.set(d.webhook_id, { ok, status })
  }

  // Suivi par webhook : dernier code, et coupure après trop d'échecs.
  for (const [webhookId, { ok, status }] of outcome) {
    const { data: w } = await admin.from('org_webhooks').select('failure_count').eq('id', webhookId).maybeSingle()
    const failures = ok ? 0 : ((w?.failure_count as number | undefined) ?? 0) + 1
    await admin.from('org_webhooks').update({
      last_status: status,
      last_delivery_at: new Date().toISOString(),
      failure_count: failures,
      ...(failures >= DISABLE_AFTER_FAILURES ? { enabled: false } : {}),
    }).eq('id', webhookId)
  }

  return json({ delivered, failed }, 200)
})
