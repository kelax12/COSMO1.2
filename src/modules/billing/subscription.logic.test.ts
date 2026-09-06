import { describe, it, expect } from 'vitest';
import { isPremiumSubscription, SubscriptionLike } from './subscription.logic';

// `now` figé — fixtures déterministes (règle CLAUDE.md tests).
const NOW = new Date('2026-06-10T12:00:00.000Z');
const FUTURE = '2026-07-01T00:00:00.000Z';
const PAST = '2026-05-01T00:00:00.000Z';

const base: SubscriptionLike = {
  plan: 'free',
  status: 'active',
  current_period_end: null,
};

describe('isPremiumSubscription', () => {
  it('returns true in demo mode regardless of subscription', () => {
    expect(isPremiumSubscription(null, { isDemo: true, now: NOW })).toBe(true);
    expect(isPremiumSubscription({ ...base, status: 'cancelled' }, { isDemo: true, now: NOW })).toBe(true);
  });

  it('returns false without a subscription row', () => {
    expect(isPremiumSubscription(null, { isDemo: false, now: NOW })).toBe(false);
    expect(isPremiumSubscription(undefined, { isDemo: false, now: NOW })).toBe(false);
  });

  it('returns false on a free plan, even active', () => {
    expect(isPremiumSubscription(base, { isDemo: false, now: NOW })).toBe(false);
    expect(
      isPremiumSubscription({ ...base, current_period_end: FUTURE }, { isDemo: false, now: NOW }),
    ).toBe(false);
  });

  it('returns false when cancelled or expired', () => {
    const paid: SubscriptionLike = { plan: 'premium', status: 'active', current_period_end: FUTURE };
    expect(isPremiumSubscription({ ...paid, status: 'cancelled' }, { isDemo: false, now: NOW })).toBe(false);
    expect(isPremiumSubscription({ ...paid, status: 'expired' }, { isDemo: false, now: NOW })).toBe(false);
  });

  it('Stripe plan: true while period_end is in the future, false once expired', () => {
    const paid: SubscriptionLike = {
      plan: 'premium', status: 'active', current_period_end: FUTURE,
    };
    expect(isPremiumSubscription(paid, { isDemo: false, now: NOW })).toBe(true);
    expect(
      isPremiumSubscription({ ...paid, current_period_end: PAST }, { isDemo: false, now: NOW }),
    ).toBe(false);
  });

  // Forme héritée des jetons gagnés par pub, supprimés par C-04 : `premium` +
  // `active` sans fin de période. Mesurée en prod le 2026-09-04 (8 lignes) ;
  // elle reste premium, aucune écriture ne la produit plus.
  it('plan premium actif SANS période de fin reste premium', () => {
    const legacy: SubscriptionLike = {
      plan: 'premium', status: 'active', current_period_end: null,
    };
    expect(isPremiumSubscription(legacy, { isDemo: false, now: NOW })).toBe(true);
    expect(isPremiumSubscription({ ...legacy, status: 'expired' }, { isDemo: false, now: NOW })).toBe(false);
  });
});
