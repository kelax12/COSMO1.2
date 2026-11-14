// ═══════════════════════════════════════════════════════════════════
// Calcul de commission d'affiliation (mig. 236, formule mig. 238). Ce module pur est la
// RÉFÉRENCE que `affiliate_compute()` reproduit en SQL au centime près.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  computeCommission,
  refundCommission,
} from '../supabase/functions/_shared/affiliation-math';

const TAUX = { deductionBp: 1280, feeBp: 150, feeFixedCents: 25, rateBp: 5000 };

describe('affiliation-math', () => {
  it('2000 c sans TVA : déduction 256, frais 55, base 1689, commission 845', () => {
    expect(computeCommission({ grossCents: 2000, vatBp: 0, ...TAUX })).toEqual({
      vatCents: 0,
      deductionCents: 256,
      feeCents: 55,
      baseCents: 1689,
      commissionCents: 845,
    });
  });

  it('2400 c avec TVA 20 % : TVA 400, déduction 307, frais 61, base 1632, commission 816', () => {
    expect(computeCommission({ grossCents: 2400, vatBp: 2000, ...TAUX })).toEqual({
      vatCents: 400,
      deductionCents: 307,
      feeCents: 61,
      baseCents: 1632,
      commissionCents: 816,
    });
  });

  it('1000 c : (1000 − 128 − 40) × 1/2 = 416', () => {
    expect(computeCommission({ grossCents: 1000, vatBp: 0, ...TAUX }).commissionCents).toBe(416);
  });

  it('ancienne formule (déduction 0, 39,5 %) : 2000 c → 768, inchangé', () => {
    expect(
      computeCommission({ grossCents: 2000, vatBp: 0, deductionBp: 0, feeBp: 150, feeFixedCents: 25, rateBp: 3950 })
        .commissionCents,
    ).toBe(768);
  });

  it('10 c : la base ne devient jamais négative', () => {
    const r = computeCommission({ grossCents: 10, vatBp: 0, ...TAUX });
    expect(r.baseCents).toBe(0);
    expect(r.commissionCents).toBe(0);
  });

  it('remboursement de 1000 c sur 2000 c / 768 → −384', () => {
    expect(refundCommission({ refundCents: 1000, originGross: 2000, originCommission: 768 })).toBe(
      -384,
    );
  });

  it('remboursement : le signe du montant ne change rien, origine nulle → 0', () => {
    expect(refundCommission({ refundCents: -1000, originGross: 2000, originCommission: 768 })).toBe(
      -384,
    );
    expect(refundCommission({ refundCents: 1000, originGross: 0, originCommission: 0 })).toBe(0);
  });
});
