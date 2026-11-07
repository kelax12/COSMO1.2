// ═══════════════════════════════════════════════════════════════════
// Avis de reconduction tacite — Code de la consommation art. L215-1
//
// Le professionnel doit informer le consommateur, par écrit, de sa faculté de
// NE PAS reconduire son abonnement. Fenêtre bornée des deux côtés : au plus
// tôt trois mois, au plus tard un mois avant le terme.
//
// Ne pas envoyer cet avis ne coûte pas une amende : ça transforme un
// abonnement annuel en abonnement résiliable À TOUT MOMENT et sans frais, à
// compter de la reconduction, avec remboursement des échéances déjà payées.
// L'oubli se paie donc directement en chiffre d'affaires.
//
// ── DÉCLENCHEMENT ──────────────────────────────────────────────────
//
// Appelée une fois par jour par pg_cron (job `cosmo-renewal-notice`, mig.
// 246), qui passe par `cron_invoke()` (pg_net, secret dans Vault) et note
// chaque exécution dans `cron_runs` (mig. 245, ARC-06). Le cron de GitHub
// (`.github/workflows/renewal-notice.yml`) ne garantissait ni l'heure ni
// l'exécution ; il reste en `workflow_dispatch` pour un rattrapage.
//
// ── IDEMPOTENCE ────────────────────────────────────────────────────
//
// La contrainte UNIQUE `(org_id, period_end)` de `renewal_notices` garantit un
// avis par échéance. ⚠️ C'était la clé PRIMAIRE jusqu'à la mig. 138 : celle-ci
// a posé une clé de substitution `id` pour rendre `org_id` nullable (les
// preuves survivent à la suppression de l'organisation), et a redescendu le
// couple en CONTRAINTE — pas en simple index, pour que le `23505` ci-dessous
// continue d'arriver. Vérifié en base le 2026-09-12. Le travail peut donc tourner tous les jours pendant les
// trente jours de la fenêtre sans que personne ne reçoive deux fois le même
// message. C'est aussi ce qui rend un rattrapage sûr après une panne.
//
// ❌ Ne JAMAIS enregistrer l'avis AVANT l'envoi : on aurait la preuve d'un
//    message jamais parti, ce qui est exactement l'inverse du but.
// ❌ Ne JAMAIS faire échouer la fonction entière sur un destinataire en
//    erreur : les autres avis de la journée doivent partir quand même.
// ═══════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2'
import { withTrace } from '../_shared/trace.ts'
import { opsAlert } from '../_shared/alert.ts'
import { renewalNoticeMail } from '../_shared/renewal-notice-text.ts'
import { withCronLease } from '../_shared/cron-lease.ts'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://thecosmo.app'
/**
 * Expéditeur des avis L215-1.
 *
 * ⚠️ AUCUNE VALEUR PAR DÉFAUT (audit Stripe 2026-09-02). Elle valait
 * `Cosmo <bug@thecosmo.app>`, or le domaine vérifié chez Resend est
 * `send.thecosmo.app` : la racine porte les MX et le SPF d'IONOS et ne sera
 * jamais signée. Ce défaut ne dégradait donc pas l'envoi, il le rendait
 * IMPOSSIBLE — et en silence, sur la fonction qui porte une obligation légale
 * dont l'oubli rend l'abonnement résiliable à tout moment.
 *
 * `docs/DEPLOYMENT.md` §2ter le disait déjà ; le code, lui, offrait la valeur
 * qui échoue. Sans le secret, la fonction refuse de tourner et le dit.
 */
// Expéditeur de facturation (billing@, 2026-11-01), repli sur l'expéditeur
// historique : deux SECRETS, jamais une adresse codée en dur (C-36).
const MAIL_FROM = Deno.env.get('BILLING_FROM') || Deno.env.get('BUG_REPORT_FROM')

/**
 * Secret partagé avec la CI. La fonction est déployée en `verify_jwt = false`
 * (aucun utilisateur ne l'appelle), donc c'est CE secret qui l'autorise. Sans
 * lui, n'importe qui pourrait déclencher un envoi massif d'emails depuis notre
 * domaine, ce qui abîmerait sa réputation d'expéditeur.
 */
const CRON_SECRET = Deno.env.get('CRON_SECRET')

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

interface DueOrg {
  org_id: string
  org_name: string
  owner_email: string
  period_end: string
  tier_key: string
}

Deno.serve(withTrace('renewal-notice', async (req) => {
  // ÉCHEC FERMÉ, volontairement. Une première version écrivait
  // `if (CRON_SECRET && ...)`, ce qui laissait passer TOUT LE MONDE tant que
  // le secret n'était pas posé — et il ne l'était pas. Sur une fonction qui
  // envoie des emails depuis notre domaine, une porte ouverte ne coûte pas
  // une fuite de données mais la réputation d'expéditeur du domaine, qui met
  // des mois à se reconstruire.
  //
  // ❌ Ne jamais rendre une garde conditionnelle à la présence de son propre
  //    secret : c'est se protéger uniquement quand on est déjà protégé.
  if (!CRON_SECRET) {
    await opsAlert('renewal-notice', 'CRON_SECRET absent — la fonction refuse tout appel, les avis L215-1 ne partent pas')
    return new Response(JSON.stringify({ error: 'cron_secret_not_configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!MAIL_FROM) {
    await opsAlert('renewal-notice', 'BUG_REPORT_FROM absent — aucun avis L215-1 ne peut partir (le domaine par defaut n est pas signe par Resend)')
    return new Response(JSON.stringify({ error: 'sender_not_configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    // 503 et non 500 : ce n'est pas un bug, c'est une configuration absente.
    // La distinction compte pour qui lit les logs six mois plus tard.
    await opsAlert('renewal-notice', 'RESEND_API_KEY absent — aucun avis de reconduction ne peut partir')
    return new Response(JSON.stringify({ error: 'mail_not_configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Bail du job (mig. 245, `_shared/cron-lease.ts`) : deux passages simultanés
  // (pg_cron et GitHub pendant la bascule, un rattrapage manuel) ne travaillent
  // jamais ensemble. Le second rend `skipped` sans rien lire ni envoyer.
  return withCronLease((fn, args) => supabaseAdmin.rpc(fn, args), 'renewal-notice', {
    onBusy: () => new Response(JSON.stringify({ skipped: 'already_running' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    onError: async () => {
      await opsAlert('renewal-notice', 'bail du job illisible (cron_lease_acquire en echec) : aucun avis L215-1 ce passage')
      return new Response(JSON.stringify({ error: 'lease_failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    },
    work: async () => {
      const { data, error } = await supabaseAdmin.rpc('orgs_due_for_renewal_notice')
      if (error) {
        console.error('orgs_due_for_renewal_notice failed:', error)
        await opsAlert('renewal-notice', 'la selection des avis de reconduction a echoue — obligation L215-1 non tenue ce jour')
        return new Response(JSON.stringify({ error: 'query_failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const due = (data ?? []) as DueOrg[]
      let sent = 0
      const failed: string[] = []

      for (const org of due) {
        try {
          // SV-5 : le nom d'organisation, écrit par ses admins, est échappé dans le HTML.
          const { subject, text, html } = renewalNoticeMail(org, APP_URL)
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: MAIL_FROM,
              to: [org.owner_email],
              subject,
              text,
              html,
            }),
            signal: AbortSignal.timeout(15000),
          })

          if (!res.ok) {
            failed.push(org.org_id)
            continue
          }
          // Identifiant du message chez Resend : la preuve en cas de litige.
          // Corps d'un SUCCÈS, lu pour l'identifiant seul : jamais relayé (C-36).
          const sentBody = (await (res.json() as Promise<{ id?: string }>).catch(() => ({}))) as { id?: string }

          // APRÈS l'envoi, jamais avant. Si cette écriture échoue, l'avis repartira
          // demain : un doublon est un désagrément, une absence de preuve est un
          // risque juridique. On penche volontairement du côté du doublon.
          const { error: traceError } = await supabaseAdmin.from('renewal_notices').insert({
            org_id: org.org_id,
            period_end: org.period_end,
            recipient: org.owner_email,
            provider_message_id: sentBody.id ?? null,
          })
          if (traceError && (traceError as { code?: string }).code !== '23505') {
            await opsAlert('renewal-notice', `avis envoye a une organisation mais preuve NON enregistree (${org.org_id})`)
          }
          sent++
        } catch (err) {
          console.error('renewal notice failed for org:', err)
          failed.push(org.org_id)
        }
      }

      if (failed.length > 0) {
        await opsAlert('renewal-notice', `${failed.length} avis de reconduction non envoye(s) sur ${due.length} — obligation L215-1 en risque`)
      }

      // ── Rappel jamais parti au moins un mois avant (§5) ─────────────
      // Ces abonnements deviennent résiliables à tout moment après le
      // renouvellement, avec remboursement au prorata sous 30 jours : on les
      // MARQUE (l'outil admin l'exige pour rembourser) et on prévient l'équipe.
      let missed = 0
      const { data: missing, error: missingError } = await supabaseAdmin.rpc('orgs_missing_renewal_notice')
      if (missingError) {
        await opsAlert('renewal-notice', 'la detection des rappels de renouvellement manques a echoue')
      } else {
        for (const m of (missing ?? []) as { org_id: string }[]) {
          const { error: markError } = await supabaseAdmin
            .from('org_subscriptions')
            .update({ renewal_notice_missed_at: new Date().toISOString() })
            .eq('org_id', m.org_id)
          if (!markError) missed++
        }
        if (missed > 0) {
          await opsAlert('renewal-notice', `${missed} abonnement(s) annuel(s) SANS rappel L215-1 a un mois du terme : marques, resiliables a tout moment avec prorata`)
        }
      }

      // ── Relance J+10 des rétractations non remboursées (§2) ─────────
      // Le remboursement est dû sous 14 jours (L221-24) ; au-delà, pénalités.
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
      const { data: late, error: lateError } = await supabaseAdmin
        .from('org_withdrawals')
        .select('id, org_id, amount_due_cents, withdrawn_at')
        .is('refunded_at', null)
        .is('reminder_sent_at', null)
        .lte('withdrawn_at', tenDaysAgo)
      if (lateError) {
        await opsAlert('renewal-notice', 'la lecture des retractations non remboursees a echoue')
      } else {
        for (const w of late ?? []) {
          await opsAlert(
            'renewal-notice',
            `RELANCE J+10 : retractation org ${w.org_id} du ${String(w.withdrawn_at).slice(0, 10)} NON remboursee (${(w.amount_due_cents / 100).toFixed(2)} EUR). Echeance legale J+14.`,
          )
          await supabaseAdmin.from('org_withdrawals').update({ reminder_sent_at: new Date().toISOString() }).eq('id', w.id)
        }
      }

      return new Response(JSON.stringify({ due: due.length, sent, failed: failed.length, missed, lateWithdrawals: late?.length ?? 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })
}))
