// ═══════════════════════════════════════════════════════════════════
// Tâches terminées d'une période des statistiques (V14.1, PER-01)
//
// Elles viennent d'une requête sur `completed_at`, pas du jeu de travail
// (35 j) ni d'une liste plafonnée : la période peut couvrir un an. Bornes
// élargies d'un jour de chaque côté, parce que le serveur compare des
// instants et la page des jours locaux ; le filtre exact, en jours locaux,
// reste celui d'avant la V14.1.
// ═══════════════════════════════════════════════════════════════════
import { useMemo } from 'react';
import { useTaskSubset, type Task } from '@/modules/tasks';
import { parseLocalDate } from '@/lib/workTimeCalculator';

const DAY_MS = 24 * 60 * 60 * 1000;

export function usePeriodCompletedTasks(range: { start: Date; end: Date }): Task[] {
  const { data } = useTaskSubset({
    completedSince: new Date(range.start.getTime() - DAY_MS).toISOString(),
    completedBefore: new Date(range.end.getTime() + DAY_MS).toISOString(),
  });
  return useMemo(() => (data ?? []).filter((task) => {
    if (!task.completed || !task.completedAt) return false;
    const d = parseLocalDate(task.completedAt);
    return d >= range.start && d <= range.end;
  }), [data, range]);
}
