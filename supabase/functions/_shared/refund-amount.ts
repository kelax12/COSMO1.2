// ═══════════════════════════════════════════════════════════════════
// COMBIEN ON REMBOURSE — la seule ligne de ce dépôt qui décide d'un montant
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CE FICHIER EST SÉPARÉ, ET SANS AUCUNE API DENO.
//
// `CLAUDE.md` porte une règle en toutes lettres : « Ne jamais faire deviner un
// prix […] c'est le seul endroit où COSMO choisit un prix au lieu de se le
// faire désigner, donc le seul endroit où il peut se tromper de montant. »
// Elle visait la résolution du prix annuel ; un remboursement est le MÊME
// risque dans l'autre sens — on rend de l'argent, et se tromper coûte
// directement.
//
// Ces fonctions sont donc du TS pur, sans `Deno.*`, pour être exécutables par
// vitest. C'est le même montage que `_shared/org-tiers.ts`, verrouillé par
// `org-tiers.parity.test.ts` : une Edge Function ne lit pas `src/`, mais un
// test peut lire `_shared/`.
//
// ── LA RÈGLE, TELLE QU'ELLE A ÉTÉ DÉCIDÉE ───────────────────────────
//
// Décision d'Axel du 2026-09-03 : « l'utilisateur doit pouvoir se faire
// rembourser le mois en cours à tout moment, mais que le mois en cours ».
//
// Sur un abonnement MENSUEL, c'est littéral : on rend la dernière échéance
// payée, en entier. C'est aussi exactement le remède que l'art. L215-1 accorde
// au consommateur qu'on n'a pas prévenu de sa reconduction — la règle
// commerciale RECOUVRE l'obligation légale au lieu de s'y ajouter.
//
// Sur un abonnement ANNUEL, « le mois en cours » ne désigne rien : la
// reconduction est annuelle et le remède légal porte sur tout ce qui a été
// versé depuis l'anniversaire. L'arbitrage du §0 a tranché pour le **prorata
// des mois non consommés**, seule lecture qui referme l'exposition annuelle
// comme la règle mensuelle referme la sienne.
//
// ── CE QU'ON NE FAIT JAMAIS ─────────────────────────────────────────
//
// ❌ On ne rembourse jamais plus que ce qui a été encaissé. Le montant est
//    borné par `amountPaidCents`, deux fois : par le calcul, et par un clamp
//    final qui existe pour le cas où le calcul se tromperait.
// ❌ On ne rembourse jamais un montant négatif. Une période déjà terminée rend
//    zéro, pas une dette.
// ❌ On ne calcule pas le mois « entamé » comme consommable. La décision dit
//    « les mois ENTAMÉS NON CONSOMMÉS » : un mois commencé est consommé, donc
//    on ne le rend pas. C'est le sens le moins favorable au client des deux
//    lectures possibles, et c'est celui qui correspond à la règle mensuelle —
//    où le mois en cours est rendu ENTIER parce qu'il EST la dernière échéance.

/** Périodicité facturée, telle que `org_subscriptions.billing_interval` la porte. */
export type BillingInterval = 'monthly' | 'yearly';

export interface RefundInput {
  /** Ce que Stripe a réellement encaissé sur la dernière facture payée. */
  amountPaidCents: number;
  interval: BillingInterval;
  /** Début de la période courante (secondes epoch, comme Stripe les rend). */
  periodStart: number;
  /** Fin de la période courante (secondes epoch). */
  periodEnd: number;
  /** Instant de la demande (secondes epoch). Injecté pour être testable. */
  now: number;
}

export interface RefundDecision {
  amountCents: number;
  /** Pour la ligne de journal et pour l'écran : d'où vient ce chiffre. */
  reason: 'monthly_full' | 'yearly_prorata' | 'nothing_to_refund';
  /** Mois entiers restants — 0 pour un mensuel, informatif pour un annuel. */
  monthsRemaining: number;
}

/** Trente jours en secondes. Voir la note sur le choix d'unité plus bas. */
const MONTH_SECONDS = 30 * 24 * 60 * 60;

/**
 * Combien rendre, et pourquoi.
 *
 * ⚠️ LE MOIS EST COMPTÉ EN TRANCHES DE 30 JOURS, pas en mois calendaires.
 * C'est un choix, et il est du côté du client : sur une année, douze tranches
 * de 30 jours font 360 jours, donc la dernière tranche est toujours entamée
 * avant l'anniversaire, et le compte de mois restants ne peut pas SUR-estimer.
 * Compter en mois calendaires demanderait de savoir de quels mois il s'agit,
 * ce qui ferait dépendre le montant du calendrier plutôt que du contrat.
 */
export function refundAmount(input: RefundInput): RefundDecision {
  const { amountPaidCents, interval, periodEnd, now } = input;

  // Rien d'encaissé (essai gratuit, facture à zéro) : rien à rendre. On
  // résilie quand même, c'est l'autre moitié du geste.
  if (!Number.isFinite(amountPaidCents) || amountPaidCents <= 0) {
    return { amountCents: 0, reason: 'nothing_to_refund', monthsRemaining: 0 };
  }

  // Période déjà terminée : il n'y a plus de « en cours » à rendre.
  if (!Number.isFinite(periodEnd) || periodEnd <= now) {
    return { amountCents: 0, reason: 'nothing_to_refund', monthsRemaining: 0 };
  }

  if (interval === 'monthly') {
    // « Le mois en cours », littéralement : la dernière échéance, en entier.
    return {
      amountCents: amountPaidCents,
      reason: 'monthly_full',
      monthsRemaining: 0,
    };
  }

  // Annuel : les mois ENTIERS qui restent. Un mois entamé est consommé.
  const monthsRemaining = Math.max(0, Math.floor((periodEnd - now) / MONTH_SECONDS));
  if (monthsRemaining === 0) {
    return { amountCents: 0, reason: 'nothing_to_refund', monthsRemaining: 0 };
  }

  // ⚠️ `Math.round` et pas `floor` : arrondir systématiquement vers le bas
  // ferait perdre au client jusqu'à 1 centime par remboursement, sans raison.
  const prorata = Math.round((amountPaidCents * monthsRemaining) / 12);

  return {
    // 🔴 CLAMP FINAL. Il est redondant avec le calcul ci-dessus, et c'est
    //    voulu : si un jour ce calcul change et se trompe, on ne rendra jamais
    //    plus que ce qui a été encaissé. Une garde qui ne sert jamais est ce
    //    qu'on veut sur un chemin qui déplace de l'argent.
    amountCents: Math.min(Math.max(prorata, 0), amountPaidCents),
    reason: 'yearly_prorata',
    monthsRemaining,
  };
}
