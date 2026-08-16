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
import { ENTERPRISE_PRICING_TIERS } from './premium-config';
import {
  ORG_TIERS,
  tierByKey,
  priceIdForTier,
  tierFromPriceId,
  FREE_TIER_MAX_MEMBERS,
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

  it('le palier gratuit est le seul sans variable de prix', () => {
    const sansPrix = ORG_TIERS.filter((t) => t.priceEnvVar === null);
    expect(sansPrix.map((t) => t.key)).toEqual(['free']);
  });

  it('FREE_TIER_MAX_MEMBERS vaut le plafond du palier gratuit', () => {
    expect(FREE_TIER_MAX_MEMBERS).toBe(tierByKey('free')?.maxMembers);
  });
});

describe('résolution des price IDs', () => {
  const env = (name: string): string | undefined =>
    ({
      STRIPE_ORG_PRICE_T10: 'price_t10',
      STRIPE_ORG_PRICE_T20: 'price_t20',
      STRIPE_ORG_PRICE_T50: 'price_t50',
      STRIPE_ORG_PRICE_TMAX: 'price_tmax',
    })[name];

  it('rend le price ID du palier demandé', () => {
    expect(priceIdForTier('t20', env)).toBe('price_t20');
  });

  it('rend null pour le palier gratuit (aucun checkout possible)', () => {
    expect(priceIdForTier('free', env)).toBeNull();
  });

  it('rend null quand la variable d’environnement est absente', () => {
    expect(priceIdForTier('t20', () => undefined)).toBeNull();
  });

  it('retrouve le palier depuis un price ID (sens inverse, portail Stripe)', () => {
    expect(tierFromPriceId('price_t50', env)?.key).toBe('t50');
  });

  it('rend undefined pour un price ID inconnu — jamais un repli silencieux', () => {
    expect(tierFromPriceId('price_supprime', env)).toBeUndefined();
  });
});
