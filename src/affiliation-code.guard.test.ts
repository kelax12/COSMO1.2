// Code affiliateur commun (`_shared/affiliation-code.ts`), module PUR exécuté ici.
// PBKDF2-SHA256, sel aléatoire, une seule chaîne dans `affiliate_settings.code_hash`.
import { describe, expect, it } from 'vitest'
import { hashAffiliateCode, verifyAffiliateCode, AFFILIATE_CODE_ITERATIONS } from '../supabase/functions/_shared/affiliation-code'

describe('code affiliateur', () => {
  it('le bon code passe, un autre non', async () => {
    const stored = await hashAffiliateCode('soleil-42')
    expect(await verifyAffiliateCode('soleil-42', stored)).toBe(true)
    expect(await verifyAffiliateCode('soleil-43', stored)).toBe(false)
    expect(await verifyAffiliateCode('', stored)).toBe(false)
  })

  it('une seule chaîne, avec algorithme, itérations et sel', async () => {
    const stored = await hashAffiliateCode('x')
    const parts = stored.split('$')
    expect(parts[0]).toBe('pbkdf2-sha256')
    expect(Number(parts[1])).toBe(AFFILIATE_CODE_ITERATIONS)
    expect(parts).toHaveLength(4)
    expect(stored).not.toContain('x$')
  })

  it('sel aléatoire : deux hachages du même code diffèrent', async () => {
    expect(await hashAffiliateCode('meme')).not.toBe(await hashAffiliateCode('meme'))
  })

  it('code_hash NULL ou mal formé : accès fermé', async () => {
    expect(await verifyAffiliateCode('x', null)).toBe(false)
    expect(await verifyAffiliateCode('x', '')).toBe(false)
    expect(await verifyAffiliateCode('x', 'bcrypt$abc')).toBe(false)
    expect(await verifyAffiliateCode('x', 'pbkdf2-sha256$0$AA$AA')).toBe(false)
  })
})
