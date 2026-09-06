// Couverture métier (audit P0a) : BillingRepository (Supabase). Couvre la
// création auto de la ligne free, le mapping snake→camel et les branches
// isPremium. Les jetons premium ont été supprimés par C-04 (2026-09-04) :
// un abonnement se juge sur plan, status et période, rien d'autre.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});

import { BillingRepository } from './billing.repository';

const repo = new BillingRepository();
const subRow = (over: Record<string, unknown> = {}) => ({
  id: 's1', user_id: 'u1', plan: 'free', status: 'active',
  current_period_end: null, ...over,
});

beforeEach(() => supabaseMock.reset());

describe('getSubscription', () => {
  it('mappe la ligne existante (snake → camel, pas de user_id exposé en clair côté domaine sauf userId)', async () => {
    supabaseMock.queueTable('subscriptions', { data: subRow() });
    const sub = await repo.getSubscription();
    expect(sub).toEqual({
      id: 's1', userId: 'u1', plan: 'free', status: 'active',
      currentPeriodEnd: null,
    });
  });

  it('crée une ligne free par défaut si aucune', async () => {
    supabaseMock.queueTable('subscriptions', { data: null }); // maybeSingle → rien
    supabaseMock.queueTable('subscriptions', { data: subRow() }); // insert().select().single()
    const sub = await repo.getSubscription();
    expect(sub.plan).toBe('free');
    // un INSERT free a bien été émis (sur la 2e requête subscriptions).
    const insertCall = supabaseMock
      .callsFor('subscriptions', 1)
      .find((c) => c.method === 'insert');
    expect(insertCall).toBeDefined();
    const inserted = (insertCall!.args[0] as Record<string, unknown>[])[0];
    expect(inserted).toMatchObject({ plan: 'free', status: 'active' });
  });

  it('throw si non authentifié', async () => {
    supabaseMock.user = null;
    await expect(repo.getSubscription()).rejects.toThrow();
  });
});

describe('isPremium', () => {
  it('false pour un plan free', async () => {
    supabaseMock.queueTable('subscriptions', { data: subRow({ plan: 'free' }) });
    expect(await repo.isPremium()).toBe(false);
  });

  it('false si premium mais période expirée', async () => {
    supabaseMock.queueTable('subscriptions', {
      data: subRow({ plan: 'premium', current_period_end: '2000-01-01T00:00:00Z' }),
    });
    expect(await repo.isPremium()).toBe(false);
  });

  it('false si le statut n est pas actif', async () => {
    supabaseMock.queueTable('subscriptions', {
      data: subRow({ plan: 'premium', status: 'cancelled', current_period_end: '2999-01-01T00:00:00Z' }),
    });
    expect(await repo.isPremium()).toBe(false);
  });

  it('true si premium actif et période future', async () => {
    supabaseMock.queueTable('subscriptions', {
      data: subRow({ plan: 'premium', current_period_end: '2999-01-01T00:00:00Z' }),
    });
    expect(await repo.isPremium()).toBe(true);
  });
});
