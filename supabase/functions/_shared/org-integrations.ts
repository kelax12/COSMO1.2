// ═══════════════════════════════════════════════════════════════════
// Parties PURES des Edge Functions `org-webhook-dispatch` et
// `verify-org-domain` (mig. 195, 199). Aucun import Deno ni npm : exécutable
// par vitest (`src/org-edge-functions.guard.test.ts`), comme `refund-replay.ts`.
// ═══════════════════════════════════════════════════════════════════

export interface WebhookPayload {
  organization?: string
  task?: { name?: string; status?: string; project?: string; deadline?: string | null }
}

const STATUS_FR: Record<string, string> = {
  todo: 'À faire', in_progress: 'En cours', review: 'En relecture', blocked: 'Bloquée', done: 'Terminée',
}

/** Échappement des caractères de contrôle du format Slack (`<`, `>`, `&`). */
export const slackEscape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Message lisible pour un « Incoming Webhook » Slack. */
export function slackText(event: string, payload: WebhookPayload, appUrl: string): string {
  const task = payload.task ?? {}
  const name = slackEscape(task.name ?? 'Tâche')
  const project = task.project ? ` (${slackEscape(task.project)})` : ''
  const verb = event === 'task.created'
    ? 'Nouvelle tâche'
    : event === 'task.completed'
      ? 'Tâche terminée'
      : `Statut : ${STATUS_FR[task.status ?? ''] ?? task.status ?? '?'}`
  return `${verb} : *${name}*${project} · <${appUrl}/entreprise/tasks|Ouvrir Cosmo>`
}

/**
 * Le jeton est-il publié ? Plusieurs TXT peuvent coexister sur le nom, et un
 * TXT long peut être découpé en plusieurs chaînes (RFC 7208 §3.3).
 */
export function txtMatches(records: string[][], token: string): boolean {
  return records.some((parts) => parts.join('').trim() === `cosmo-verify=${token}`)
}
