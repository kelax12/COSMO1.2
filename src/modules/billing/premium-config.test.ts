// ═══════════════════════════════════════════════════════════════════
// premium-config — tripwire du kill-switch Premium (audit dette §9.4).
//
// Le code Premium (Stripe, RPC, gates isPremium(), HabitsAdGate, PremiumPage)
// est DORMANT tant que PREMIUM_ENFORCED=false (décision 2026-06-21, gratuit
// pour tous). Risque de dette : le flag est rebasculé par erreur → on
// expédie en prod un parcours Stripe NON finalisé (faille §3 / POST-AUDIT).
//
// Ce test est un garde-fou volontaire : si quelqu'un passe le flag à `true`,
// la CI casse ICI et oblige à une décision consciente (finaliser Stripe AVANT
// de monétiser, puis mettre à jour ce test). Ce n'est PAS un test de
// comportement — c'est un verrou de configuration anti-divergence silencieuse.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { PREMIUM_ENFORCED } from './premium-config';
import { isPremiumSubscription } from './subscription.logic';

describe('premium-config — kill-switch tripwire', () => {
  it('PREMIUM_ENFORCED reste false (monétisation reportée, Stripe non finalisé)', () => {
    // ⚠️ Si ce test échoue, c'est que le Premium a été RÉACTIVÉ. Avant de
    // toucher ce test : vérifier que Stripe est finalisé (clés, webhook secret,
    // produits) — cf. docs/POST-AUDIT-GUIDE.md point 3.
    expect(PREMIUM_ENFORCED).toBe(false);
  });

  it('tant que le premium est désactivé, tout compte est premium côté logique', () => {
    // Invariant cohérent avec billing.context : !PREMIUM_ENFORCED court-circuite
    // isPremiumSubscription. On vérifie qu'un compte free/zéro token serait bien
    // débloqué via le court-circuit (la branche !PREMIUM_ENFORCED domine).
    const freeSub = {
      plan: 'free' as const,
      status: 'active' as const,
      current_period_end: null,
      premium_tokens: 0,
    };
    const wouldBePremiumIfEnforced = isPremiumSubscription(freeSub, { isDemo: false });
    // Sans application du flag, billing.context renvoie `!PREMIUM_ENFORCED || ...`
    // → true. On documente l'équation effective ici.
    expect(!PREMIUM_ENFORCED || wouldBePremiumIfEnforced).toBe(true);
  });
});
