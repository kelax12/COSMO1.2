// ═══════════════════════════════════════════════════════════════════
// Calcul de commission d'affiliation (mig. 236). Ce module pur est la
// RÉFÉRENCE que `affiliate_compute()` reproduit en SQL au centime près.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  computeCommission,
  refundCommission,
} from '../supabase/functions/_shared/affiliation-math';

const TAUX = { feeBp: 150, feeFixedCents: 25, rateBp: 3950 };

describe('affiliation-math', () => {
  it('2000 c sans TVA : frais 55, base 1945, commission 768', () => {
    expect(computeCommission({ grossCents: 2000, vatBp: 0, ...TAUX })).toEqual({
      vatCents: 0,
      feeCents: 55,
      baseCents: 1945,
      commissionCents: 768,
    });
  });

  it('2400 c avec TVA 20 % : TVA 400, frais 61, base 1939, commission 766', () => {
    expect(computeCommission({ grossCents: 2400, vatBp: 2000, ...TAUX })).toEqual({
      vatCents: 400,
      feeCents: 61,
      baseCents: 1939,
      commissionCents: 766,
    });
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
