import { describe, it, expect } from 'vitest';
import {
  tierForMemberCount,
  effectiveQuota,
  isQuotaReached,
  effectiveTierKey,
  needsPaymentAttention,
} from './org-billing.logic';
import type { OrgSubscription } from './org-billing.types';

const sub = (over: Partial<OrgSubscription> = {}): OrgSubscription => ({
  orgId: 'org-1',
  tierKey: 't20',
  maxMembers: 20,
  status: 'active',
  currentPeriodEnd: '2026-09-16T00:00:00.000Z',
  discountCode: null,
  ...over,
});

describe('tierForMemberCount', () => {
  it('0 à 5 membres → palier gratuit', () => {
    expect(tierForMemberCount(0).key).toBe('free');
    expect(tierForMemberCount(5).key).toBe('free');
  });

  it('6 membres → premier palier payant', () => {
    expect(tierForMemberCount(6).key).toBe('t10');
  });

  it('20 membres → le palier qui les couvre, pas le suivant', () => {
    expect(tierForMemberCount(20).key).toBe('t20');
  });

  it('au-delà du dernier plafond → palier sans limite', () => {
    expect(tierForMemberCount(500).key).toBe('tmax');
  });
});

describe('effectiveQuota', () => {
  it('sans abonnement → 5 sièges', () => {
    expect(effectiveQuota(null)).toBe(5);
  });

  it('abonnement actif → le plafond du palier', () => {
    expect(effectiveQuota(sub())).toBe(20);
  });

  it('impayé → retombe à 5 sièges, sans rien supprimer', () => {
    expect(effectiveQuota(sub({ status: 'past_due' }))).toBe(5);
  });

  it('résilié → retombe à 5 sièges', () => {
    expect(effectiveQuota(sub({ status: 'cancelled' }))).toBe(5);
  });

  it('palier sans plafond → null', () => {
    expect(effectiveQuota(sub({ tierKey: 'tmax', maxMembers: null }))).toBeNull();
  });
});

describe('effectiveTierKey', () => {
  it('sans abonnement → palier gratuit', () => {
    expect(effectiveTierKey(null)).toBe('free');
  });

  it('abonnement actif → son palier', () => {
    expect(effectiveTierKey(sub())).toBe('t20');
  });

  it('impayé → gratuit : le nom suit le droit accordé, pas le palier acheté', () => {
    expect(effectiveTierKey(sub({ status: 'past_due' }))).toBe('free');
  });

  it('résilié → gratuit', () => {
    expect(effectiveTierKey(sub({ status: 'cancelled' }))).toBe('free');
  });

  it('dit la même chose que le quota : gratuit ⇔ quota gratuit', () => {
    const impaye = sub({ status: 'past_due' });
    expect(effectiveTierKey(impaye)).toBe('free');
    expect(effectiveQuota(impaye)).toBe(5);
  });
});

describe('needsPaymentAttention', () => {
  it('impayé → oui', () => {
    expect(needsPaymentAttention(sub({ status: 'past_due' }))).toBe(true);
  });

  it('actif, résilié ou absent → non (plus rien à régulariser)', () => {
    expect(needsPaymentAttention(sub())).toBe(false);
    expect(needsPaymentAttention(sub({ status: 'cancelled' }))).toBe(false);
    expect(needsPaymentAttention(null)).toBe(false);
  });
});

describe('isQuotaReached', () => {
  it('sous le quota → false', () => {
    expect(isQuotaReached(19, sub())).toBe(false);
  });

  it('au quota exact → true (la règle serveur est COUNT < quota)', () => {
    expect(isQuotaReached(20, sub())).toBe(true);
  });

  it('palier sans plafond → jamais atteint', () => {
    expect(isQuotaReached(9999, sub({ tierKey: 'tmax', maxMembers: null }))).toBe(false);
  });

  it('sans abonnement, 5 membres → atteint', () => {
    expect(isQuotaReached(5, null)).toBe(true);
  });
});
