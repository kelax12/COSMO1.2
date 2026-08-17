import { describe, it, expect } from 'vitest';
import { tierForMemberCount, effectiveQuota, isQuotaReached, planDescriptor } from './org-billing.logic';
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

describe('planDescriptor', () => {
  it('sans abonnement → forfait gratuit', () => {
    expect(planDescriptor(null)).toEqual({ kind: 'free', seats: 5, needsAttention: false });
  });

  it('abonnement actif → forfait par sièges', () => {
    expect(planDescriptor(sub())).toEqual({ kind: 'seats', seats: 20, needsAttention: false });
  });

  it('palier sans plafond → illimité', () => {
    expect(planDescriptor(sub({ tierKey: 'tmax', maxMembers: null }))).toEqual({
      kind: 'unlimited',
      seats: null,
      needsAttention: false,
    });
  });

  it('impayé → affiché comme gratuit, avec alerte : le quota accordé fait foi', () => {
    expect(planDescriptor(sub({ status: 'past_due' }))).toEqual({
      kind: 'free',
      seats: 5,
      needsAttention: true,
    });
  });

  it('résilié → gratuit, sans alerte (plus rien à régulariser)', () => {
    expect(planDescriptor(sub({ status: 'cancelled' }))).toEqual({
      kind: 'free',
      seats: 5,
      needsAttention: false,
    });
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
