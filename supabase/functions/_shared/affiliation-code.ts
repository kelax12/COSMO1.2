// ═══════════════════════════════════════════════════════════════════
// Code affiliateur commun de `affiliation-api` (hachage et vérification)
// Module PUR, exécuté par vitest (`src/affiliation-code.guard.test.ts`).
// ═══════════════════════════════════════════════════════════════════
//
// PBKDF2-SHA256 par Web Crypto, à la place de bcrypt (aucune dépendance dans
// l'Edge Function). Format stocké dans `affiliate_settings.code_hash` :
// `pbkdf2-sha256$<itérations>$<sel b64url>$<hachage b64url>`.
// `code_hash` NULL ou illisible : la vérification échoue, l'accès reste fermé.

export const AFFILIATE_CODE_ITERATIONS = 100_000
const PREFIX = 'pbkdf2-sha256'
const enc = new TextEncoder()

function toB64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function derive(code: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return new Uint8Array(bits)
}

export async function hashAffiliateCode(code: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(code, salt, AFFILIATE_CODE_ITERATIONS)
  return `${PREFIX}$${AFFILIATE_CODE_ITERATIONS}$${toB64url(salt)}$${toB64url(hash)}`
}

export async function verifyAffiliateCode(code: string, stored: string | null): Promise<boolean> {
  if (!code || !stored) return false
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== PREFIX) return false
  const iterations = Number(parts[1])
  if (!Number.isInteger(iterations) || iterations < 1) return false
  try {
    const expected = fromB64url(parts[3])
    const got = await derive(code, fromB64url(parts[2]), iterations)
    if (got.length !== expected.length) return false
    // Comparaison en temps constant.
    let diff = 0
    for (let i = 0; i < got.length; i++) diff |= got[i] ^ expected[i]
    return diff === 0
  } catch {
    return false
  }
}
