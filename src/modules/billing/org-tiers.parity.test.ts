// ═══════════════════════════════════════════════════════════════════
// Parité tarifs front ↔ Edge Functions.
//
// Les montants affichés (landing + espace entreprise) viennent de
// `ENTERPRISE_PRICING_TIERS`. Les montants FACTURÉS viennent des price IDs
// Stripe résolus par `_shared/org-tiers.ts`, côté Deno. Ces deux listes ne
// peuvent pas être un seul fichier (le bundle front ne doit pas embarquer la
// grille Stripe, et une Edge Function ne lit pas `src/`), donc elles peuvent
// diverger en silence : on annoncerait 50 € et on facturerait 100 €.
//
// Ce test est le seul garde-fou contre ça. L'import relatif hors de `src/`
// est délibéré : `_shared/org-tiers.ts` est du TS pur sans API Deno, et ce
// fichier de test n'entre jamais dans le bundle Vite.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  ENTERPRISE_PRICING_TIERS,
  ENTERPRISE_YEARLY_DISCOUNT,
  yearlyMonthlyEquivalentEur,
  yearlyTotalEur,
} from './premium-config';
import {
  ORG_TIERS,
  tierByKey,
  priceIdForTier,
  tierFromPriceId,
  FREE_TIER_MAX_MEMBERS,
  ENTERPRISE_YEARLY_DISCOUNT as SHARED_YEARLY_DISCOUNT,
  yearlyMonthlyEquivalentEur as sharedYearlyMonthly,
  yearlyTotalEur as sharedYearlyTotal,
} from '../../../supabase/functions/_shared/org-tiers';

describe('parité ENTERPRISE_PRICING_TIERS ↔ _shared/org-tiers.ts', () => {
  it('même nombre de paliers', () => {
    expect(ORG_TIERS).toHaveLength(ENTERPRISE_PRICING_TIERS.length);
  });

  it('mêmes clés, bornes et montants, dans le même ordre', () => {
    ENTERPRISE_PRICING_TIERS.forEach((front, i) => {
      const shared = ORG_TIERS[i];
      expect(shared.key).toBe(front.key);
      expect(shared.minMembers).toBe(front.minMembers);
      expect(shared.maxMembers).toBe(front.maxMembers);
      expect(shared.priceEurPerMonth).toBe(front.priceEurPerMonth);
    });
  });

  it('le palier gratuit est le seul sans variable de prix mensuelle', () => {
    const sansPrix = ORG_TIERS.filter((t) => t.priceEnvVarMonthly === null);
    expect(sansPrix.map((t) => t.key)).toEqual(['free']);
  });

  it('chaque palier payant nomme une variable annuelle DISTINCTE de la mensuelle', () => {
    // Ce secret est OPTIONNEL depuis le 2026-08-25 : le prix annuel se dérive
    // du produit Stripe (`org-stripe-prices.ts`). Ce qui reste vital, c'est que
    // les deux noms diffèrent — les confondre ferait résoudre l'annuel sur le
    // price ID mensuel, donc facturer 50 € par an au lieu de 420 €.
    ORG_TIERS.filter((t) => t.key !== 'free').forEach((t) => {
      expect(t.priceEnvVarYearly).toBeTruthy();
      expect(t.priceEnvVarYearly).not.toBe(t.priceEnvVarMonthly);
    });
    expect(tierByKey('free')?.priceEnvVarYearly).toBeNull();
  });

  it('FREE_TIER_MAX_MEMBERS vaut le plafond du palier gratuit', () => {
    expect(FREE_TIER_MAX_MEMBERS).toBe(tierByKey('free')?.maxMembers);
  });
});

describe('parité de la remise annuelle front ↔ Deno', () => {
  it('même taux de remise des deux côtés', () => {
    expect(SHARED_YEARLY_DISCOUNT).toBe(ENTERPRISE_YEARLY_DISCOUNT);
    expect(ENTERPRISE_YEARLY_DISCOUNT).toBe(0.3);
  });

  it('même montant annuel dérivé pour chaque palier', () => {
    ENTERPRISE_PRICING_TIERS.forEach((tier) => {
      expect(sharedYearlyMonthly(tier.priceEurPerMonth)).toBe(
        yearlyMonthlyEquivalentEur(tier.priceEurPerMonth),
      );
      expect(sharedYearlyTotal(tier.priceEurPerMonth)).toBe(yearlyTotalEur(tier.priceEurPerMonth));
    });
  });

  it('le total annuel vaut exactement 12 × le prix mensuel affiché', () => {
    // Ce que le client multiplie de tête doit tomber juste : la grille affiche
    // l'équivalent mensuel, la ligne du dessous le débit annuel.
    ENTERPRISE_PRICING_TIERS.forEach((tier) => {
      expect(yearlyTotalEur(tier.priceEurPerMonth)).toBe(
        yearlyMonthlyEquivalentEur(tier.priceEurPerMonth) * 12,
      );
    });
  });

  it('l’annuel coûte bien 30 % de moins que douze mois au tarif mensuel', () => {
    expect(yearlyTotalEur(20)).toBe(168);
    expect(yearlyTotalEur(50)).toBe(420);
    expect(yearlyTotalEur(100)).toBe(840);
    expect(yearlyTotalEur(200)).toBe(1680);
  });

  it('le palier gratuit reste gratuit dans les deux périodicités', () => {
    expect(yearlyMonthlyEquivalentEur(0)).toBe(0);
    expect(yearlyTotalEur(0)).toBe(0);
  });
});

describe('résolution des price IDs', () => {
  const env = (name: string): string | undefined =>
    ({
      STRIPE_ORG_PRICE_T10: 'price_t10',
      STRIPE_ORG_PRICE_T20: 'price_t20',
      STRIPE_ORG_PRICE_T50: 'price_t50',
      STRIPE_ORG_PRICE_TMAX: 'price_tmax',
      STRIPE_ORG_PRICE_T10_YEARLY: 'price_t10_y',
      STRIPE_ORG_PRICE_T20_YEARLY: 'price_t20_y',
      STRIPE_ORG_PRICE_T50_YEARLY: 'price_t50_y',
      STRIPE_ORG_PRICE_TMAX_YEARLY: 'price_tmax_y',
    })[name];

  it('rend le price ID du palier demandé', () => {
    expect(priceIdForTier('t20', env)).toBe('price_t20');
  });

  it('sans périodicité, c’est le mensuel — le défaut ne change pas', () => {
    expect(priceIdForTier('t20', env)).toBe(priceIdForTier('t20', env, 'monthly'));
  });

  it('rend le price ID annuel quand l’annuel est demandé', () => {
    expect(priceIdForTier('t20', env, 'yearly')).toBe('price_t20_y');
    expect(priceIdForTier('tmax', env, 'yearly')).toBe('price_tmax_y');
  });

  it('rend null pour le palier gratuit en annuel aussi', () => {
    expect(priceIdForTier('free', env, 'yearly')).toBeNull();
  });

  it('rend null quand seul le secret annuel manque', () => {
    const sansAnnuel = (name: string) => (name.endsWith('_YEARLY') ? undefined : env(name));
    expect(priceIdForTier('t20', sansAnnuel, 'yearly')).toBeNull();
    expect(priceIdForTier('t20', sansAnnuel)).toBe('price_t20');
  });

  it('rend null pour le palier gratuit (aucun checkout possible)', () => {
    expect(priceIdForTier('free', env)).toBeNull();
  });

  it('rend null quand la variable d’environnement est absente', () => {
    expect(priceIdForTier('t20', () => undefined)).toBeNull();
  });

  it('retrouve le palier depuis un price ID (sens inverse, portail Stripe)', () => {
    expect(tierFromPriceId('price_t50', env)?.tier.key).toBe('t50');
    expect(tierFromPriceId('price_t50', env)?.interval).toBe('monthly');
  });

  it('retrouve AUSSI la périodicité annuelle — un basculement fait depuis le portail', () => {
    // Passer de mensuel à annuel depuis le Billing Portal ne repasse pas par
    // notre checkout : sans ce sens inverse, l'espace entreprise continuerait
    // d'annoncer « par mois » à un client engagé à l'année.
    expect(tierFromPriceId('price_t50_y', env)?.tier.key).toBe('t50');
    expect(tierFromPriceId('price_t50_y', env)?.interval).toBe('yearly');
  });

  it('rend undefined pour un price ID inconnu — jamais un repli silencieux', () => {
    expect(tierFromPriceId('price_supprime', env)).toBeUndefined();
  });
});
