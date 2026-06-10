// ═══════════════════════════════════════════════════════════════════
// Alerting ops minimal pour Edge Functions (audit 2026-06-10 — P1
// « pas d'alerting backend » : un webhook Stripe en échec répété était
// invisible jusqu'à l'abandon des retries = perte de revenu silencieuse).
//
// Fonctionnement : POST JSON fire-and-forget vers OPS_ALERT_WEBHOOK_URL
// (Slack incoming webhook, Discord webhook, ou tout endpoint compatible —
// les deux clés `text` et `content` sont envoyées pour couvrir les deux
// formats). Si le secret n'est pas configuré → no-op total, zéro coût.
//
//   supabase secrets set OPS_ALERT_WEBHOOK_URL=https://hooks.slack.com/...
//
// Règles :
// - Ne JAMAIS throw (une panne d'alerting ne doit pas casser le handler).
// - Ne JAMAIS inclure de PII (email, user_id en clair) ni de message
//   d'erreur brut contenant des secrets — résumés génériques only (M-9).
// - Timeout court (3 s) pour ne pas retenir la réponse HTTP du caller.
// ═══════════════════════════════════════════════════════════════════

export async function opsAlert(source: string, summary: string): Promise<void> {
  const url = Deno.env.get('OPS_ALERT_WEBHOOK_URL')
  if (!url) return
  const message = `🚨 [cosmo/${source}] ${summary}`
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message, content: message }),
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    // Fire-and-forget : l'échec d'alerte est lui-même loggé nulle part —
    // par construction, on ne peut pas alerter sur l'alerting.
  }
}
