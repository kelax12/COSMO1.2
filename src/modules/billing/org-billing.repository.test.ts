// Lecture de l'abonnement d'organisation. Verrouille : colonnes lues
// NOMMÉMENT (jamais `*`), filtre `org_id`, mapping snake → camel, `null` pour
// « aucune ligne » (palier gratuit), et repli `monthly` de la périodicité.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});

import { getOrgSubscription } from './org-billing.repository';

const row = (over: Record<string, unknown> = {}) => ({
  org_id: 'org-1',
  tier_key: 't20',
  max_members: 20,
  status: 'active',
  billing_interval: 'yearly',
  current_period_end: '2027-01-01T00:00:00Z',
  discount_code: 'LAUNCH',
  ...over,
});

beforeEach(() => supabaseMock.reset());

describe('getOrgSubscription', () => {
  it('lit org_subscriptions avec une liste de colonnes explicite, filtrée sur l’org', async () => {
    supabaseMock.queueTable('org_subscriptions', { data: row() });
    await getOrgSubscription('org-1');

    expect(supabaseMock.argsOf('org_subscriptions', 'select')).toEqual([
      'org_id, tier_key, max_members, status, billing_interval, current_period_end, discount_code',
    ]);
    expect(supabaseMock.argsOf('org_subscriptions', 'eq')).toEqual(['org_id', 'org-1']);
    expect(supabaseMock.callsFor('org_subscriptions').map((c) => c.method)).toEqual([
      'select',
      'eq',
      'maybeSingle',
    ]);
    expect(supabaseMock.rpcCalls).toEqual([]);
  });

  it('mappe la ligne en camelCase', async () => {
    supabaseMock.queueTable('org_subscriptions', { data: row() });
    expect(await getOrgSubscription('org-1')).toEqual({
      orgId: 'org-1',
      tierKey: 't20',
      maxMembers: 20,
      status: 'active',
      billingInterval: 'yearly',
      currentPeriodEnd: '2027-01-01T00:00:00Z',
      discountCode: 'LAUNCH',
    });
  });

  it('billing_interval absent (front déployé avant la mig. 123) : repli sur monthly', async () => {
    supabaseMock.queueTable('org_subscriptions', { data: row({ billing_interval: null }) });
    expect((await getOrgSubscription('org-1'))?.billingInterval).toBe('monthly');
  });

  it('conserve les null des colonnes facultatives', async () => {
    supabaseMock.queueTable('org_subscriptions', {
      data: row({ max_members: null, current_period_end: null, discount_code: null }),
    });
    const sub = await getOrgSubscription('org-1');
    expect(sub).toMatchObject({ maxMembers: null, currentPeriodEnd: null, discountCode: null });
  });

  it('aucune ligne : null (palier gratuit), pas une erreur', async () => {
    supabaseMock.queueTable('org_subscriptions', { data: null });
    expect(await getOrgSubscription('org-1')).toBeNull();
  });

  it('remonte l’erreur PostgREST normalisée', async () => {
    supabaseMock.queueTable('org_subscriptions', { error: { code: '42501', message: 'denied' } });
    const err = await getOrgSubscription('org-1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as { code?: string }).code).toBe('42501');
    expect((err as Error).message).not.toContain('denied');
  });
});
