// Couverture métier (audit P0a) : BillingRepository (Supabase). Couvre la
// création auto de la ligne free, le mapping snake→camel, les branches
// isPremium, et le garde-fou addTokens (+1 only, activation via Stripe).
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
  current_period_end: null, premium_tokens: 0, win_streak: 0, ...over,
});

beforeEach(() => supabaseMock.reset());

describe('getSubscription', () => {
  it('mappe la ligne existante (snake → camel, pas de user_id exposé en clair côté domaine sauf userId)', async () => {
    supabaseMock.queueTable('subscriptions', { data: subRow({ premium_tokens: 5, win_streak: 2 }) });
    const sub = await repo.getSubscription();
    expect(sub).toEqual({
      id: 's1', userId: 'u1', plan: 'free', status: 'active',
      currentPeriodEnd: null, premiumTokens: 5, winStreak: 2,
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
    supabaseMock.queueTable('subscriptions', { data: subRow({ plan: 'free', premium_tokens: 10 }) });
    expect(await repo.isPremium()).toBe(false);
  });

  it('false si premium mais période expirée', async () => {
    supabaseMock.queueTable('subscriptions', {
      data: subRow({ plan: 'premium', premium_tokens: 5, current_period_end: '2000-01-01T00:00:00Z' }),
    });
    expect(await repo.isPremium()).toBe(false);
  });

  it('false si premium actif mais zéro token', async () => {
    supabaseMock.queueTable('subscriptions', {
      data: subRow({ plan: 'premium', premium_tokens: 0, current_period_end: '2999-01-01T00:00:00Z' }),
    });
    expect(await repo.isPremium()).toBe(false);
  });

  it('true si premium actif, période future et tokens > 0', async () => {
    supabaseMock.queueTable('subscriptions', {
      data: subRow({ plan: 'premium', premium_tokens: 3, current_period_end: '2999-01-01T00:00:00Z' }),
    });
    expect(await repo.isPremium()).toBe(true);
  });
});

describe('addTokens / consumeToken', () => {
  it('addTokens(1) appelle la RPC ad et mappe le retour', async () => {
    supabaseMock.queueRpc('credit_premium_token_from_ad', { data: subRow({ premium_tokens: 1 }) });
    const sub = await repo.addTokens(1);
    expect(sub.premiumTokens).toBe(1);
    expect(supabaseMock.rpcCalls.map((c) => c.fn)).toContain('credit_premium_token_from_ad');
  });

  it('addTokens(n≠1) est refusé côté client', async () => {
    await expect(repo.addTokens(5)).rejects.toThrow();
  });

  it('consumeToken appelle la RPC consume_premium_token', async () => {
    supabaseMock.queueRpc('consume_premium_token', { data: subRow() });
    await repo.consumeToken();
    expect(supabaseMock.rpcCalls.map((c) => c.fn)).toContain('consume_premium_token');
  });
});
