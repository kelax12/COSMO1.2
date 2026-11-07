// ═══════════════════════════════════════════════════════════════════
// STATS MODULE - Implémentation de démo (localStorage)
// ═══════════════════════════════════════════════════════════════════

import { calculateWorkTimeForPeriod, parseLocalDate } from '@/lib/workTimeCalculator';
import type { ITasksRepository } from '@/modules/tasks/repository';
import type { IEventsRepository } from '@/modules/events/repository';
import type { IHabitsRepository } from '@/modules/habits/repository';
import type { IOKRsRepository } from '@/modules/okrs/repository';
import type { IKRCompletionsRepository } from '@/modules/kr-completions/repository';
import type { WorkTimeBucket, WorkTimeRange } from './types';
import type { IStatsRepository } from './repository';

export class LocalStatsRepository implements IStatsRepository {
  constructor(
    private readonly tasks: ITasksRepository,
    private readonly events: IEventsRepository,
    private readonly habits: IHabitsRepository,
    private readonly okrs: IOKRsRepository,
    /**
     * Journal des complétions de KR. C'est la SEULE source du temps investi
     * sur les OKR : sans lui, `okrTime` vaut 0, ce qui était exactement le bug
     * (le calcul lisait un champ `kr.history` qui n'existe pas). Voir
     * `src/lib/workTimeCalculator.ts`.
     */
    private readonly krCompletions: IKRCompletionsRepository,
  ) {}

  async getWorkTimeStats(ranges: WorkTimeRange[]): Promise<WorkTimeBucket[]> {
    if (ranges.length === 0) return [];
    const [tasks, events, habits, okrs, krCompletions] = await Promise.all([
      this.tasks.getAll(),
      this.events.getAll(),
      this.habits.fetchHabits(),
      this.okrs.getAll(),
      this.krCompletions.getAll(),
    ]);
    return ranges.map(({ start, end }) => {
      const startDate = parseLocalDate(start);
      const endDate = parseLocalDate(end);
      endDate.setHours(23, 59, 59, 999);
      const d = calculateWorkTimeForPeriod(startDate, endDate, { tasks, events, habits, okrs, krCompletions });
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
