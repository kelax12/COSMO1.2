// ═══════════════════════════════════════════════════════════════════
// Résolution du price ID annuel — le seul endroit où COSMO CHOISIT un prix.
//
// Le chemin mensuel ne choisit rien : un secret désigne le price ID, point.
// L'annuel, lui, est dérivé du produit Stripe, donc il y a un choix, donc il y
// a une manière de se tromper de montant. Ces tests décrivent exactement quand
// la résolution accepte et, surtout, quand elle DOIT refuser.
//
// L'import relatif hors de `src/` est délibéré, comme pour
// `org-tiers.parity.test.ts` : `_shared/org-stripe-prices.ts` est du TS pur
// (aucune API Deno, aucun spécificateur `npm:`) et n'entre jamais dans le
// bundle Vite.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveYearlyPriceId,
  resolveTierMatch,
  resetProductIndex,
  yearlyUnitAmountCents,
  type StripeLike,
  type StripePriceLike,
} from '../../../supabase/functions/_shared/org-stripe-prices';
import { tierByKey, tierFromPriceId } from '../../../supabase/functions/_shared/org-tiers';

const T20 = tierByKey('t20')!;

/** Environnement ne portant QUE les secrets mensuels (l'état réel en prod). */
const monthlyOnly = (name: string): string | undefined =>
  ({
    STRIPE_ORG_PRICE_T10: 'price_m10',
    STRIPE_ORG_PRICE_T20: 'price_m20',
    STRIPE_ORG_PRICE_T50: 'price_m50',
    STRIPE_ORG_PRICE_TMAX: 'price_mmax',
  })[name];

const price = (over: Partial<StripePriceLike> & { id: string }): StripePriceLike => ({
  product: 'prod_t20',
  unit_amount: 42000,
  currency: 'eur',
  active: true,
  recurring: { interval: 'year', interval_count: 1 },
  ...over,
});

/** Faux client Stripe : un catalogue en mémoire, aucun réseau. */
function fakeStripe(catalogue: Record<string, StripePriceLike[]>): StripeLike {
  const byId = new Map<string, StripePriceLike>();
  Object.values(catalogue).forEach((list) => list.forEach((p) => byId.set(p.id, p)));
  return {
    prices: {
      retrieve: (id) => {
        const found = byId.get(id);
        return found ? Promise.resolve(found) : Promise.reject(new Error(`no such price: ${id}`));
      },
      list: ({ product }) => Promise.resolve({ data: catalogue[product] ?? [] }),
    },
  };
}

const MONTHLY_T20 = price({
  id: 'price_m20',
  unit_amount: 5000,
  recurring: { interval: 'month', interval_count: 1 },
});

beforeEach(() => resetProductIndex());

describe('yearlyUnitAmountCents', () => {
  it('vaut le total annuel de la grille, en centimes', () => {
    expect(yearlyUnitAmountCents(T20)).toBe(42000); // 50 € → 35 €/mois → 420 €/an
    expect(yearlyUnitAmountCents(tierByKey('t10')!)).toBe(16800);
    expect(yearlyUnitAmountCents(tierByKey('tmax')!)).toBe(168000);
  });
});

describe('resolveYearlyPriceId', () => {
  it('dérive le prix annuel du produit portant le prix mensuel', async () => {
    const stripe = fakeStripe({
      prod_t20: [MONTHLY_T20, price({ id: 'price_y20' })],
    });
    const res = await resolveYearlyPriceId(stripe, T20, monthlyOnly);
    expect(res).toEqual({ ok: true, priceId: 'price_y20', source: 'derived' });
  });

  it('préfère le secret explicite quand il existe, sans appeler Stripe', async () => {
    const stripe: StripeLike = {
      prices: {
        retrieve: () => Promise.reject(new Error('ne doit pas être appelé')),
        list: () => Promise.reject(new Error('ne doit pas être appelé')),
      },
    };
    const withOverride = (name: string) =>
      name === 'STRIPE_ORG_PRICE_T20_YEARLY' ? 'price_epingle' : monthlyOnly(name);
    const res = await resolveYearlyPriceId(stripe, T20, withOverride);
    expect(res).toEqual({ ok: true, priceId: 'price_epingle', source: 'env' });
  });

  it('REFUSE un prix annuel du mauvais montant — jamais facturer autre chose que l’annoncé', async () => {
    const stripe = fakeStripe({
      prod_t20: [MONTHLY_T20, price({ id: 'price_y20', unit_amount: 60000 })],
    });
    const res = await resolveYearlyPriceId(stripe, T20, monthlyOnly);
    expect(res.ok).toBe(false);
    expect(res).toMatchObject({ reason: 'not_found' });
  });

  it('REFUSE une autre devise', async () => {
    const stripe = fakeStripe({
      prod_t20: [MONTHLY_T20, price({ id: 'price_y20', currency: 'usd' })],
    });
    expect((await resolveYearlyPriceId(stripe, T20, monthlyOnly)).ok).toBe(false);
  });

  it('REFUSE un prix inactif', async () => {
    const stripe = fakeStripe({
      prod_t20: [MONTHLY_T20, price({ id: 'price_y20', active: false })],
    });
    expect((await resolveYearlyPriceId(stripe, T20, monthlyOnly)).ok).toBe(false);
  });

  it('REFUSE un « tous les 2 ans » déguisé en annuel', async () => {
    const stripe = fakeStripe({
      prod_t20: [MONTHLY_T20, price({ id: 'price_y20', recurring: { interval: 'year', interval_count: 2 } })],
    });
    expect((await resolveYearlyPriceId(stripe, T20, monthlyOnly)).ok).toBe(false);
  });

  it('REFUSE de choisir entre deux candidates identiques', async () => {
    const stripe = fakeStripe({
      prod_t20: [MONTHLY_T20, price({ id: 'price_y20_a' }), price({ id: 'price_y20_b' })],
    });
    const res = await resolveYearlyPriceId(stripe, T20, monthlyOnly);
    expect(res).toMatchObject({ ok: false, reason: 'ambiguous' });
  });

  it('dit « mensuel manquant » quand le secret d’ancrage est absent', async () => {
    const res = await resolveYearlyPriceId(fakeStripe({}), T20, () => undefined);
    expect(res).toMatchObject({ ok: false, reason: 'monthly_missing' });
  });

  it('n’explose pas si Stripe échoue — elle rapporte', async () => {
    const stripe: StripeLike = {
      prices: {
        retrieve: () => Promise.reject(new Error('network down')),
        list: () => Promise.resolve({ data: [] }),
      },
    };
    const res = await resolveYearlyPriceId(stripe, T20, monthlyOnly);
    expect(res).toMatchObject({ ok: false, reason: 'stripe_error' });
  });

  it('ne confond pas deux paliers : chaque produit a son montant', async () => {
    const stripe = fakeStripe({
      prod_t20: [MONTHLY_T20, price({ id: 'price_y20' })],
      prod_t50: [
        price({
          id: 'price_m50',
          product: 'prod_t50',
          unit_amount: 10000,
          recurring: { interval: 'month', interval_count: 1 },
        }),
        // 420 € : le bon montant pour t20, le MAUVAIS pour t50 (840 € attendus).
        price({ id: 'price_y50_faux', product: 'prod_t50', unit_amount: 42000 }),
      ],
    });
    expect((await resolveYearlyPriceId(stripe, tierByKey('t50')!, monthlyOnly)).ok).toBe(false);
  });
});

describe('resolveTierMatch — sens inverse pour le webhook', () => {
  const catalogue = {
    prod_t20: [MONTHLY_T20, price({ id: 'price_y20' })],
  };

  it('court-circuite sur un price ID mensuel connu d’un secret, sans réseau', async () => {
    const stripe: StripeLike = {
      prices: {
        retrieve: () => Promise.reject(new Error('ne doit pas être appelé')),
        list: () => Promise.reject(new Error('ne doit pas être appelé')),
      },
    };
    const match = await resolveTierMatch(stripe, 'price_m20', monthlyOnly, tierFromPriceId);
    expect(match?.tier.key).toBe('t20');
    expect(match?.interval).toBe('monthly');
  });

  it('retrouve le palier d’un prix annuel dérivé, via son produit', async () => {
    const match = await resolveTierMatch(
      fakeStripe(catalogue),
      'price_y20',
      monthlyOnly,
      tierFromPriceId,
    );
    expect(match?.tier.key).toBe('t20');
    expect(match?.interval).toBe('yearly');
    expect(match?.tier.maxMembers).toBe(20);
  });

  it('rend undefined pour un prix annuel du bon produit mais du mauvais montant', async () => {
    const stripe = fakeStripe({
      prod_t20: [MONTHLY_T20, price({ id: 'price_bricole', unit_amount: 100 })],
    });
    expect(
      await resolveTierMatch(stripe, 'price_bricole', monthlyOnly, tierFromPriceId),
    ).toBeUndefined();
  });

  it('rend undefined pour un prix MENSUEL inconnu — la dérivation ne couvre que l’annuel', async () => {
    const stripe = fakeStripe({
      prod_t20: [
        MONTHLY_T20,
        price({
          id: 'price_m20_bis',
          unit_amount: 100,
          recurring: { interval: 'month', interval_count: 1 },
        }),
      ],
    });
    expect(
      await resolveTierMatch(stripe, 'price_m20_bis', monthlyOnly, tierFromPriceId),
    ).toBeUndefined();
  });

  it('rend undefined pour un produit étranger', async () => {
    const stripe = fakeStripe({
      prod_t20: [MONTHLY_T20],
      prod_autre: [price({ id: 'price_ailleurs', product: 'prod_autre' })],
    });
    expect(
      await resolveTierMatch(stripe, 'price_ailleurs', monthlyOnly, tierFromPriceId),
    ).toBeUndefined();
  });

  it('rend undefined si Stripe ne connaît pas le price ID', async () => {
    expect(
      await resolveTierMatch(fakeStripe(catalogue), 'price_fantome', monthlyOnly, tierFromPriceId),
    ).toBeUndefined();
  });

  it('rend undefined sur un price ID vide, sans appeler Stripe', async () => {
    const stripe: StripeLike = {
      prices: {
        retrieve: () => Promise.reject(new Error('ne doit pas être appelé')),
        list: () => Promise.reject(new Error('ne doit pas être appelé')),
      },
    };
    expect(await resolveTierMatch(stripe, '', monthlyOnly, tierFromPriceId)).toBeUndefined();
  });

  it('ne lit les prix mensuels qu’une fois par isolate', async () => {
    let retrieves = 0;
    const base = fakeStripe(catalogue);
    const counting: StripeLike = {
      prices: {
        retrieve: (id) => {
          retrieves += 1;
          return base.prices.retrieve(id);
        },
        list: base.prices.list,
      },
    };
    await resolveTierMatch(counting, 'price_y20', monthlyOnly, tierFromPriceId);
    const afterFirst = retrieves;
    await resolveTierMatch(counting, 'price_y20', monthlyOnly, tierFromPriceId);
    // Le second appel ne relit que le prix interrogé, jamais l'index.
    expect(retrieves - afterFirst).toBe(1);
    expect(afterFirst).toBeGreaterThan(1);
  });
});
