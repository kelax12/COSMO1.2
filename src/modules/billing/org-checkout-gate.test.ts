// ═══════════════════════════════════════════════════════════════════
// `checkoutBlockFor` — un abonnement existant interdit un second checkout.
//
// 🔴 Le cas qui a motivé ce module : une organisation en `past_due` ouvrait
// un second Checkout pendant que Stripe retentait le premier abonnement
// (double prélèvement). Revue finale du lot 1 facturation, 2026-11-02.
//
// ⚠️ TS PUR, comme `stripe-errors.ts` : import relatif hors `src/` délibéré.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkoutBlockFor } from '../../../supabase/functions/_shared/org-checkout-gate';

describe('checkoutBlockFor', () => {
  it('refuse un abonnement actif ou en essai (changement de palier = portail)', () => {
    expect(checkoutBlockFor('active')).toBe('already_subscribed');
    expect(checkoutBlockFor('trialing')).toBe('already_subscribed');
  });

  it('refuse un impayé : past_due et unpaid', () => {
    expect(checkoutBlockFor('past_due')).toBe('subscription_past_due');
    expect(checkoutBlockFor('unpaid')).toBe('subscription_past_due');
  });

  it('laisse repayer un abonnement terminé ou absent', () => {
    expect(checkoutBlockFor('canceled')).toBeNull();
    expect(checkoutBlockFor('incomplete_expired')).toBeNull();
    expect(checkoutBlockFor(null)).toBeNull();
    expect(checkoutBlockFor(undefined)).toBeNull();
  });
});

describe('stripe-org-checkout — le verrou est bien branché', () => {
  // Garde TEXTUELLE, comme `src/stripe-org-404-guard.test.ts` : sans stack
  // Deno, on vérifie que l'entrypoint décide par ce module et ne réécrit pas
  // sa propre liste de statuts à côté.
  const source = readFileSync(
    join(process.cwd(), 'supabase/functions/stripe-org-checkout/index.ts'),
    'utf-8',
  );

  it('importe checkoutBlockFor et renvoie son code tel quel', () => {
    expect(source).toMatch(
      /import\s*\{\s*checkoutBlockFor\s*\}\s*from\s*['"]\.\.\/_shared\/org-checkout-gate\.ts['"]/,
    );
    expect(source).toMatch(/checkoutBlockFor\(\s*existing\?\.status\s*\)/);
    expect(source).toMatch(/json\(\s*\{\s*error:\s*blocked\s*\}/);
  });

  it('ne teste plus les statuts à la main dans l entrypoint', () => {
    expect(source).not.toMatch(/existing\.status\s*===/);
  });
});
