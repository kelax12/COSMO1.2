// B4 affiliation : qui a payé une organisation. `_shared/org-payer.ts` est du
// TS pur (même montage que `refund-amount.test.ts`) : le webhook ne fait que
// suivre cette décision, ce test la verrouille.
import { describe, expect, it } from 'vitest'
import { payerToRecord } from '../../../supabase/functions/_shared/org-payer'

const UID = '0b5c3a52-8f1e-4c2a-9d7e-1a2b3c4d5e6f'

describe('payerToRecord', () => {
  it('renvoie le payeur valide quand purchased_by est encore NULL', () => {
    expect(payerToRecord({ payer_uid: UID }, null)).toBe(UID)
  })
  it('normalise la casse', () => {
    expect(payerToRecord({ payer_uid: UID.toUpperCase() }, null)).toBe(UID)
  })
  it("n'écrase jamais un purchased_by déjà posé", () => {
    expect(payerToRecord({ payer_uid: UID }, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBeNull()
  })
  it.each([undefined, '', 'nope', `${UID}x`, ` ${UID}`, "1' OR '1'='1"])('refuse %p', (v) => {
    expect(payerToRecord({ payer_uid: v as string }, null)).toBeNull()
  })
  it('tolère des metadata absentes', () => {
    expect(payerToRecord(null, null)).toBeNull()
    expect(payerToRecord(undefined, null)).toBeNull()
  })
})
