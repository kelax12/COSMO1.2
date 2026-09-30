// ═══════════════════════════════════════════════════════════════════
// Destination d'un webhook d'entreprise : publique, ou rien ne part
// (audit de sécurité du 2026-09-30)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI. `org-webhook-dispatch` fait un `fetch` vers une URL SAISIE PAR
// UN CLIENT, depuis l'infrastructure Supabase. La contrainte SQL de la mig.
// `199` filtrait par liste noire textuelle (`localhost`, `127.`, `10.`,
// `192.168.`, `169.254.`, `0.`, `[`) : elle laissait passer `172.16.0.0/12`,
// `100.64.0.0/10`, les IPv4 écrites en entier ou en hexadécimal (que le
// parseur d'URL de `fetch` normalise en adresse pointée), et surtout TOUT nom
// DNS qui résout vers une adresse privée.
//
// La vérification faisant foi est donc ICI, au moment de l'envoi, sur les
// adresses RÉSOLUES :
//   · `https:` seulement, port 443 seulement, aucun identifiant dans l'URL ;
//   · un NOM de domaine, jamais une adresse IP littérale ;
//   · chaque adresse A et AAAA du nom doit être publique, sinon rien ne part.
//
// ⚠️ Ce qui reste ouvert, et qu'on ne prétend pas fermer : entre cette
//    résolution et celle que fait `fetch`, un serveur DNS hostile peut changer
//    de réponse (DNS rebinding, TTL nul). `fetch` de Deno ne permet pas
//    d'épingler l'adresse résolue. La fenêtre est de quelques millisecondes, et
//    `redirect: 'manual'` empêche le rebond HTTP ; un proxy sortant filtrant
//    serait la seule fermeture complète.
//
// ✅ Module PUR : aucun import Deno, le résolveur est injecté. C'est ce qui
//    le rend testable depuis Vitest (`src/webhook-destination.guard.test.ts`),
//    même règle que `refund-replay.ts`.

export type Resolver = (host: string, type: 'A' | 'AAAA') => Promise<string[]>

export type DestinationVerdict =
  | { ok: true; host: string }
  | { ok: false; reason: string }

function parseIpv4(ip: string): number[] | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const out: number[] = []
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const n = Number(p)
    if (n > 255) return null
    out.push(n)
  }
  return out
}

/** Vrai si l'IPv4 n'est PAS routable publiquement (ou n'est pas une IPv4). */
export function isBlockedIpv4(ip: string): boolean {
  const o = parseIpv4(ip)
  if (!o) return true
  const [a, b, c] = o
  return (
    a === 0 ||                                   // 0.0.0.0/8
    a === 10 ||                                  // 10.0.0.0/8
    (a === 100 && b >= 64 && b <= 127) ||        // 100.64.0.0/10, CGNAT
    a === 127 ||                                 // boucle locale
    (a === 169 && b === 254) ||                  // lien local, métadonnées cloud
    (a === 172 && b >= 16 && b <= 31) ||         // 172.16.0.0/12
    (a === 192 && b === 0 && c === 0) ||         // 192.0.0.0/24
    (a === 192 && b === 0 && c === 2) ||         // TEST-NET-1
    (a === 192 && b === 168) ||                  // 192.168.0.0/16
    (a === 198 && (b === 18 || b === 19)) ||     // 198.18.0.0/15, bancs d'essai
    (a === 198 && b === 51 && c === 100) ||      // TEST-NET-2
    (a === 203 && b === 0 && c === 113) ||       // TEST-NET-3
    a >= 224                                     // multicast, réservé, diffusion
  )
}

/** Huit groupes de 16 bits, ou null si l'adresse n'est pas une IPv6 valide. */
function parseIpv6(raw: string): number[] | null {
  let ip = raw.toLowerCase()
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1)
  const zone = ip.indexOf('%')
  if (zone !== -1) ip = ip.slice(0, zone)

  // Queue IPv4 éventuelle (::ffff:1.2.3.4) : convertie en deux groupes.
  const lastColon = ip.lastIndexOf(':')
  const tail = ip.slice(lastColon + 1)
  if (tail.includes('.')) {
    const v4 = parseIpv4(tail)
    if (!v4) return null
    ip = `${ip.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`
  }

  const halves = ip.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const missing = 8 - head.length - rest.length
  if (halves.length === 1 && head.length !== 8) return null
  if (halves.length === 2 && missing < 1) return null
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...rest]
  if (groups.length !== 8) return null
  const out: number[] = []
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    out.push(parseInt(g, 16))
  }
  return out
}

function v4From(hi: number, lo: number): string {
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`
}

/** Vrai si l'IPv6 n'est PAS routable publiquement (ou n'est pas une IPv6). */
export function isBlockedIpv6(ip: string): boolean {
  const g = parseIpv6(ip)
  if (!g) return true
  const zeroPrefix = (n: number) => g.slice(0, n).every((x) => x === 0)

  if (g.every((x) => x === 0)) return true                        // ::
  if (zeroPrefix(7) && g[7] === 1) return true                    // ::1
  if (zeroPrefix(5) && g[5] === 0xffff) return isBlockedIpv4(v4From(g[6], g[7])) // ::ffff:a.b.c.d
  if (zeroPrefix(6)) return isBlockedIpv4(v4From(g[6], g[7]))     // ::a.b.c.d (déprécié)
  if (g[0] === 0x64 && g[1] === 0xff9b) return isBlockedIpv4(v4From(g[6], g[7])) // NAT64
  if (g[0] === 0x2002) return isBlockedIpv4(v4From(g[1], g[2]))   // 6to4
  if (g[0] === 0x2001 && g[1] === 0) return true                  // Teredo
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true             // documentation
  if ((g[0] & 0xfe00) === 0xfc00) return true                     // fc00::/7, ULA
  if ((g[0] & 0xffc0) === 0xfe80) return true                     // fe80::/10, lien local
  if ((g[0] & 0xff00) === 0xff00) return true                     // multicast
  return false
}

const FORBIDDEN_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa', '.lan', '.intranet', '.corp']

/**
 * Décide si un webhook peut partir vers `rawUrl`. Ne lève jamais : toute
 * erreur (URL illisible, DNS en panne) rend un refus.
 */
export async function checkWebhookDestination(rawUrl: string, resolve: Resolver): Promise<DestinationVerdict> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, reason: 'invalid_url' }
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'not_https' }
  if (url.username || url.password) return { ok: false, reason: 'credentials_in_url' }
  if (url.port !== '' && url.port !== '443') return { ok: false, reason: 'port_not_allowed' }

  // `URL` a déjà normalisé l'hôte : `2130706433` ou `0x7f000001` y sont
  // devenus `127.0.0.1`, et une IPv6 y est entre crochets.
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (host.startsWith('[') || parseIpv4(host)) return { ok: false, reason: 'ip_literal' }
  if (!/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/.test(host)) {
    return { ok: false, reason: 'invalid_host' }
  }
  if (host === 'localhost' || FORBIDDEN_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: 'internal_host' }
  }

  let v4: string[] = []
  let v6: string[] = []
  try {
    v4 = await resolve(host, 'A').catch(() => [])
    v6 = await resolve(host, 'AAAA').catch(() => [])
  } catch {
    return { ok: false, reason: 'dns_failed' }
  }
  if (v4.length === 0 && v6.length === 0) return { ok: false, reason: 'unresolvable' }
  // UNE seule adresse privée suffit à refuser : l'ordre d'essai de `fetch`
  // n'est pas le nôtre.
  if (v4.some(isBlockedIpv4) || v6.some(isBlockedIpv6)) return { ok: false, reason: 'private_address' }

  return { ok: true, host }
}
