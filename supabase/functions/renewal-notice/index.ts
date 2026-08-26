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
// Appelée une fois par jour par `.github/workflows/renewal-notice.yml`. Pas
// par `pg_cron` : appeler une Edge Function depuis Postgres exigerait
// `pg_net`, non installé, et installer une extension pour un travail
// quotidien serait payer cher une commodité.
//
// ── IDEMPOTENCE ────────────────────────────────────────────────────
//
// La clé primaire `(org_id, period_end)` de `renewal_notices` garantit un
// avis par échéance. Le travail peut donc tourner tous les jours pendant les
// trente jours de la fenêtre sans que personne ne reçoive deux fois le même
// message. C'est aussi ce qui rend un rattrapage sûr après une panne.
//
// ❌ Ne JAMAIS enregistrer l'avis AVANT l'envoi : on aurait la preuve d'un
//    message jamais parti, ce qui est exactement l'inverse du but.
// ❌ Ne JAMAIS faire échouer la fonction entière sur un destinataire en
//    erreur : les autres avis de la journée doivent partir quand même.
// ═══════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2'
import { opsAlert } from '../_shared/alert.ts'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://thecosmo.app'
const MAIL_FROM = Deno.env.get('BUG_REPORT_FROM') ?? 'Cosmo <bug@thecosmo.app>'

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

function frenchDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function body(org: DueOrg): { text: string; html: string } {
  const date = frenchDate(org.period_end)
  const manage = `${APP_URL}/entreprise?tab=billing`
  const lines = [
    `Bonjour,`,
    ``,
    `Votre abonnement Cosmo Entreprise pour l'organisation « ${org.org_name} » arrive a echeance le ${date}.`,
    ``,
    `Conformement a l'article L215-1 du Code de la consommation, nous vous informons que vous pouvez, si vous le souhaitez, NE PAS le reconduire.`,
    ``,
    `- Pour ne pas reconduire : resiliez depuis votre espace entreprise, ${manage}. La resiliation prend effet au terme de la periode deja payee, sans frais ni justification.`,
    `- Pour continuer : vous n'avez rien a faire, l'abonnement se reconduira automatiquement le ${date}.`,
    ``,
    `Si vous ne resiliez pas et que vous n'aviez pas recu cette information, la loi vous permettrait de resilier a tout moment apres la reconduction. Nous vous l'adressons donc dans les delais prevus.`,
    ``,
    `L'equipe Cosmo`,
  ]
  return {
    text: lines.join('\n'),
    html: lines
      .map((l) => (l === '' ? '<br>' : `<p style="margin:0 0 8px">${l}</p>`))
      .join(''),
  }
}

Deno.serve(async (req) => {
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
      const { text, html } = body(org)
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: MAIL_FROM,
          to: [org.owner_email],
          subject: `Votre abonnement Cosmo se reconduit le ${frenchDate(org.period_end)}`,
          text,
          html,
        }),
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) {
        failed.push(org.org_id)
        continue
      }

      // APRÈS l'envoi, jamais avant. Si cette écriture échoue, l'avis repartira
      // demain : un doublon est un désagrément, une absence de preuve est un
      // risque juridique. On penche volontairement du côté du doublon.
      const { error: traceError } = await supabaseAdmin.from('renewal_notices').insert({
        org_id: org.org_id,
        period_end: org.period_end,
        recipient: org.owner_email,
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

  return new Response(JSON.stringify({ due: due.length, sent, failed: failed.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
