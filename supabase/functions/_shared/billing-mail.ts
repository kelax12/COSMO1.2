// ═══════════════════════════════════════════════════════════════════
// Envoi des emails de facturation (Resend). Textes : `billing-mail-text.ts`.
// ═══════════════════════════════════════════════════════════════════
//
// Expéditeur : `BILLING_FROM` (ex. `COSMO <billing@send.thecosmo.app>`, seul
// domaine signé par Resend). ❌ Aucune valeur codée en dur (C-36).
// ❌ Ne throw jamais : un email raté ne doit pas annuler l'action Stripe
// déjà faite. L'appelant reçoit `null` et alerte.
import { opsAlert } from './alert.ts'
import type { BillingMail } from './billing-mail-text.ts'

/** Rend l'identifiant du message chez Resend (preuve), ou `null` en cas d'échec. */
export async function sendBillingMail(source: string, to: string, mail: BillingMail): Promise<string | null> {
  const from = Deno.env.get('BILLING_FROM') || Deno.env.get('BUG_REPORT_FROM')
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!from || !apiKey) {
    await opsAlert(source, `email de facturation NON envoye (« ${mail.subject} ») : BILLING_FROM ou RESEND_API_KEY absent`)
    return null
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: mail.subject, text: mail.text, html: mail.html }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      await opsAlert(source, `email de facturation refuse par Resend (« ${mail.subject} », HTTP ${res.status})`)
      return null
    }
    const body = (await (res.json() as Promise<{ id?: string }>).catch(() => ({}))) as { id?: string }
    return body.id ?? 'sent'
  } catch {
    await opsAlert(source, `email de facturation en echec reseau (« ${mail.subject} »)`)
    return null
  }
}
