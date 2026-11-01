// Jeton affiliateur (`_shared/affiliation-token.ts`), module PUR exécuté ici.
// Un jeton n'ouvre l'API qu'à la bonne clé et avant son `exp`.
import { describe, expect, it } from 'vitest'
import { signAffiliateToken, verifyAffiliateToken, AFFILIATE_TOKEN_TTL_MS } from '../supabase/functions/_shared/affiliation-token'

const SECRET = 'secret-de-test'
const NOW = Date.UTC(2026, 9, 31, 12)

describe('jeton affiliateur', () => {
  it('un jeton valide passe, avec une durée de 12 h', async () => {
    const token = await signAffiliateToken(SECRET, NOW)
    const payload = await verifyAffiliateToken(token, SECRET, NOW + 1000)
    expect(payload).toEqual({ role: 'affiliate', exp: NOW + AFFILIATE_TOKEN_TTL_MS })
    expect(AFFILIATE_TOKEN_TTL_MS).toBe(12 * 3600 * 1000)
  })

  it('un jeton expiré est refusé', async () => {
    const token = await signAffiliateToken(SECRET, NOW)
    expect(await verifyAffiliateToken(token, SECRET, NOW + AFFILIATE_TOKEN_TTL_MS)).toBeNull()
  })

  it('un jeton falsifié est refusé', async () => {
    const token = await signAffiliateToken(SECRET, NOW)
    const [, sig] = token.split('.')
    const forged = btoa(JSON.stringify({ role: 'affiliate', exp: NOW + 10 * AFFILIATE_TOKEN_TTL_MS }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(await verifyAffiliateToken(`${forged}.${sig}`, SECRET, NOW)).toBeNull()
    expect(await verifyAffiliateToken(token.slice(0, -2) + 'AA', SECRET, NOW)).toBeNull()
    expect(await verifyAffiliateToken('pas-un-jeton', SECRET, NOW)).toBeNull()
  })

  it('un jeton signé avec une autre clé est refusé', async () => {
    const token = await signAffiliateToken('autre-cle', NOW)
    expect(await verifyAffiliateToken(token, SECRET, NOW)).toBeNull()
  })
})
