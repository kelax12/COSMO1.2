// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — historique par tâche en mode DÉMO (mig. 094)
//
// Séparé de `local.repository.ts` pour le garder sous le plafond de 600
// lignes. Les étiquettes (mig. 093) ont été retirées du mode entreprise le
// 2026-09-28 : leurs tables restent en base, plus aucun écran ne les lit.
// ═══════════════════════════════════════════════════════════════════

import { safeGetItem, safeSetItem } from '@/lib/safe-json';
import type { TeamTaskActivity } from './types';
import { TEAM_TASK_ACTIVITY_STORAGE_KEY } from './constants';
import { DEMO_ACTIVITY } from './demo-seed';

/** Même lecture que `local.repository.ts` : une valeur illisible est ré-ensemencée. */
function readOrSeed<T>(key: string, seed: T): T {
  const data = safeGetItem(key);
  if (data) {
    try {
      return JSON.parse(data) as T;
    } catch {
      // illisible : on repart de la graine, comme au premier passage
    }
  }
  const clone = JSON.parse(JSON.stringify(seed)) as T;
  safeSetItem(key, JSON.stringify(clone));
  return clone;
}

/**
 * En production ce journal est écrit par un trigger. En démo il n'y a pas de
 * base : on rend ce qui a été semé, sans jamais l'écrire depuis l'interface.
 * C'est ce qui garde la même propriété append-only des deux côtés.
 */
export const getTaskActivity = (taskId: string): TeamTaskActivity[] =>
  readOrSeed<TeamTaskActivity[]>(TEAM_TASK_ACTIVITY_STORAGE_KEY, DEMO_ACTIVITY)
    .filter((a) => a.taskId === taskId)
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
