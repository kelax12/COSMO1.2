// ═══════════════════════════════════════════════════════════════════
// Billing — logique premium pure (extraite de billing.context.tsx pour
// la testabilité, audit 2026-06-10 P0 couverture). C'est LA définition
// de « premium » côté client : ne pas la dupliquer ailleurs, ne pas la
// réintroduire inline dans le contexte (cf. CLAUDE.md — un seul hook
// fait foi : useBilling, qui délègue ici).
//
// 🗑️ C-04 (2026-09-04) — les jetons premium n'entrent plus dans cette
// définition : le système de jetons et le mur-pub des Habitudes ont été
// supprimés, la monétisation ne repose plus que sur l'abonnement.
// ═══════════════════════════════════════════════════════════════════

export interface SubscriptionLike {
  plan: 'free' | 'premium';
  status: 'active' | 'cancelled' | 'expired';
  current_period_end: string | null;
}

/**
 * Un compte est premium si :
 * - mode démo → toujours true (UX de démonstration complète) ;
 * - il porte un abonnement `plan='premium'` au status `active` ;
 * - et, si une fin de période est connue, elle n'est pas dépassée.
 *
 * ⚠️ Une ligne `premium` + `active` SANS `current_period_end` reste premium.
 * Ce n'est pas un oubli : c'est la forme qu'ont laissée les jetons gagnés par
 * pub avant la suppression du système (mesuré en prod le 2026-09-04 : 8 lignes,
 * aucune adossée à un abonnement Stripe). Les traiter autrement aurait retiré
 * un premium que ces comptes avaient déjà, ce que personne n'a demandé. Aucune
 * écriture ne produit plus cette forme : Stripe pose toujours une période.
 */
export function isPremiumSubscription(
  subscription: SubscriptionLike | null | undefined,
  opts: { isDemo: boolean; now?: Date },
): boolean {
  if (opts.isDemo) return true;
  if (!subscription) return false;
  if (subscription.plan !== 'premium') return false;
  if (subscription.status !== 'active') return false;
  if (subscription.current_period_end) {
    return new Date(subscription.current_period_end) >= (opts.now ?? new Date());
  }
  return true;
}
