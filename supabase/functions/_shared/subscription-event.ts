// ═══════════════════════════════════════════════════════════════════
// SEC-08 · l'ORDRE des événements d'abonnement Stripe (audit du 2026-11-06)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT. Pour `customer.subscription.updated|deleted`, le webhook
// appliquait `event.data.object` tel quel. Or Stripe NE GARANTIT PAS l'ordre
// de livraison : un `updated` ancien (statut `active`) livré APRÈS le
// `deleted` qui l'a suivi rendait le premium, ou le palier payant, à un
// abonnement résilié. Rien ne le corrigeait : aucun event ne venait après.
//
// LE CORRECTIF. L'événement ne dit plus QUOI écrire, il dit seulement QUEL
// abonnement relire. Le webhook relit l'état courant par
// `stripe.subscriptions.retrieve` (comme le font déjà les handlers de checkout
// et de facture) et c'est cet état, et lui seul, qui décide. Deux événements
// livrés dans n'importe quel ordre relisent le même état, donc convergent.
//
// Ce module est la DÉCISION, en TS pur : aucune API Deno, aucun type Stripe,
// testable depuis `src/` (`src/modules/billing/subscription-event.test.ts`),
// comme `refund-replay.ts`. ❌ Ne jamais la remettre en ligne dans
// l'entrypoint : mêlée aux appels réseau, elle redevient intestable.
//
// ⚠️ Ce que la relecture ne change pas, et qui reste au webhook :
//   - l'idempotence (`processed_stripe_events`, marqueur écrit APRÈS succès) ;
//   - « une panne de lecture n'est jamais un pas de ligne » : un `retrieve` qui
//     échoue LÈVE, donc 500, donc Stripe retente. On ne retombe JAMAIS sur la
//     charge de l'événement quand la relecture échoue : ce serait réintroduire
//     exactement le défaut corrigé ici, au pire moment.
//   - la garde S-5 : une dégradation ne vise que l'abonnement ENREGISTRÉ.

/** Le strict nécessaire d'un abonnement Stripe pour décider. */
export interface SubscriptionSnapshot {
  id: string;
  /** `Stripe.Subscription.Status`, laissé ouvert : un statut futur doit se décider. */
  status: string;
}

export type SubscriptionEventType = 'customer.subscription.updated' | 'customer.subscription.deleted';

/**
 * - `apply` : écrire l'état RELU par le chemin habituel (`applySubscriptionToDb`,
 *   `applyOrgSubscription`), qui garde ses propres règles (S-5, palier par price).
 * - `terminate` : l'abonnement est terminé chez Stripe, retour au gratuit,
 *   filtré sur l'abonnement enregistré (un ancien abonnement ne dégrade rien).
 * - `retry` : l'état relu contredit l'événement d'une façon qui ne s'explique
 *   pas. On ne devine pas : le webhook lève, Stripe retente.
 */
export type SubscriptionEventDecision =
  | { action: 'apply' }
  | { action: 'terminate' }
  | { action: 'retry'; reason: string };

/**
 * Les statuts d'où un abonnement Stripe ne revient JAMAIS. Nommés, jamais
 * déduits par exclusion : un statut futur inconnu n'est pas une résiliation,
 * il passe par `apply`, dont la branche conservatrice décide.
 */
export const TERMINAL_STATUSES: ReadonlySet<string> = new Set(['canceled', 'incomplete_expired']);

/**
 * Que faire d'un événement d'abonnement, connaissant l'état COURANT relu chez
 * Stripe. La charge de l'événement n'entre pas dans la décision, à dessein :
 * seul son identifiant sert, pour vérifier que la relecture parle du même
 * abonnement.
 */
export function decideSubscriptionEvent(
  type: SubscriptionEventType,
  eventSubscriptionId: string,
  current: SubscriptionSnapshot,
): SubscriptionEventDecision {
  if (current.id !== eventSubscriptionId) {
    return { action: 'retry', reason: `relecture de ${eventSubscriptionId} rendue pour ${current.id}` };
  }
  if (TERMINAL_STATUSES.has(current.status)) return { action: 'terminate' };
  if (type === 'customer.subscription.deleted') {
    // Une suppression est définitive chez Stripe : un `deleted` dont la
    // relecture rend un abonnement vivant ne s'explique pas. Plutôt que de
    // choisir entre l'événement et la relecture, on fait retenter.
    return { action: 'retry', reason: `deleted relu au statut ${current.status}` };
  }
  return { action: 'apply' };
}
