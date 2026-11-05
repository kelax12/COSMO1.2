import { describe, it, expect, vi } from 'vitest';
import {
  tierForMemberCount,
  effectiveQuota,
  isQuotaReached,
  isOverQuota,
  membersOverQuota,
  sectionOpenWhileOverQuota,
  effectiveTierKey,
  needsPaymentAttention,
  recommendedTier,
  tierByQuota,
  chargedTodayEur,
  nextDueDate,
  withdrawalDeadline,
  isActivated,
  activationPollInterval,
  lastFailedPaymentAt,
  ACTIVATION_POLL_MS,
} from './org-billing.logic';
import type { OrgBillingHistoryEntry, OrgSubscription } from './org-billing.types';

const sub = (over: Partial<OrgSubscription> = {}): OrgSubscription => ({
  orgId: 'org-1',
  tierKey: 't20',
  maxMembers: 20,
  status: 'active',
  billingInterval: 'monthly',
  currentPeriodEnd: '2026-09-16T00:00:00.000Z',
  discountCode: null,
  startedAt: null,
  cancelAtPeriodEnd: false,
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

  it('grille sans palier illimité : au-delà du dernier plafond → le plus grand palier, jamais undefined', async () => {
    // La vraie grille finit par `maxMembers: null`, donc ce repli ne sert pas
    // aujourd'hui. Il est là pour le jour où elle changerait : sans lui, un
    // effectif hors grille rendrait `undefined` et l'écran de facturation lèverait.
    vi.resetModules();
    vi.doMock('./premium-config', async (importOriginal) => ({
      ...(await importOriginal<typeof import('./premium-config')>()),
      ENTERPRISE_PRICING_TIERS: [
        { key: 'free', minMembers: 0, maxMembers: 5, priceEurPerMonth: 0 },
        { key: 't10', minMembers: 5, maxMembers: 10, priceEurPerMonth: 20 },
      ],
    }));
    try {
      const logic = await import('./org-billing.logic');
      expect(logic.tierForMemberCount(11).key).toBe('t10');
      expect(logic.tierForMemberCount(10).key).toBe('t10');
    } finally {
      vi.doUnmock('./premium-config');
      vi.resetModules();
    }
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

describe('isOverQuota / membersOverQuota : dépassement après une baisse de palier', () => {
  it('pile au quota → pas de dépassement (inviter est bloqué, rien d’autre)', () => {
    expect(isOverQuota(20, sub())).toBe(false);
    expect(membersOverQuota(20, sub())).toBe(0);
  });

  it('un de plus que le quota → dépassement, un membre à retirer', () => {
    expect(isOverQuota(21, sub())).toBe(true);
    expect(membersOverQuota(21, sub())).toBe(1);
  });

  it('abonnement tombé (impayé) : le quota redevient celui du gratuit', () => {
    expect(isOverQuota(12, sub({ status: 'past_due' }))).toBe(true);
    expect(membersOverQuota(12, sub({ status: 'past_due' }))).toBe(7);
  });

  it('palier illimité → jamais de dépassement', () => {
    expect(isOverQuota(9999, sub({ tierKey: 'tmax', maxMembers: null }))).toBe(false);
    expect(membersOverQuota(9999, sub({ tierKey: 'tmax', maxMembers: null }))).toBe(0);
  });
});

describe('sectionOpenWhileOverQuota : seul ce qui permet d’en sortir reste ouvert', () => {
  const membre = { isAdmin: false, isOwner: false };
  const admin = { isAdmin: true, isOwner: false };
  const proprio = { isAdmin: true, isOwner: true };

  it('un membre ordinaire n’a plus accès à rien', () => {
    for (const s of ['overview', 'tasks', 'projects', 'okr', 'members', 'teams', 'settings', 'billing']) {
      expect(sectionOpenWhileOverQuota(s, membre)).toBe(false);
    }
  });

  it('un admin garde Membres et Paramètres, pas la facturation', () => {
    expect(sectionOpenWhileOverQuota('members', admin)).toBe(true);
    expect(sectionOpenWhileOverQuota('settings', admin)).toBe(true);
    expect(sectionOpenWhileOverQuota('billing', admin)).toBe(false);
    expect(sectionOpenWhileOverQuota('tasks', admin)).toBe(false);
  });

  it('le propriétaire garde en plus la facturation', () => {
    expect(sectionOpenWhileOverQuota('billing', proprio)).toBe(true);
    expect(sectionOpenWhileOverQuota('overview', proprio)).toBe(false);
  });
});

describe('recommendedTier : le plus petit palier payant qui laisse une place', () => {
  it('organisation vide ou à 5 → premier palier payant', () => {
    expect(recommendedTier(0).key).toBe('t10');
    expect(recommendedTier(5).key).toBe('t10');
  });
  it('pile au plafond d un palier → le suivant', () => {
    expect(recommendedTier(10).key).toBe('t20');
    expect(recommendedTier(20).key).toBe('t50');
    expect(recommendedTier(100).key).toBe('tmax');
  });
  it('sous le plafond → ce palier', () => {
    expect(recommendedTier(14).key).toBe('t20');
    expect(recommendedTier(99).key).toBe('t100');
  });
});

describe('tierByQuota', () => {
  it('retrouve le palier par son plafond, illimité compris', () => {
    expect(tierByQuota(5).key).toBe('free');
    expect(tierByQuota(20).key).toBe('t20');
    expect(tierByQuota(null).key).toBe('tmax');
  });
  it('un plafond inconnu rend le plus petit palier qui le couvre, jamais le gratuit', () => {
    expect(tierByQuota(15).key).toBe('t20');
  });
});

describe('montants et dates', () => {
  it('chargedTodayEur : mensuel = tarif, annuel = total dérivé', () => {
    expect(chargedTodayEur(70, 'monthly')).toBe(70);
    expect(chargedTodayEur(70, 'yearly')).toBe(630);
  });
  it('nextDueDate : fin de mois et 29 février', () => {
    expect(nextDueDate(new Date(2026, 0, 31), 'monthly')).toEqual(new Date(2026, 1, 28));
    expect(nextDueDate(new Date(2028, 1, 29), 'yearly')).toEqual(new Date(2029, 1, 28));
  });
  it('withdrawalDeadline : quatorze jours', () => {
    expect(withdrawalDeadline(new Date(2026, 10, 2))).toEqual(new Date(2026, 10, 16));
  });
});

describe('activation après paiement', () => {
  it('isActivated : palier attendu, ou n importe quel payant sans attente précise', () => {
    expect(isActivated(sub({ tierKey: 't20' }), 't20')).toBe(true);
    expect(isActivated(sub({ tierKey: 't10' }), 't20')).toBe(false);
    expect(isActivated(sub({ tierKey: 't10' }), null)).toBe(true);
    expect(isActivated(sub({ tierKey: 'free' }), null)).toBe(false);
    expect(isActivated(sub({ status: 'past_due' }), 't20')).toBe(false);
    expect(isActivated(null, null)).toBe(false);
  });
  it('activationPollInterval : sonde avant l échéance, jamais après (la borne)', () => {
    const deadline = 10_000;
    expect(activationPollInterval(null, 't20', deadline, 9_999)).toBe(ACTIVATION_POLL_MS);
    expect(activationPollInterval(null, 't20', deadline, 10_000)).toBe(false);
    expect(activationPollInterval(sub({ tierKey: 't20' }), 't20', deadline, 0)).toBe(false);
  });
});

describe('lastFailedPaymentAt', () => {
  const entry = (eventType: string, occurredAt: string): OrgBillingHistoryEntry => ({
    id: 1, eventType, invoiceNumber: null, hostedInvoiceUrl: null, amountCents: 0, currency: 'eur', occurredAt,
  });
  it('rend le plus récent échec, quel que soit l ordre', () => {
    expect(
      lastFailedPaymentAt([
        entry('invoice.payment_failed', '2026-10-02T10:00:00Z'),
        entry('invoice.payment_succeeded', '2026-11-03T10:00:00Z'),
        entry('invoice.payment_failed', '2026-11-02T10:00:00Z'),
      ]),
    ).toBe('2026-11-02T10:00:00Z');
  });
  it('null sans échec', () => {
    expect(lastFailedPaymentAt([entry('invoice.payment_succeeded', '2026-11-02T10:00:00Z')])).toBeNull();
  });
  it('une date illisible placée en premier n empoisonne pas le résultat', () => {
    expect(
      lastFailedPaymentAt([
        entry('invoice.payment_failed', 'pas une date'),
        entry('invoice.payment_failed', '2026-11-02T10:00:00Z'),
      ]),
    ).toBe('2026-11-02T10:00:00Z');
  });
  it('liste vide → null', () => {
    expect(lastFailedPaymentAt([])).toBeNull();
  });
});
