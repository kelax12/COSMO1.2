// ═══════════════════════════════════════════════════════════════════
// Alerte 80 % des sièges entreprise (spec 2026-11-02 § 6.3)
//
// Appelée une fois par jour par pg_cron (job `cosmo-seat-alert`, mig. 246,
// journal `cron_runs`), en `x-cron-secret`. `verify_jwt = false`. Rattrapage :
// `.github/workflows/renewal-notice.yml` (job `seat-alert`), à la main.
//
// Sélection : RPC `orgs_for_seat_alert()` (mig. 240), qui applique la règle de
// `org_seats_allowed` (drapeau `billing_flags.enterprise_seat_limit`, palier
// gratuit hors abonnement actif, illimité exclu) ; `shouldAlert` la rejoue en
// TS pur, testé.
//
// Idempotence : UNIQUE `(org_id, tier_key)` de `org_seat_alerts`. Une alerte
// par palier ; le `23505` d'un rejeu est absorbé.
//
// ❌ Ne JAMAIS enregistrer l'alerte AVANT l'envoi : un échec d'envoi serait
//    perdu pour toujours (une seule alerte par palier).
// ❌ Ne JAMAIS faire échouer la fonction entière sur un destinataire.
// ═══════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2'
import { withTrace } from '../_shared/trace.ts'
import { opsAlert } from '../_shared/alert.ts'
import { sendBillingMail } from '../_shared/billing-mail.ts'
import { seatAlertMail, shouldAlert } from '../_shared/seat-alert-text.ts'
import { withCronLease } from '../_shared/cron-lease.ts'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://thecosmo.app'
const CRON_SECRET = Deno.env.get('CRON_SECRET')

/** Plafond d'envois par exécution (W-4) : le reste part le lendemain. */
const MAX_ALERTS_PER_RUN = 200

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

interface SeatCandidate {
  org_id: string
  org_name: string
  owner_email: string
  tier_key: string
  member_count: number
  quota: number | null
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(withTrace('seat-alert', async (req) => {
  // ÉCHEC FERMÉ : secret absent = refus, jamais une porte ouverte.
  if (!CRON_SECRET) {
    await opsAlert('seat-alert', 'CRON_SECRET absent : la fonction refuse tout appel, aucune alerte de sieges ne part')
    return json({ error: 'cron_secret_not_configured' }, 503)
  }
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return json({ error: 'unauthorized' }, 401)
  }

  // Bail du job (mig. 245, `_shared/cron-lease.ts`) : deux passages simultanés
  // (pg_cron et GitHub pendant la bascule, un rattrapage manuel) ne travaillent
  // jamais ensemble. Le second rend `skipped` sans rien lire ni envoyer.
  return withCronLease((fn, args) => supabaseAdmin.rpc(fn, args), 'seat-alert', {
    onBusy: () => json({ skipped: 'already_running' }),
    onError: async () => {
      await opsAlert('seat-alert', 'bail du job illisible (cron_lease_acquire en echec) : aucune alerte de sieges ce passage')
      return json({ error: 'lease_failed' }, 500)
    },
    work: async () => {
      const { data, error } = await supabaseAdmin.rpc('orgs_for_seat_alert')
      if (error) {
        console.error('orgs_for_seat_alert failed:', error)
        await opsAlert('seat-alert', 'la selection des alertes de sieges a echoue')
        return json({ error: 'query_failed' }, 500)
      }

      const due = ((data ?? []) as SeatCandidate[]).filter((o) => shouldAlert(o.member_count, o.quota))
      const batch = due.slice(0, MAX_ALERTS_PER_RUN)
      let sent = 0
      let failed = 0

      for (const org of batch) {
        try {
          const mail = seatAlertMail({
            orgName: org.org_name,
            tierKey: org.tier_key,
            memberCount: org.member_count,
            quota: org.quota as number,
            appUrl: APP_URL,
          })
          const messageId = await sendBillingMail('seat-alert', org.owner_email, mail)
          if (!messageId) {
            failed++
            continue
          }
          // APRÈS l'envoi. Un rejeu concurrent rend 23505 : déjà tracé, rien à faire.
          const { error: traceError } = await supabaseAdmin.from('org_seat_alerts').insert({
            org_id: org.org_id,
            tier_key: org.tier_key,
            recipient: org.owner_email,
            provider_message_id: messageId,
          })
          if (traceError && (traceError as { code?: string }).code !== '23505') {
            await opsAlert('seat-alert', `alerte envoyee mais NON enregistree (${org.org_id}) : elle repartira demain`)
          }
          sent++
        } catch (err) {
          console.error('seat alert failed for org:', err)
          failed++
        }
      }

      if (failed > 0) {
        await opsAlert('seat-alert', `${failed} alerte(s) de sieges non envoyee(s) sur ${batch.length}`)
      }
      if (due.length > batch.length) {
        await opsAlert('seat-alert', `${due.length - batch.length} alerte(s) reportee(s) au lendemain (plafond ${MAX_ALERTS_PER_RUN})`)
      }

      return json({ due: due.length, sent, failed, deferred: due.length - batch.length })
    },
  })
}))
