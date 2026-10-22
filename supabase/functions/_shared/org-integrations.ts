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

// ── Cible d'un webhook (A-6, 2026-09-30) ──────────────────────────────
//
// 🔴 La contrainte `org_webhooks_url` de la mig. 199 était une LISTE NOIRE
// textuelle (`localhost|127.|10.|192.168.|169.254.|0.|[`). Elle laissait passer
// `172.16.0.0/12`, `100.64.0.0/10`, l'IPv4 écrite en entier ou en hexadécimal
// (`https://2130706433/`, que `fetch` normalise en `127.0.0.1`), et surtout
// tout NOM qui résout vers une adresse privée (`127.0.0.1.nip.io`).
//
// Deux étages, qui ne se remplacent pas :
//   1. `webhookHostOf` : un NOM DNS à TLD alphabétique, jamais une adresse
//      écrite en clair, quelle que soit sa notation (la mig. 207 impose la
//      même forme en base) ;
//   2. `addressesArePublic` : chaque adresse que ce nom résout, A et AAAA,
//      doit être publique. Une seule adresse privée suffit à refuser.
//
// ⚠️ Risque résiduel, assumé : entre la résolution et le `fetch`, un DNS à TTL
//    nul peut encore changer de réponse (rebinding). La requête reste un POST
//    aveugle : le corps de réponse n'est ni lu ni stocké, seul le code l'est.

const HOST_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/
/** TLD réservés ou internes (RFC 2606, 6761, 6762, 8375). */
const RESERVED_TLDS = new Set(['localhost', 'local', 'internal', 'localdomain', 'lan', 'home', 'corp', 'intranet', 'private', 'arpa', 'test', 'invalid', 'example', 'onion'])

/** Le nom à résoudre, ou `null` si l'URL ne peut pas être une cible de webhook. */
export function webhookHostOf(rawUrl: string): string | null {
  let u: URL
  try {
    u = new URL(rawUrl.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || u.username || u.password) return null
  const host = u.hostname.toLowerCase().replace(/\.$/, '')
  // Rejette toute adresse littérale : après normalisation WHATWG, une IPv4
  // finit par un chiffre et une IPv6 porte des crochets.
  if (host.length > 253 || !HOST_RE.test(host)) return null
  if (RESERVED_TLDS.has(host.slice(host.lastIndexOf('.') + 1))) return null
  return host
}

function ipv4Octets(ip: string): number[] | null {
  const parts = ip.split('.')
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p))) return null
  const octets = parts.map(Number)
  return octets.every((o) => o <= 255) ? octets : null
}

function ipv4IsPublic([a, b, c]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false // 0/8, 10/8, 127/8, multicast, réservé, broadcast
  if (a === 100 && b >= 64 && b <= 127) return false // 100.64/10, CGNAT
  if (a === 169 && b === 254) return false // lien local, métadonnées cloud
  if (a === 172 && b >= 16 && b <= 31) return false // 172.16/12
  if (a === 192 && b === 168) return false // 192.168/16
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false // 192.0.0/24, 192.0.2/24
  if (a === 192 && b === 88 && c === 99) return false // relais 6to4
  if (a === 198 && (b === 18 || b === 19)) return false // 198.18/15
  if (a === 198 && b === 51 && c === 100) return false // documentation
  if (a === 203 && b === 0 && c === 113) return false // documentation
  return true
}

/** Les huit groupes d'une IPv6, `::` et IPv4 finale développés ; `null` si illisible. */
function ipv6Groups(ip: string): number[] | null {
  let s = ip.toLowerCase().split('%')[0]
  const tail = s.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (tail) {
    const o = ipv4Octets(tail[1])
    if (!o) return null
    s = s.slice(0, -tail[1].length) + `${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const missing = 8 - head.length - rest.length
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...rest]
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null
  return groups.map((g) => parseInt(g, 16))
}

/** Une adresse (IPv4 ou IPv6) est-elle joignable sur l'Internet public ? */
export function ipIsPublic(ip: string): boolean {
  const v4 = ipv4Octets(ip)
  if (v4) return ipv4IsPublic(v4)
  const g = ipv6Groups(ip)
  if (!g) return false
  // IPv4 encapsulée (`::ffff:a.b.c.d`, NAT64 `64:ff9b::a.b.c.d`) : jugée comme IPv4.
  const mapped = g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff
  const nat64 = g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)
  if (mapped || nat64) return ipv4IsPublic([g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff])
  // Seul l'unicast global `2000::/3` est public, moins ses plages spéciales.
  if (g[0] < 0x2000 || g[0] > 0x3fff) return false
  if (g[0] === 0x2001 && g[1] < 0x0200) return false // 2001::/23 (Teredo, ORCHID…)
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false // documentation
  if (g[0] === 0x2002) return false // 6to4, porte une IPv4 quelconque
  return true
}

/** Toutes les adresses résolues sont publiques, et il y en a au moins une. */
export function addressesArePublic(addresses: string[]): boolean {
  return addresses.length > 0 && addresses.every(ipIsPublic)
}

/**
 * Le jeton est-il publié ? Plusieurs TXT peuvent coexister sur le nom, et un
 * TXT long peut être découpé en plusieurs chaînes (RFC 7208 §3.3).
 */
export function txtMatches(records: string[][], token: string): boolean {
  return records.some((parts) => parts.join('').trim() === `cosmo-verify=${token}`)
}
