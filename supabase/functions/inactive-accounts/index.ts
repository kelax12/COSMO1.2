// ═══════════════════════════════════════════════════════════════════
// Comptes inactifs depuis 3 ans · avertir, puis effacer (C-121, RGPD 5.1.e)
//
// La politique de confidentialité (s6.li1) promet : un compte sans activité
// pendant TROIS ANS est supprimé, après un e-mail envoyé TRENTE JOURS avant.
//
// Appelée une fois par jour par `.github/workflows/inactive-accounts.yml`,
// comme `renewal-notice` (pas de `pg_net` en base). Deux phases :
//
//   1. AVERTIR : `accounts_due_for_inactivity_notice()` (mig. 226) rend les
//      comptes inactifs, non avertis depuis leur dernière activité, qui ne
//      paient pas. Un e-mail chacun, PUIS une ligne dans
//      `account_inactivity_notices`.
//   2. EFFACER : `accounts_due_for_inactivity_deletion()` rend les comptes
//      avertis depuis 30 jours et restés absents. Chacun est effacé par
//      `delete-account`, le chemin de la suppression demandée depuis les
//      Réglages (transfert de propriété d'organisation compris), qui
//      REVÉRIFIE en base que le compte est dû avant d'effacer.
//
// ❌ Ne JAMAIS enregistrer l'avertissement AVANT l'envoi : la ligne ouvre
//    l'effacement 30 jours plus tard, elle doit prouver un message parti.
// ❌ Ne JAMAIS effacer ici directement : un deuxième chemin d'effacement
//    divergerait du premier, et huit gardes ne lisent que `delete-account`.
// ❌ Ne JAMAIS faire échouer tout le lot sur un compte en erreur.
// ═══════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2'
import { opsAlert } from '../_shared/alert.ts'
import {
  MAX_DELETIONS_PER_RUN,
  MAX_NOTICES_PER_RUN,
  inactivityMail,
} from '../_shared/inactivity-notice.ts'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://thecosmo.app'
/** Même expéditeur signé que `renewal-notice` : AUCUNE valeur par défaut. */
const MAIL_FROM = Deno.env.get('BUG_REPORT_FROM')
const CRON_SECRET = Deno.env.get('CRON_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface DueNotice {
  user_id: string
  email: string
  activity_at: string
}

Deno.serve(async (req) => {
  // ÉCHEC FERMÉ : jamais `if (CRON_SECRET && …)`.
  if (!CRON_SECRET) {
    await opsAlert('inactive-accounts', 'CRON_SECRET absent — la fonction refuse tout appel, C-121 non tenu')
    return json({ error: 'cron_secret_not_configured' }, 503)
  }
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return json({ error: 'unauthorized' }, 401)
  }
  if (!MAIL_FROM) {
    await opsAlert('inactive-accounts', 'BUG_REPORT_FROM absent — aucun avertissement ne peut partir')
    return json({ error: 'sender_not_configured' }, 503)
  }
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    await opsAlert('inactive-accounts', 'RESEND_API_KEY absent — aucun avertissement ne peut partir')
    return json({ error: 'mail_not_configured' }, 503)
  }

  // ── 1. Avertir ──────────────────────────────────────────────────
  const { data: noticeRows, error: noticeError } = await supabaseAdmin.rpc(
    'accounts_due_for_inactivity_notice',
    { p_limit: MAX_NOTICES_PER_RUN },
  )
  if (noticeError) {
    console.error('accounts_due_for_inactivity_notice failed:', noticeError)
    await opsAlert('inactive-accounts', 'selection des comptes a avertir en echec — C-121 non tenu ce jour')
    return json({ error: 'notice_query_failed' }, 500)
  }

  const toWarn = (noticeRows ?? []) as DueNotice[]
  let warned = 0
  const warnFailed: string[] = []

  for (const row of toWarn) {
    try {
      const warnedAt = new Date()
      const mail = inactivityMail(APP_URL, warnedAt)
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: MAIL_FROM, to: [row.email], ...mail }),
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) {
        warnFailed.push(row.user_id)
        continue
      }
      // APRÈS l'envoi. Si cette écriture échoue, l'avertissement repartira
      // demain : un doublon vaut mieux qu'un effacement sans preuve d'envoi
      // (et sans ligne, aucun effacement ne s'ouvre).
      const { error: traceError } = await supabaseAdmin
        .from('account_inactivity_notices')
        .upsert(
          { user_id: row.user_id, warned_at: warnedAt.toISOString(), activity_at: row.activity_at },
          { onConflict: 'user_id' },
        )
      if (traceError) {
        await opsAlert('inactive-accounts', `avertissement envoye mais NON enregistre (${row.user_id}) — il repartira demain`)
        warnFailed.push(row.user_id)
        continue
      }
      warned++
    } catch (err) {
      console.error('inactivity notice failed:', err)
      warnFailed.push(row.user_id)
    }
  }

  // ── 2. Effacer ──────────────────────────────────────────────────
  const { data: deletionRows, error: deletionError } = await supabaseAdmin.rpc(
    'accounts_due_for_inactivity_deletion',
    { p_limit: MAX_DELETIONS_PER_RUN },
  )
  if (deletionError) {
    console.error('accounts_due_for_inactivity_deletion failed:', deletionError)
    await opsAlert('inactive-accounts', 'selection des comptes a effacer en echec — C-121 non tenu ce jour')
    return json({ error: 'deletion_query_failed', warned }, 500)
  }

  const toDelete = (deletionRows ?? []) as { user_id: string }[]
  let deleted = 0
  const deleteFailed: string[] = []

  for (const row of toDelete) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          apikey: SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
          'x-cron-secret': CRON_SECRET,
        },
        body: JSON.stringify({ userId: row.user_id }),
        signal: AbortSignal.timeout(60000),
      })
      if (res.ok) deleted++
      else deleteFailed.push(`${row.user_id}:${res.status}`)
    } catch (err) {
      console.error('inactive account deletion failed:', err)
      deleteFailed.push(`${row.user_id}:crash`)
    }
  }

  if (warnFailed.length > 0 || deleteFailed.length > 0) {
    // Identifiants opaques uniquement, aucun e-mail.
    await opsAlert(
      'inactive-accounts',
      `C-121 : ${warnFailed.length} avertissement(s) et ${deleteFailed.length} effacement(s) en echec (${deleteFailed.join(', ')})`,
    )
  }

  return json({
    toWarn: toWarn.length,
    warned,
    warnFailed: warnFailed.length,
    toDelete: toDelete.length,
    deleted,
    deleteFailed: deleteFailed.length,
  })
})
