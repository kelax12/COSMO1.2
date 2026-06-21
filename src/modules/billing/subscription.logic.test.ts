import { describe, it, expect } from 'vitest';
import { isPremiumSubscription, shouldShowAdWall, SubscriptionLike } from './subscription.logic';

// `now` figé — fixtures déterministes (règle CLAUDE.md tests).
const NOW = new Date('2026-06-10T12:00:00.000Z');
const FUTURE = '2026-07-01T00:00:00.000Z';
const PAST = '2026-05-01T00:00:00.000Z';

const base: SubscriptionLike = {
  plan: 'free',
  status: 'active',
  current_period_end: null,
  premium_tokens: 0,
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

  it('returns false when cancelled, even with tokens left', () => {
    const sub: SubscriptionLike = { ...base, status: 'cancelled', premium_tokens: 10 };
    expect(isPremiumSubscription(sub, { isDemo: false, now: NOW })).toBe(false);
  });

  it('returns false with zero or negative tokens', () => {
    expect(isPremiumSubscription({ ...base, premium_tokens: 0 }, { isDemo: false, now: NOW })).toBe(false);
    expect(isPremiumSubscription({ ...base, premium_tokens: -1 }, { isDemo: false, now: NOW })).toBe(false);
  });

  it('Stripe plan: true while period_end is in the future, false once expired', () => {
    const paid: SubscriptionLike = {
      plan: 'premium', status: 'active', premium_tokens: 5, current_period_end: FUTURE,
    };
    expect(isPremiumSubscription(paid, { isDemo: false, now: NOW })).toBe(true);
    expect(
      isPremiumSubscription({ ...paid, current_period_end: PAST }, { isDemo: false, now: NOW }),
    ).toBe(false);
  });

  it('ad-based tokens (plan free): premium while active, not once expired', () => {
    const adBased: SubscriptionLike = { ...base, premium_tokens: 3 };
    expect(isPremiumSubscription(adBased, { isDemo: false, now: NOW })).toBe(true);
    expect(
      isPremiumSubscription({ ...adBased, status: 'expired' }, { isDemo: false, now: NOW }),
    ).toBe(false);
  });

  it('plan premium WITHOUT period_end falls back to the ad-based rule', () => {
    const sub: SubscriptionLike = {
      plan: 'premium', status: 'active', premium_tokens: 2, current_period_end: null,
    };
    expect(isPremiumSubscription(sub, { isDemo: false, now: NOW })).toBe(true);
  });
});

describe('shouldShowAdWall', () => {
  // Profil par défaut : utilisateur gratuit, non démo, billing chargé, pas vu
  // aujourd'hui — c.-à-d. le SEUL cas qui déclenche le mur quand enforced=true.
  const wallCandidate = {
    isDemo: false,
    billingLoading: false,
    isPaidSubscriber: false,
    seenToday: false,
  };

  it('premium désactivé (enforced=false) → JAMAIS de mur, quel que soit le profil', () => {
    expect(shouldShowAdWall({ ...wallCandidate, enforced: false })).toBe(false);
    // même un profil qui déclencherait le mur en temps normal
    expect(
      shouldShowAdWall({ enforced: false, isDemo: false, billingLoading: false, isPaidSubscriber: false, seenToday: false }),
    ).toBe(false);
  });

  it('premium appliqué (enforced=true) → mur pour un gratuit non vu aujourd\'hui', () => {
    expect(shouldShowAdWall({ ...wallCandidate, enforced: true })).toBe(true);
  });

  it('premium appliqué : pas de mur en démo, ni pour un abonné payant, ni si déjà vu, ni pendant le chargement', () => {
    expect(shouldShowAdWall({ ...wallCandidate, enforced: true, isDemo: true })).toBe(false);
    expect(shouldShowAdWall({ ...wallCandidate, enforced: true, isPaidSubscriber: true })).toBe(false);
    expect(shouldShowAdWall({ ...wallCandidate, enforced: true, seenToday: true })).toBe(false);
    expect(shouldShowAdWall({ ...wallCandidate, enforced: true, billingLoading: true })).toBe(false);
  });
});
