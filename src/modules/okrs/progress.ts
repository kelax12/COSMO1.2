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
 * Coefficient d'importance effectif d'un KR : entier borné [1, 10], défaut 1.
 * Absent / NaN / < 1 → 1 (rétrocompat : les OKR sans poids gardent la moyenne
 * simple). > 10 → 10. Source unique du clamp — réutilisée par l'UI et les repos.
 */
export const krWeight = (kr: { weight?: number | null }): number => {
  const w = Math.round(Number(kr.weight));
  if (!Number.isFinite(w) || w < 1) return 1;
  return Math.min(w, 10);
};

/**
 * Calcule l'avancement global d'un OKR à partir de ses Key Results.
 *
 * Règles :
 * - Liste vide → { progress: 0, completed: false }.
 * - Un KR contribue `min(currentValue / targetValue * 100, 100)` %, pondéré par
 *   son coefficient `krWeight` (1–10, défaut 1) → moyenne pondérée.
 * - Un KR à `targetValue <= 0` (ou NaN) contribue 0 % — garde contre la
 *   division par zéro / Infinity / NaN qui corromprait l'agrégat (faille B17) —
 *   mais son poids compte toujours au dénominateur (comme l'ancienne moyenne
 *   simple où il comptait dans `.length`).
 * - Quand tous les poids valent 1, la formule redonne exactement la moyenne
 *   simple d'origine.
 * - `completed` exige que chaque KR ait `targetValue > 0` ET
 *   `currentValue >= targetValue` — indépendant du poids.
 */
export const recalcProgress = (keyResults: KeyResult[]): OKRProgress => {
  if (keyResults.length === 0) return { progress: 0, completed: false };

  let weightedSum = 0;
  let totalWeight = 0;
  for (const kr of keyResults) {
    const w = krWeight(kr);
    totalWeight += w;
    if (!kr.targetValue || kr.targetValue <= 0) continue;
    weightedSum += Math.min((kr.currentValue / kr.targetValue) * 100, 100) * w;
  }

  const progress = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  const completed = keyResults.every(
    (kr) => kr.targetValue > 0 && kr.currentValue >= kr.targetValue,
  );

  return { progress, completed };
};
