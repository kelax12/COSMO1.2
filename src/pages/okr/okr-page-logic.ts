// Logique pure de OKRPage — extraite pour être testable.
// Comportement déplacé verbatim depuis OKRPage.tsx.
import type { OKR, KeyResult } from '@/modules/okrs';

// Objectif enrichi (champ optionnel local). Partagé OKRPage ↔ OKRCard.
export type Objective = OKR & { estimatedTime?: number };

// Progression moyenne (%) d'un objectif à partir de ses key results.
// Garde anti division par zéro (targetValue > 0), cf. faille B17.
export function getProgress(keyResults: KeyResult[]): number {
  if (keyResults.length === 0) return 0;
  const totalProgress = keyResults.reduce((sum, kr) => {
    return sum + (kr.targetValue > 0 ? (kr.currentValue / kr.targetValue * 100) : 0);
  }, 0);
  return Math.round(totalProgress / keyResults.length);
}

// Filtre les objectifs selon la catégorie sélectionnée :
//  - 'finished' → objectifs complétés
//  - 'all'      → objectifs non complétés
//  - <id>       → objectifs non complétés de cette catégorie
export function filterObjectivesByCategory<T extends Pick<OKR, 'completed' | 'category'>>(
  objectives: T[],
  selectedCategory: string
): T[] {
  return selectedCategory === 'finished'
    ? objectives.filter((obj) => obj.completed)
    : selectedCategory === 'all'
    ? objectives.filter((obj) => !obj.completed)
    : objectives.filter((obj) => !obj.completed && obj.category === selectedCategory);
}
