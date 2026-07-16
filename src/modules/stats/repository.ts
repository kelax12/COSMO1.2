// ═══════════════════════════════════════════════════════════════════
// STATS MODULE - Repository interface + implémentation locale (démo)
// ═══════════════════════════════════════════════════════════════════
//
// Agrégats « temps investi » consommés par StatisticsPage.
// - Prod : SupabaseStatsRepository → RPC SQL `get_work_time_stats`
//   (le calcul reste dans Postgres, le client ne reçoit que les totaux).
// - Démo : LocalStatsRepository → même calcul que l'historique client
//   (calculateWorkTimeForPeriod) sur les données localStorage.
// Les deux implémentations DOIVENT rester équivalentes : la RPC réplique
// la sémantique de calculateWorkTimeForPeriod (dates locales inclusives).

import { calculateWorkTimeForPeriod, parseLocalDate } from '@/lib/workTimeCalculator';
import type { ITasksRepository } from '@/modules/tasks/repository';
import type { IEventsRepository } from '@/modules/events/repository';
import type { IHabitsRepository } from '@/modules/habits/repository';
import type { IOKRsRepository } from '@/modules/okrs/repository';
import type { WorkTimeBucket, WorkTimeRange } from './types';

export interface IStatsRepository {
  /** Un bucket par plage, dans l'ordre des plages fournies. */
  getWorkTimeStats(ranges: WorkTimeRange[]): Promise<WorkTimeBucket[]>;
}

export class LocalStatsRepository implements IStatsRepository {
  constructor(
    private readonly tasks: ITasksRepository,
    private readonly events: IEventsRepository,
    private readonly habits: IHabitsRepository,
    private readonly okrs: IOKRsRepository,
  ) {}

  async getWorkTimeStats(ranges: WorkTimeRange[]): Promise<WorkTimeBucket[]> {
    if (ranges.length === 0) return [];
    const [tasks, events, habits, okrs] = await Promise.all([
      this.tasks.getAll(),
      this.events.getAll(),
      this.habits.fetchHabits(),
      this.okrs.getAll(),
    ]);
    return ranges.map(({ start, end }) => {
      const startDate = parseLocalDate(start);
      const endDate = parseLocalDate(end);
      endDate.setHours(23, 59, 59, 999);
      const d = calculateWorkTimeForPeriod(startDate, endDate, { tasks, events, habits, okrs });
      return {
        tasksTime: Math.round(d.tasksTime),
        eventsTime: Math.round(d.eventsTime),
        habitsTime: Math.round(d.habitsTime),
        okrTime: Math.round(d.okrTime),
        totalTime: Math.round(d.totalTime),
      };
    });
  }
}
