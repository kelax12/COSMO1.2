// ═══════════════════════════════════════════════════════════════════
// Billing — logique premium pure (extraite de billing.context.tsx pour
// la testabilité, audit 2026-06-10 P0 couverture). C'est LA définition
// de « premium » côté client : ne pas la dupliquer ailleurs, ne pas la
// réintroduire inline dans le contexte (cf. CLAUDE.md — un seul hook
// fait foi : useBilling, qui délègue ici).
// ═══════════════════════════════════════════════════════════════════

export interface SubscriptionLike {
  plan: 'free' | 'premium';
  status: 'active' | 'cancelled' | 'expired';
  current_period_end: string | null;
  premium_tokens: number;
}

/**
 * Un compte est premium si :
 * - mode démo → toujours true (UX de démonstration complète) ;
 * - il a une subscription non annulée avec au moins 1 token ;
 * - pour un abonnement Stripe (`plan='premium'` + period_end), la période
 *   ne doit pas être expirée ;
 * - pour des tokens gagnés par pub (plan free ou sans period_end), le
 *   status doit être 'active'.
 */
export function isPremiumSubscription(
  subscription: SubscriptionLike | null | undefined,
  opts: { isDemo: boolean; now?: Date },
): boolean {
  if (opts.isDemo) return true;
  if (!subscription) return false;
  if (subscription.status === 'cancelled') return false;
  const tokens = subscription.premium_tokens ?? 0;
  if (tokens <= 0) return false;
  // Paid subscription: also validate period_end hasn't expired
  if (subscription.plan === 'premium' && subscription.current_period_end) {
    return new Date(subscription.current_period_end) >= (opts.now ?? new Date());
  }
  // Ad-based tokens: active as long as tokens > 0 and not cancelled
  return subscription.status === 'active';
}
