// ═══════════════════════════════════════════════════════════════════
// `isResourceMissing` — reconnaître un identifiant Stripe qui n'existe plus
// dans le compte présenté (C-71).
//
// Stripe répond `resource_missing` (statut 404) dès qu'un `stripe_customer_id`
// ou `stripe_subscription_id` porté par notre base ne vit pas dans le compte
// Stripe visé — le cas de TOUS les identifiants de test le jour du passage en
// compte live (cf. CLAUDE.md § Facturation entreprise, réserve n°1).
//
// ⚠️ TS PUR, comme `org-stripe-prices.ts` : import relatif hors `src/`
// délibéré, ce fichier ne porte aucune API Deno ni spécificateur `npm:`.
import { describe, it, expect } from 'vitest';
import { isResourceMissing } from '../../../supabase/functions/_shared/stripe-errors';

describe('isResourceMissing', () => {
  it('reconnaît une StripeInvalidRequestError de code resource_missing', () => {
    const err = { type: 'StripeInvalidRequestError', code: 'resource_missing', statusCode: 404 };
    expect(isResourceMissing(err)).toBe(true);
  });

  it('rejette une autre erreur Stripe (ex. rate_limit) — ne jamais deviner', () => {
    const err = { type: 'StripeRateLimitError', code: 'rate_limit', statusCode: 429 };
    expect(isResourceMissing(err)).toBe(false);
  });

  it('rejette une erreur réseau sans code', () => {
    expect(isResourceMissing(new Error('fetch failed'))).toBe(false);
  });

  it('rejette null et undefined sans lever', () => {
    expect(isResourceMissing(null)).toBe(false);
    expect(isResourceMissing(undefined)).toBe(false);
  });
});
