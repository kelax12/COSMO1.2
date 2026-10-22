// ═══════════════════════════════════════════════════════════════════
// Notifications d'entreprise par e-mail (mig. 162, audit 2026-09-23, M14)
//
// Deux modes, appelés par `.github/workflows/org-digest.yml` :
//   · `hourly` : les types que chacun a choisi de recevoir AUSSI par e-mail ;
//   · `daily`  : le résumé quotidien de ce qui reste non lu.
// La sélection est faite en base (`org_notifications_to_email`, service_role
// seulement) : non lues, pas encore envoyées, moins de deux jours.
//
// ── IDEMPOTENCE ────────────────────────────────────────────────────
//
// `emailed_at` est posé APRÈS l'envoi, destinataire par destinataire. Une
// panne au milieu du lot renvoie au plus un doublon au passage suivant, jamais
// une notification perdue.
//
// ❌ Pas d'expéditeur par défaut, pas de garde conditionnée à son propre
//    secret, pas de corps de fournisseur relayé (mêmes règles que
//    `renewal-notice`, cf. `src/edge-mail-functions.guard.test.ts`).
// ═══════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2'
import { opsAlert } from '../_shared/alert.ts'
import { describeRow, digestFooter, digestSeeAll, digestSubject, type DigestLocale } from '../_shared/org-digest-text.ts'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://thecosmo.app'
const MAIL_FROM = Deno.env.get('BUG_REPORT_FROM')
const CRON_SECRET = Deno.env.get('CRON_SECRET')

interface Row {
  notification_id: string
  org_id: string
  org_name: string
  user_id: string
  email: string
  kind: string
  task_name: string | null
  project_name: string | null
  actor_name: string | null
  created_at: string
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  // Échec fermé : sans secret posé, la fonction refuse tout (cf. renewal-notice).
  if (!CRON_SECRET) {
    await opsAlert('org-digest', 'CRON_SECRET absent, la fonction refuse tout appel : aucun e-mail de notification ne part')
    return json({ error: 'cron_secret_not_configured' }, 503)
  }
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) return json({ error: 'unauthorized' }, 401)
  if (!MAIL_FROM) {
    await opsAlert('org-digest', 'BUG_REPORT_FROM absent : aucun e-mail de notification ne peut partir')
    return json({ error: 'sender_not_configured' }, 503)
  }
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    await opsAlert('org-digest', 'RESEND_API_KEY absent : aucun e-mail de notification ne peut partir')
    return json({ error: 'mail_not_configured' }, 503)
  }

  const mode = new URL(req.url).searchParams.get('mode') === 'daily' ? 'daily' : 'hourly'
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  const { data, error } = await admin.rpc('org_notifications_to_email', { p_mode: mode })
  if (error) {
    await opsAlert('org-digest', `selection des notifications a envoyer en echec (${mode})`)
    return json({ error: 'query_failed' }, 500)
  }

  // Un courriel par destinataire et par organisation.
  const batches = new Map<string, Row[]>()
  for (const r of (data ?? []) as Row[]) {
    const key = `${r.user_id}:${r.org_id}`
    const arr = batches.get(key)
    if (arr) arr.push(r)
    else batches.set(key, [r])
  }

  // Langue et fuseau de chaque organisation (mig. 195). Table absente (mig.
  // non appliquée) ou lecture en échec : français et Europe/Paris, le courriel
  // d'avant. Un réglage d'affichage n'empêche jamais l'envoi.
  const orgIds = [...new Set([...batches.values()].map((rows) => rows[0].org_id))]
  const orgPrefs = new Map<string, { locale: DigestLocale; timezone: string }>()
  if (orgIds.length > 0) {
    const { data: settings } = await admin.from('org_settings').select('org_id, locale, timezone').in('org_id', orgIds)
    for (const s of (settings ?? []) as { org_id: string; locale: string; timezone: string }[]) {
      orgPrefs.set(s.org_id, { locale: s.locale === 'en' ? 'en' : 'fr', timezone: s.timezone || 'Europe/Paris' })
    }
  }

  let sent = 0
  let failed = 0
  for (const rows of batches.values()) {
    const first = rows[0]
    const { locale, timezone } = orgPrefs.get(first.org_id) ?? { locale: 'fr' as DigestLocale, timezone: 'Europe/Paris' }
    const lines = rows.map((r) => describeRow(r, locale, timezone))
    const link = `${APP_URL}/entreprise`
    const subject = digestSubject(mode, first.org_name, rows.length, lines[0], locale)
    const text = [...lines.map((l) => `- ${l}`), '', `${digestSeeAll(locale)} : ${link}`, '', digestFooter(locale)].join('\n')
    const html = `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
      + `<p><a href="${link}">${digestSeeAll(locale)}</a></p>`
      + `<p style="color:#666;font-size:12px">${escapeHtml(digestFooter(locale))}</p>`
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: MAIL_FROM, to: [first.email], subject, text, html }),
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) { failed++; continue }
      await admin.from('org_notifications')
        .update({ emailed_at: new Date().toISOString() })
        .in('id', rows.map((r) => r.notification_id))
      sent++
    } catch {
      failed++
    }
  }

  if (failed > 0) await opsAlert('org-digest', `${failed} courriel(s) de notification non envoye(s) sur ${batches.size} (${mode})`)
  return json({ mode, recipients: batches.size, sent, failed }, 200)
})
