// Dérivations de prix et constantes de facturation. Verrouille la grille
// AFFICHÉE et la formule annuelle (le Deno la duplique : parité dans
// `org-tiers.parity.test.ts`), ainsi que l'état courant des drapeaux.
import { describe, it, expect } from 'vitest';
import {
  displayedMonthlyEur,
  ENTERPRISE_BILLING_ENFORCED,
  ENTERPRISE_PRICING_TIERS,
  ENTERPRISE_YEARLY_DISCOUNT,
  ORG_FREE_SEATS,
  PREMIUM_ENFORCED,
  PREMIUM_MONTHLY_EUR,
  PRICES_VISIBLE,
  yearlyMonthlyEquivalentEur,
  yearlyTotalEur,
} from './premium-config';

describe('drapeaux', () => {
  it('premium perso coupé, facturation entreprise armée, prix visibles', () => {
    expect(PREMIUM_ENFORCED).toBe(false);
    expect(ENTERPRISE_BILLING_ENFORCED).toBe(true);
    // On ne vend pas sans afficher de prix.
    expect(PRICES_VISIBLE || !ENTERPRISE_BILLING_ENFORCED).toBe(true);
  });

  it('montant premium perso et sièges gratuits', () => {
    expect(PREMIUM_MONTHLY_EUR).toBe(3.5);
    expect(ORG_FREE_SEATS).toBe(5);
  });
});

describe('ENTERPRISE_PRICING_TIERS', () => {
  it('grille affichée : clés, bornes et montants', () => {
    expect(ENTERPRISE_PRICING_TIERS.map((t) => [t.key, t.minMembers, t.maxMembers, t.priceEurPerMonth])).toEqual([
      ['free', 0, 5, 0],
      ['t10', 5, 10, 20],
      ['t20', 10, 20, 50],
      ['t50', 20, 50, 100],
      ['tmax', 50, null, 200],
    ]);
  });

  it('paliers contigus : chaque minimum est le maximum du précédent', () => {
    for (let i = 1; i < ENTERPRISE_PRICING_TIERS.length; i++) {
      expect(ENTERPRISE_PRICING_TIERS[i].minMembers).toBe(ENTERPRISE_PRICING_TIERS[i - 1].maxMembers);
    }
  });

  it('le palier gratuit couvre exactement les sièges gratuits', () => {
    const free = ENTERPRISE_PRICING_TIERS[0];
    expect(free.priceEurPerMonth).toBe(0);
    expect(free.maxMembers).toBe(ORG_FREE_SEATS);
  });

  it('seul le dernier palier est sans plafond, et les prix croissent', () => {
    const uncapped = ENTERPRISE_PRICING_TIERS.filter((t) => t.maxMembers === null);
    expect(uncapped.map((t) => t.key)).toEqual(['tmax']);
    for (let i = 1; i < ENTERPRISE_PRICING_TIERS.length; i++) {
      expect(ENTERPRISE_PRICING_TIERS[i].priceEurPerMonth).toBeGreaterThan(
        ENTERPRISE_PRICING_TIERS[i - 1].priceEurPerMonth,
      );
    }
  });
});

describe('dérivations annuelles', () => {
  it('remise annuelle de 30 %', () => {
    expect(ENTERPRISE_YEARLY_DISCOUNT).toBe(0.3);
  });

  it.each([
    [0, 0, 0],
    [20, 14, 168],
    [50, 35, 420],
    [100, 70, 840],
    [200, 140, 1680],
  ])('mensuel %d € : équivalent %d €/mois, %d € par an', (monthly, equivalent, total) => {
    expect(yearlyMonthlyEquivalentEur(monthly)).toBe(equivalent);
    expect(yearlyTotalEur(monthly)).toBe(total);
  });

  it('arrondit l’équivalent au centime', () => {
    // 3,33 × 0,7 = 2,331 → 2,33
    expect(yearlyMonthlyEquivalentEur(3.33)).toBe(2.33);
  });

  it('le total annuel vaut 12 × l’équivalent ARRONDI, au centime près', () => {
    // 3,33 € : équivalent 2,33 € → 27,96 €, et non 3,33 × 0,7 × 12 = 27,972 → 27,97 €.
    expect(yearlyTotalEur(3.33)).toBe(27.96);
    for (const tier of ENTERPRISE_PRICING_TIERS) {
      const eq = yearlyMonthlyEquivalentEur(tier.priceEurPerMonth);
      expect(yearlyTotalEur(tier.priceEurPerMonth)).toBe(Math.round(eq * 12 * 100) / 100);
    }
  });

  it('displayedMonthlyEur : brut au mois, équivalent à l’année', () => {
    expect(displayedMonthlyEur(50, 'monthly')).toBe(50);
    expect(displayedMonthlyEur(50, 'yearly')).toBe(35);
  });
});
