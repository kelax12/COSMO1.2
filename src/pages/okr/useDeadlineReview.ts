// ═══════════════════════════════════════════════════════════════════
// useDeadlineReview — « cet objectif est arrivé à échéance, on en fait quoi ? »
//
// Extrait d'`OKRPage` le 2026-09-12 (C-09 / `architecture.guard`). La frontière
// est un GESTE complet, pas une coupe à la ligne près : repérer l'objectif
// échu, le proposer, et clore la question — soit en le validant (il passe
// `completed`), soit en le reportant pour cette session.
//
// Ce que le hook possède, et qui ne peut donc plus fuir dans la page :
//   · l'objectif en cours de revue,
//   · la mémoire de ceux déjà écartés PENDANT CETTE SESSION,
//   · la règle « on n'en montre qu'un à la fois, puis le suivant ».
//
// ⚠️ `reviewedOkrIds` n'est volontairement PAS persisté. Un objectif écarté
// doit revenir à la prochaine visite : la question « cet objectif est échu,
// vous en faites quoi ? » ne se répond pas en fermant une fois une fenêtre.
// C'est une mémoire de session, et le rester est la décision.
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import type { OKR } from '@/modules/okrs';
import type { Objective } from './okr-page-logic';

interface DeadlineReview {
  /** L'objectif à faire revoir, ou `null` s'il n'y en a aucun. */
  okr: Objective | null;
  /** Écarte l'objectif courant pour cette session, et passe au suivant. */
  close: () => void;
  /** Valide l'objectif : il est marqué terminé, puis écarté. */
  validate: (updated: OKR) => void;
}

/**
 * @param objectives  la liste complète, telle que la page la lit déjà
 * @param onValidate  ce qu'il faut écrire quand la personne valide — la page
 *                    garde la mutation, le hook ne connaît aucun repository
 */
export function useDeadlineReview(
  objectives: Objective[],
  onValidate: (updated: OKR) => void,
): DeadlineReview {
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  // Détection des OKR à reviewer (deadline atteinte, non complétés, non encore
  // reviewés dans cette session). On affiche le 1er trouvé. Dès que l'user
  // valide ou ferme, on passe au suivant éventuel.
  useEffect(() => {
    if (reviewingId) return;
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const due = objectives.find(o =>
      !o.completed &&
      !reviewedIds.has(o.id) &&
      new Date(o.endDate).getTime() <= todayEnd.getTime()
    );
    if (due) setReviewingId(due.id);
  }, [objectives, reviewingId, reviewedIds]);

  const close = () => {
    if (reviewingId) setReviewedIds(prev => new Set(prev).add(reviewingId));
    setReviewingId(null);
  };

  return {
    okr: reviewingId ? objectives.find(o => o.id === reviewingId) ?? null : null,
    close,
    validate: (updated: OKR) => {
      onValidate(updated);
      close();
    },
  };
}
