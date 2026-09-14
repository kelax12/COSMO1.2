// ═══════════════════════════════════════════════════════════════════
// LE VERROU ANTI-REJEU — ce qu'il RESTE à rendre sur un paiement
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CE FICHIER EXISTE, ET POURQUOI MAINTENANT.
//
// Le critère de sortie de C-65 exige « un test [qui] couvre les trois : le cas
// nominal, le rejeu, et la période déjà remboursée ». Le montant, lui, avait
// déjà les siens (`refund-amount.ts`, 12 cas) — mais la borne qui empêche de
// rembourser DEUX FOIS vivait en ligne dans l'entrypoint Deno de
// `stripe-org-refund`, au milieu d'appels réseau, donc hors de portée de tout
// test de ce poste. Elle décide pourtant du montant final : c'est elle qui
// transforme un rejeu en « rien de plus à rendre ».
//
// ❌ **Ne jamais remettre cette arithmétique dans l'entrypoint.** Mélangée aux
//    appels Stripe, elle redevient intestable, et c'est exactement pour ça
//    qu'elle ne l'était pas. Même montage que `refund-amount.ts` et
//    `org-tiers.ts` : du TS pur, aucune API Deno, aucun type Stripe importé —
//    une Edge Function ne lit pas `src/`, mais un test peut lire `_shared/`.
//
// ── CE QUE LE VERROU DOIT TENIR ─────────────────────────────────────
//
// « Ne pas livrer le bouton avant la borne : un remboursement rejouable est une
// perte d'argent, pas un défaut d'UX. » Trois verrous indépendants protègent ce
// chemin ; celui-ci est le DEUXIÈME, et le seul qui soit arithmétique :
//
//   1. la clé d'idempotence Stripe dérivée de l'`invoice_id` — deux appels
//      CONCURRENTS ne créent qu'un remboursement. Elle ne protège rien contre
//      un appel rejoué une heure plus tard : la clé d'idempotence Stripe expire.
//   2. **ce fichier** — on retranche ce qui a déjà été rendu sur ce paiement,
//      donc un rejoué tardif trouve zéro à rendre ;
//   3. le double bornage par l'encaissé, ici et dans `refundAmount`.
//
// ⚠️ **Un remboursement `failed` ou `canceled` ne compte pas comme rendu**, et
// c'est la subtilité qui coûte de l'argent dans les deux sens : le compter
// priverait la personne de son remboursement après un échec bancaire ; ne pas
// compter les `pending` la rembourserait deux fois pendant qu'un virement est
// en vol. Stripe n'a que ces quatre statuts sur un refund, et les deux qui
// annulent l'opération sont nommés ici, jamais déduits par exclusion.

/** Les seuls statuts que Stripe pose sur un remboursement. */
export type RefundStatus = 'pending' | 'succeeded' | 'failed' | 'canceled';

/**
 * Le strict nécessaire d'un refund Stripe : ce fichier n'en connaît rien d'autre.
 *
 * ⚠️ `status` est `string | null` chez Stripe, pas une union fermée. Le typer
 * en union ici forcerait un cast dans l'entrypoint — et un cast sur la valeur
 * qui décide si l'argent est rendu ou non est exactement ce qu'on ne veut pas.
 */
export interface PriorRefund {
  amount: number;
  status?: RefundStatus | string | null;
}

/**
 * Un remboursement qui a échoué ou été annulé n'a rien rendu du tout : l'argent
 * est toujours chez nous, il reste dû.
 *
 * ❌ Ne jamais écrire ça « par exclusion » (`status !== 'succeeded'`) : un
 *    statut `pending` serait alors ignoré, et un second appel rembourserait
 *    par-dessus un virement déjà en vol.
 */
function actuallyReturned(refund: PriorRefund): number {
  if (refund.status === 'failed' || refund.status === 'canceled') return 0;
  return Math.max(0, refund.amount);
}

/** Ce qui a déjà été rendu sur un paiement, tous remboursements confondus. */
export function alreadyRefundedCents(priorRefunds: readonly PriorRefund[]): number {
  return priorRefunds.reduce((sum, r) => sum + actuallyReturned(r), 0);
}

export interface RemainingInput {
  /** Ce que la règle de montant a décidé de rendre (`refundAmount`). */
  decidedCents: number;
  /** Ce que la facture a réellement encaissé. Borne absolue. */
  amountPaidCents: number;
  /** Les remboursements déjà posés sur ce `payment_intent`. */
  priorRefunds: readonly PriorRefund[];
}

/**
 * Ce qu'il RESTE à rendre — zéro sur un rejeu.
 *
 * 🔴 La borne est prise sur l'ENCAISSÉ moins le déjà-rendu, pas seulement sur
 * la décision : sans ça, deux appels espacés rendraient chacun le montant
 * décidé, soit le double de ce qui a été payé. C'est le mode de panne que ce
 * fichier existe pour rendre impossible, et il est silencieux — Stripe accepte
 * volontiers deux remboursements partiels qui, ensemble, dépassent.
 */
export function remainingRefundableCents(input: RemainingInput): number {
  const already = alreadyRefundedCents(input.priorRefunds);
  const payable = Math.max(0, input.amountPaidCents) - already;
  return Math.max(0, Math.min(Math.max(0, input.decidedCents), payable));
}
