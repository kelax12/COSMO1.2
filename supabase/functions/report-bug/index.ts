// ═══════════════════════════════════════════════════════════════════
// report-bug Edge Function
//
// Reçoit le formulaire « Signaler un bug » de l'app et l'expédie par e-mail
// à l'adresse de contact (contact@thecosmo.app) via l'API Resend.
//
// Trust model :
// - Aucun accès base. La fonction ne lit ni n'écrit une seule ligne : elle
//   valide un payload et relaie un e-mail. Pas de service_role ici.
// - L'appelant est authentifié par le gateway Supabase (verify_jwt par
//   défaut). Un visiteur non connecté passe avec la clé anon : c'est voulu,
//   un bug se signale aussi depuis un compte cassé. Si le JWT porte un vrai
//   utilisateur, son e-mail est mis en Reply-To pour pouvoir lui répondre.
// - Origine restreinte (CORS) à APP_URL + les deux origines de dev.
//
// Secrets attendus :
//   supabase secrets set RESEND_API_KEY=re_...
//   supabase secrets set BUG_REPORT_TO=contact@thecosmo.app              (optionnel)
//   supabase secrets set BUG_REPORT_FROM="Cosmo <bug@send.thecosmo.app>" (REQUIS)
//
// 🔴 Le domaine doit être `send.thecosmo.app`, PAS la racine `thecosmo.app` :
//    seul le premier est vérifié chez Resend (la racine porte les MX et le SPF
//    d'IONOS et ne sera jamais signée). Cette ligne recommandait la racine, et
//    la disait « optionnel » — deux fois la même erreur, celle qui a fait
//    échouer `renewal-notice` en silence jusqu'au 2026-09-02.
//
// Sans RESEND_API_KEY (ou sans BUG_REPORT_FROM) la fonction répond 503 : le
// client affiche alors un repli « écrivez-nous directement ».
//
// Déploiement : `supabase functions deploy report-bug`
// ═══════════════════════════════════════════════════════════════════

import { createClient } from 'npm:@supabase/supabase-js@2'
import { opsAlert } from '../_shared/alert.ts'

const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
const CONTACT_EMAIL = Deno.env.get('BUG_REPORT_TO') ?? 'contact@thecosmo.app'
/**
 * Expéditeur. 🔴 AUCUN DÉFAUT, exactement comme `renewal-notice`.
 *
 * Le défaut supprimé était `Cosmo <bug@thecosmo.app>`, or le domaine vérifié
 * chez Resend est `send.thecosmo.app` : la racine porte les MX et le SPF
 * d'IONOS et ne sera jamais signée. Ce défaut ne dégradait pas l'envoi, il le
 * rendait IMPOSSIBLE — tout signalement de bug repartait en 502 `send_failed`,
 * en présentant une panne d'envoi là où il n'y avait qu'un secret absent.
 *
 * Le jumeau `renewal-notice` a été corrigé le 2026-09-02 ; celui-ci portait le
 * même défaut, non repéré. Sans le secret, on répond `sender_not_configured`
 * et le client bascule sur son lien mailto — le repli existe déjà.
 */
const MAIL_FROM = Deno.env.get('BUG_REPORT_FROM')

// Origines autorisées : la prod, plus les deux serveurs de dev locaux
// (`npm run dev` sur 5173, `npm start` sur 3000) — sans quoi le formulaire
// serait intestable ailleurs qu'en production.
const ALLOWED_ORIGINS = new Set([APP_URL, 'http://localhost:5173', 'http://localhost:3000'])

function corsHeadersFor(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
  if (allow) headers['Access-Control-Allow-Origin'] = allow
  return headers
}

// Bornes — miroir de `src/lib/bug-report.ts`. Le client valide pour l'UX,
// le serveur valide parce que rien de ce qui vient du client n'est acquis.
const TITLE_MIN = 3
const TITLE_MAX = 120
const DESCRIPTION_MIN = 10
const DESCRIPTION_MAX = 5000
const ATTACHMENT_MAX_BYTES = 3 * 1024 * 1024
const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain',
])
// Le contexte technique est un dictionnaire libre côté client : on le borne
// pour qu'il ne devienne pas un canal d'exfiltration de 5 Mo de texte.
const CONTEXT_MAX_ENTRIES = 12
const CONTEXT_MAX_VALUE_LENGTH = 500

function json(body: unknown, status: number, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
  })
}

/** Neutralise les injections d'en-têtes : un CR/LF dans un Subject les scinde. */
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

/** Échappe le HTML — le corps du mail est rendu par un client de messagerie. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersFor(req) })
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, req)
  }

  if (!MAIL_FROM) {
    // Même repli que `mail_not_configured` : 503 parce que ce n'est pas un
    // bug, c'est une configuration absente. Sans cette garde, l'envoi partait
    // avec un expéditeur non signé et échouait en 502.
    return json({ error: 'sender_not_configured' }, 503, req)
  }

  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    // Pas d'alerte ops : ce n'est pas une panne, c'est une fonction pas encore
    // configurée. Le client bascule sur le lien mailto.
    return json({ error: 'mail_not_configured' }, 503, req)
  }

  let payload: {
    title?: unknown
    description?: unknown
    attachment?: unknown
    context?: unknown
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid_body' }, 400, req)
  }

  const title = typeof payload.title === 'string' ? singleLine(payload.title) : ''
  const description = typeof payload.description === 'string' ? payload.description.trim() : ''
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    return json({ error: 'invalid_title' }, 400, req)
  }
  if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
    return json({ error: 'invalid_description' }, 400, req)
  }

  // Pièce jointe — optionnelle, base64 sans préfixe `data:`.
  let attachment: { filename: string; content: string } | null = null
  if (payload.attachment && typeof payload.attachment === 'object') {
    const raw = payload.attachment as Record<string, unknown>
    const name = typeof raw.name === 'string' ? singleLine(raw.name).slice(0, 100) : ''
    const type = typeof raw.type === 'string' ? raw.type : ''
    const content = typeof raw.content === 'string' ? raw.content : ''
    if (!name || !ALLOWED_ATTACHMENT_TYPES.has(type) || !content) {
      return json({ error: 'invalid_attachment' }, 400, req)
    }
    // 4 caractères base64 = 3 octets : on borne la taille réelle du fichier
    // sans avoir à le décoder.
    if ((content.length * 3) / 4 > ATTACHMENT_MAX_BYTES) {
      return json({ error: 'attachment_too_large' }, 413, req)
    }
    if (!/^[A-Za-z0-9+/=\s]+$/.test(content)) {
      return json({ error: 'invalid_attachment' }, 400, req)
    }
    attachment = { filename: name, content: content.replace(/\s+/g, '') }
  }

  // Contexte technique (URL, user agent, viewport…) — borné et aplati.
  const contextLines: string[] = []
  if (payload.context && typeof payload.context === 'object') {
    const entries = Object.entries(payload.context as Record<string, unknown>).slice(0, CONTEXT_MAX_ENTRIES)
    for (const [key, value] of entries) {
      if (typeof value !== 'string') continue
      contextLines.push(`${singleLine(key).slice(0, 40)}: ${singleLine(value).slice(0, CONTEXT_MAX_VALUE_LENGTH)}`)
    }
  }

  // Identité de l'auteur : elle vient du JWT, JAMAIS du corps de la requête.
  // Un visiteur non connecté (clé anon) reste anonyme, et c'est valide.
  let reporterEmail: string | null = null
  const authHeader = req.headers.get('Authorization') ?? ''
  if (authHeader) {
    try {
      const anon = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } },
      )
      const { data } = await anon.auth.getUser()
      reporterEmail = data.user?.email ?? null
    } catch {
      reporterEmail = null
    }
  }

  const textBody = [
    description,
    '',
    '---',
    `Auteur : ${reporterEmail ?? 'non connecté (anonyme)'}`,
    ...contextLines,
  ].join('\n')

  const htmlBody = [
    `<p style="white-space:pre-wrap">${escapeHtml(description)}</p>`,
    '<hr>',
    '<p style="font:12px/1.6 monospace;color:#555">',
    `Auteur : ${escapeHtml(reporterEmail ?? 'non connecté (anonyme)')}<br>`,
    ...contextLines.map((line) => `${escapeHtml(line)}<br>`),
    '</p>',
  ].join('')

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [CONTACT_EMAIL],
        // Répondre au rapport doit répondre à son auteur, pas à la boîte
        // d'envoi. Absent si l'auteur n'est pas connecté.
        ...(reporterEmail ? { reply_to: reporterEmail } : {}),
        subject: `[Bug] ${title}`,
        text: textBody,
        html: htmlBody,
        ...(attachment ? { attachments: [attachment] } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      // Pas de corps de réponse relayé au client : il peut contenir des
      // détails de compte Resend.
      await opsAlert('report-bug', `Resend a refusé un envoi (HTTP ${res.status}).`)
      return json({ error: 'send_failed' }, 502, req)
    }
  } catch {
    await opsAlert('report-bug', 'Resend injoignable (timeout ou erreur réseau).')
    return json({ error: 'send_failed' }, 502, req)
  }

  return json({ ok: true }, 200, req)
})
