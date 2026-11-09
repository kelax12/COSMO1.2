// ═══════════════════════════════════════════════════════════════════
// Tâches terminées des graphiques du tableau de bord (V14.1, PER-01)
//
// `DashboardChart` et `DashboardBarChart` remontent jusqu'à six mois civils
// (vue « mois » : le mois courant et les cinq précédents). Le jeu de travail
// (`useTasks`) ne garde que 35 jours de terminées : il rendrait des barres
// vides au-delà, présentées comme un temps nul. Cette fenêtre-ci a sa propre
// requête sur `completed_at`, sans plafond.
//
// La borne est arrondie au jour : la clé de requête ne change qu'à minuit, pas
// à chaque rendu. 190 jours couvrent cinq mois pleins plus le mois entamé
// (au plus 31 × 6 = 186 jours) et un jour de marge pour le fuseau.
// ═══════════════════════════════════════════════════════════════════
import { useMemo } from 'react';
import { useTaskSubset } from '@/modules/tasks';
import type { Task } from '@/modules/tasks';

export const CHART_LOOKBACK_DAYS = 190;

export function chartCompletedSince(now: Date = new Date()): string {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  day.setDate(day.getDate() - CHART_LOOKBACK_DAYS);
  return day.toISOString();
}

export function useChartCompletedTasks(): Task[] {
  const todayKey = new Date().toDateString();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recalculé au changement de JOUR seulement (cf. en-tête)
  const since = useMemo(() => chartCompletedSince(), [todayKey]);
  const { data = [] } = useTaskSubset({ completedSince: since });
  return data;
}
