// ═══════════════════════════════════════════════════════════════════
// RLS — verrou d'amorçage `subscriptions` (audit dette §9.2, failles §2/N14).
//
// Depuis mig. 015 + 041, le client ne peut PLUS s'auto-accorder le premium :
//   - aucune policy UPDATE sur subscriptions (les écritures passent par des
//     RPC SECURITY DEFINER / le webhook Stripe sous service_role) ;
//   - l'INSERT client est verrouillé à la SEULE ligne free / 0 token / 0
//     champ Stripe (WITH CHECK de 041, repris verbatim en 043).
//
// Ce test prouve la conséquence : un utilisateur ne peut pas se fabriquer
// un abonnement premium ni gonfler ses tokens directement.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUsers, TestUser } from './helpers';

describe('RLS — subscriptions lockdown (auto-upgrade premium bloqué)', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createTestUser();
  });

  afterAll(async () => {
    await deleteTestUsers(user);
  });

  it("INSERT d'une ligne premium est refusé (plan != free)", async () => {
    const { error } = await user.client.from('subscriptions').insert({
      user_id: user.id,
      plan: 'premium',
      premium_tokens: 999,
    });
    expect(error).not.toBeNull();
  });

  it("INSERT free mais avec des tokens est refusé (premium_tokens != 0)", async () => {
    const { error } = await user.client.from('subscriptions').insert({
      user_id: user.id,
      plan: 'free',
      premium_tokens: 50,
    });
    expect(error).not.toBeNull();
  });

  it("INSERT en se posant une period_end Stripe est refusé", async () => {
    const { error } = await user.client.from('subscriptions').insert({
      user_id: user.id,
      plan: 'free',
      premium_tokens: 0,
      current_period_end: new Date(Date.now() + 1e10).toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("UPDATE direct de sa subscription est refusé (aucune policy UPDATE)", async () => {
    // Amorce la ligne free légale (autorisée par le WITH CHECK de 041).
    await user.client.from('subscriptions').insert({ user_id: user.id, plan: 'free', premium_tokens: 0 });
    const { data } = await user.client
      .from('subscriptions')
      .update({ plan: 'premium', premium_tokens: 999 })
      .eq('user_id', user.id)
      .select('plan');
    // Sans policy UPDATE → aucune ligne affectée.
    expect(data ?? []).toHaveLength(0);
    const { data: row } = await user.client
      .from('subscriptions')
      .select('plan, premium_tokens')
      .eq('user_id', user.id)
      .single();
    expect(row?.plan).toBe('free');
    expect(row?.premium_tokens ?? 0).toBe(0);
  });
});
