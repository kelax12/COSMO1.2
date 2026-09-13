// Logique pure de OKRPage — extraite pour être testable.
// Comportement déplacé verbatim depuis OKRPage.tsx.
import type { OKR, KeyResult } from '@/modules/okrs';
import { krWeight } from '@/modules/okrs';

// Objectif enrichi (champ optionnel local). Partagé OKRPage ↔ OKRCard.
export type Objective = OKR & { estimatedTime?: number };

// Progression moyenne pondérée (%) d'un objectif à partir de ses key results.
// Chaque KR est pondéré par son coefficient krWeight (1–10, défaut 1).
// Garde anti division par zéro (targetValue > 0), cf. faille B17.
export function getProgress(keyResults: KeyResult[]): number {
  if (keyResults.length === 0) return 0;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const kr of keyResults) {
    const w = krWeight(kr);
    totalWeight += w;
    if (kr.targetValue > 0) weightedSum += (kr.currentValue / kr.targetValue * 100) * w;
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

// Filtre les objectifs NON COMPLÉTÉS (les complétés vivent dans leur propre
// écran, « OKR terminés ») selon l'ensemble de catégories actives :
//  - vide  → tous les objectifs non complétés
//  - sinon → ceux dont la catégorie est dans l'ensemble (filtre multi-select,
//            cf. CategoryFilterBar — une racine active y entraîne toutes ses
//            sous-catégories)
export function filterObjectivesByCategories<T extends Pick<OKR, 'completed' | 'category'>>(
  objectives: T[],
  activeCategoryIds: ReadonlySet<string>,
): T[] {
  const notCompleted = objectives.filter((obj) => !obj.completed);
  return activeCategoryIds.size === 0
    ? notCompleted
    : notCompleted.filter((obj) => activeCategoryIds.has(obj.category));
}
