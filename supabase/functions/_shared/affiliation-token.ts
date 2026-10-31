// ═══════════════════════════════════════════════════════════════════
// Jeton de session affiliateur de `affiliation-api`
// Module PUR, exécuté par vitest (`src/affiliation-token.guard.test.ts`).
// ═══════════════════════════════════════════════════════════════════
//
// Charge `{ role: 'affiliate', exp }` signée en HMAC-SHA256 (Web Crypto),
// format `base64url(charge).base64url(signature)`. La clé est
// `affiliate_settings.token_secret` : changer le code la régénère, ce qui
// invalide tous les jetons en cours. La vérification compare la signature par
// `crypto.subtle.verify`, en temps constant.

export const AFFILIATE_TOKEN_TTL_MS = 12 * 60 * 60 * 1000

export interface AffiliateTokenPayload {
  role: 'affiliate'
  exp: number
}

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

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signAffiliateToken(secret: string, now = Date.now()): Promise<string> {
  const payload: AffiliateTokenPayload = { role: 'affiliate', exp: now + AFFILIATE_TOKEN_TTL_MS }
  const body = toB64url(enc.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body))
  return `${body}.${toB64url(new Uint8Array(sig))}`
}

export async function verifyAffiliateToken(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<AffiliateTokenPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 2 || !secret) return null
  const [body, sig] = parts
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(sig), enc.encode(body))
    if (!ok) return null
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Partial<AffiliateTokenPayload>
    if (payload.role !== 'affiliate' || typeof payload.exp !== 'number' || payload.exp <= now) return null
    return { role: 'affiliate', exp: payload.exp }
  } catch {
    return null
  }
}
