// Indicateurs d'affiliation (`_shared/affiliation-metrics.ts`), module PUR exécuté ici.
import { describe, expect, it } from 'vitest'
import {
  affiliateStatus,
  retentionMonths,
  monthlyAmountCents,
  affiliateMrrCents,
  ltvCents,
  amountDueCents,
  tierLabel,
} from '../supabase/functions/_shared/affiliation-metrics'

const TODAY = new Date('2026-10-31T00:00:00Z')

describe('statut', () => {
  it('active → actif', () => {
    expect(affiliateStatus({ subscriptionStatus: 'active', paidCount: 1 })).toBe('active')
  })
  it('past_due / unpaid → paiement en échec', () => {
    expect(affiliateStatus({ subscriptionStatus: 'past_due', paidCount: 1 })).toBe('failed')
    expect(affiliateStatus({ subscriptionStatus: 'unpaid', paidCount: 1 })).toBe('failed')
  })
  it('cancelled ou retour en gratuit après un paiement → résilié', () => {
    expect(affiliateStatus({ subscriptionStatus: 'cancelled', paidCount: 2 })).toBe('cancelled')
    expect(affiliateStatus({ subscriptionStatus: null, paidCount: 1 })).toBe('cancelled')
  })
  it('jamais payé et sans abonnement → aucun statut', () => {
    expect(affiliateStatus({ subscriptionStatus: null, paidCount: 0 })).toBeNull()
  })
})

describe('rétention', () => {
  it("compte les mois du premier paiement jusqu'à aujourd'hui", () => {
    expect(retentionMonths('2026-07-31T00:00:00Z', null, TODAY)).toBe(3)
    expect(retentionMonths('2026-08-15T00:00:00Z', null, TODAY)).toBe(2)
  })
  it("s'arrête à la date d'arrêt", () => {
    expect(retentionMonths('2026-01-10T00:00:00Z', '2026-04-10T00:00:00Z', TODAY)).toBe(3)
  })
  it('sans paiement → 0', () => {
    expect(retentionMonths(null, null, TODAY)).toBe(0)
  })
})

describe('MRR', () => {
  it('un annuel compte pour 1/12', () => {
    expect(monthlyAmountCents(1200, 'year')).toBe(100)
    expect(monthlyAmountCents(500, 'month')).toBe(500)
  })
  it('39,5 % du MRR des seuls actifs', () => {
    expect(
      affiliateMrrCents(
        [
          { netCents: 1000, interval: 'month', status: 'active' },
          { netCents: 12000, interval: 'year', status: 'active' },
          { netCents: 9999, interval: 'month', status: 'cancelled' },
        ],
        3950,
      ),
    ).toBe(790)
  })
})

describe('LTV et reste à payer', () => {
  it('LTV déduit les remboursements', () => {
    expect(ltvCents([{ amountCents: 1000, refundedCents: 0 }, { amountCents: 1000, refundedCents: 400 }])).toBe(1600)
  })
  it('reste à payer = gagné − versé (négatif = trop versé)', () => {
    expect(amountDueCents([300, 200], [100])).toBe(400)
    expect(amountDueCents([100], [300])).toBe(-200)
  })
})

describe('paliers', () => {
  it('libellés', () => {
    expect(tierLabel('t10')).toBe('Entreprise 10')
    expect(tierLabel('t20')).toBe('Entreprise 20')
    expect(tierLabel('t50')).toBe('Entreprise 50')
    expect(tierLabel('tmax')).toBe('Illimité')
    expect(tierLabel('inconnu')).toBe('inconnu')
  })
})
