// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE — Calcul de progression (fonction pure, source unique)
// ═══════════════════════════════════════════════════════════════════
//
// Extrait du repository Supabase pour devenir LA source de vérité du calcul
// de progression d'un OKR à partir de ses Key Results. Pure (aucun I/O) →
// testable unitairement et réutilisable par n'importe quel adapter.

import type { KeyResult } from './types';

export interface OKRProgress {
  /** Avancement moyen pondéré, arrondi à l'entier, borné [0, 100]. */
  progress: number;
  /** true uniquement si TOUS les KR (à cible > 0) ont atteint leur cible. */
  completed: boolean;
}

/**
 * Calcule l'avancement global d'un OKR à partir de ses Key Results.
 *
 * Règles :
 * - Liste vide → { progress: 0, completed: false }.
 * - Un KR contribue `min(currentValue / targetValue * 100, 100)` %.
 * - Un KR à `targetValue <= 0` (ou NaN) contribue 0 % — garde contre la
 *   division par zéro / Infinity / NaN qui corromprait l'agrégat (faille B17).
 * - `completed` exige que chaque KR ait `targetValue > 0` ET
 *   `currentValue >= targetValue`.
 */
export const recalcProgress = (keyResults: KeyResult[]): OKRProgress => {
  if (keyResults.length === 0) return { progress: 0, completed: false };

  const total = keyResults.reduce((sum, kr) => {
    if (!kr.targetValue || kr.targetValue <= 0) return sum;
    return sum + Math.min((kr.currentValue / kr.targetValue) * 100, 100);
  }, 0);

  const progress = Math.round(total / keyResults.length);
  const completed = keyResults.every(
    (kr) => kr.targetValue > 0 && kr.currentValue >= kr.targetValue,
  );

  return { progress, completed };
};
