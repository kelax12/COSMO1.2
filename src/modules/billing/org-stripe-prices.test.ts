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
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveYearlyPriceId,
  resolveTierMatch,
  resetProductIndex,
  yearlyUnitAmountCents,
  PRODUCT_INDEX_TTL_MS,
  PRODUCT_INDEX_PARTIAL_TTL_MS,
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

  it('ne relit pas les prix mensuels tant que l’index est frais', async () => {
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

// ═══════════════════════════════════════════════════════════════════
// Invalidation de l'index produit → palier (C-08).
//
// L'index était construit « une fois par isolate », sans aucun chemin de
// péremption en production. Ces tests décrivent les deux dérives qui le
// rendaient faux en silence, et prouvent qu'aucune ne survit.
//
// ⚠️ Aucun de ces tests n'appelle `resetProductIndex` en cours de route : c'est
// tout l'objet du correctif. Le `beforeEach` global le fait pour isoler les
// cas les uns des autres, jamais pour provoquer le comportement mesuré.
// ═══════════════════════════════════════════════════════════════════
describe('index produit → palier : invalidation', () => {
  const monthly = (id: string, product: string, cents: number) =>
    price({ id, product, unit_amount: cents, recurring: { interval: 'month', interval_count: 1 } });

  /**
   * Catalogue COMPLET : les quatre paliers payants sont lisibles.
   *
   * C'est ce qu'il faut pour mesurer la fraîcheur d'un index complet : le
   * catalogue partiel des tests précédents produit un index à trous, donc la
   * TTL courte, donc pas le comportement qu'on veut décrire ici.
   */
  const catalogue = {
    prod_t10: [monthly('price_m10', 'prod_t10', 2000)],
    prod_t20: [monthly('price_m20', 'prod_t20', 5000), price({ id: 'price_y20' })],
    prod_t50: [monthly('price_m50', 'prod_t50', 10000)],
    prod_tmax: [monthly('price_mmax', 'prod_tmax', 20000)],
  };

  /** Client Stripe qui compte ses lectures. */
  function counting(base: StripeLike) {
    const calls = { retrieve: 0 };
    const stripe: StripeLike = {
      prices: {
        retrieve: (id) => {
          calls.retrieve += 1;
          return base.prices.retrieve(id);
        },
        list: base.prices.list,
      },
    };
    return { stripe, calls };
  }

  afterEach(() => vi.useRealTimers());

  it('reconstruit l’index quand un secret de prix change, le jour de la bascule live', async () => {
    // Compte de TEST : le prix mensuel t20 vit sur `prod_test`.
    const test = fakeStripe({
      prod_test: [
        price({ id: 'price_m20', product: 'prod_test', unit_amount: 5000, recurring: { interval: 'month', interval_count: 1 } }),
        price({ id: 'price_y20_test', product: 'prod_test' }),
      ],
    });
    const match = await resolveTierMatch(test, 'price_y20_test', monthlyOnly, tierFromPriceId);
    expect(match?.tier.key).toBe('t20');

    // Bascule : les secrets désignent désormais les prix du compte LIVE, portés
    // par un autre produit. Personne n'a vidé quoi que ce soit.
    const liveEnv = (name: string): string | undefined =>
      name === 'STRIPE_ORG_PRICE_T20' ? 'price_m20_live' : undefined;
    const live = fakeStripe({
      prod_live: [
        price({ id: 'price_m20_live', product: 'prod_live', unit_amount: 5000, recurring: { interval: 'month', interval_count: 1 } }),
        price({ id: 'price_y20_live', product: 'prod_live' }),
      ],
    });
    const liveMatch = await resolveTierMatch(live, 'price_y20_live', liveEnv, tierFromPriceId);
    expect(liveMatch?.tier.key).toBe('t20');
    expect(liveMatch?.interval).toBe('yearly');
  });

  it('reconstruit l’index passé le TTL, même à secrets identiques', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-04T10:00:00Z'));
    const { stripe, calls } = counting(fakeStripe(catalogue));

    await resolveTierMatch(stripe, 'price_y20', monthlyOnly, tierFromPriceId);
    const construction = calls.retrieve;
    expect(construction).toBeGreaterThan(1);

    // Juste avant l'échéance : l'index sert encore.
    vi.setSystemTime(Date.now() + PRODUCT_INDEX_TTL_MS - 1000);
    await resolveTierMatch(stripe, 'price_y20', monthlyOnly, tierFromPriceId);
    expect(calls.retrieve).toBe(construction + 1);

    // Passé l'échéance : reconstruction complète.
    vi.setSystemTime(Date.now() + PRODUCT_INDEX_TTL_MS + 1000);
    await resolveTierMatch(stripe, 'price_y20', monthlyOnly, tierFromPriceId);
    expect(calls.retrieve).toBeGreaterThan(construction + 2);
  });

  it('ne fige pas un index à trous : un palier illisible est retenté trente secondes après', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-04T10:00:00Z'));

    // t20 est illisible au premier passage, lisible ensuite.
    let t20Readable = false;
    const base = fakeStripe(catalogue);
    const flaky: StripeLike = {
      prices: {
        retrieve: (id) =>
          id === 'price_m20' && !t20Readable
            ? Promise.reject(new Error('stripe hiccup'))
            : base.prices.retrieve(id),
        list: base.prices.list,
      },
    };

    // Index construit avec un trou : le prix annuel t20 n'est pas reconnu.
    expect(
      await resolveTierMatch(flaky, 'price_y20', monthlyOnly, tierFromPriceId),
    ).toBeUndefined();

    t20Readable = true;

    // Avant l'échéance courte, le trou tient encore.
    vi.setSystemTime(Date.now() + PRODUCT_INDEX_PARTIAL_TTL_MS - 1000);
    expect(
      await resolveTierMatch(flaky, 'price_y20', monthlyOnly, tierFromPriceId),
    ).toBeUndefined();

    // Passé l'échéance courte, il se referme tout seul.
    vi.setSystemTime(Date.now() + PRODUCT_INDEX_PARTIAL_TTL_MS + 1000);
    const match = await resolveTierMatch(flaky, 'price_y20', monthlyOnly, tierFromPriceId);
    expect(match?.tier.key).toBe('t20');
  });

  it('un index COMPLET n’est pas reconstruit au bout de trente secondes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-04T10:00:00Z'));
    const { stripe, calls } = counting(fakeStripe(catalogue));

    await resolveTierMatch(stripe, 'price_y20', monthlyOnly, tierFromPriceId);
    const construction = calls.retrieve;

    vi.setSystemTime(Date.now() + PRODUCT_INDEX_PARTIAL_TTL_MS + 1000);
    await resolveTierMatch(stripe, 'price_y20', monthlyOnly, tierFromPriceId);
    expect(calls.retrieve).toBe(construction + 1);
  });
});
