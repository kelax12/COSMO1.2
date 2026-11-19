import { readJsonArray, writeJsonOrThrow } from '@/lib/safe-json';
import type { HabitAutoTask, IHabitAutoTaskRepository } from './auto-task.repository';

/** Mode démo : même forme que la table `habit_auto_tasks` (mig. 265). */
export const HABIT_AUTO_TASKS_KEY = 'cosmo_demo_habit_auto_tasks';

const read = (): HabitAutoTask[] => readJsonArray<HabitAutoTask>(HABIT_AUTO_TASKS_KEY) ?? [];
const write = (rows: HabitAutoTask[]) => writeJsonOrThrow(HABIT_AUTO_TASKS_KEY, rows);

export class LocalStorageHabitAutoTaskRepository implements IHabitAutoTaskRepository {
  async list(): Promise<HabitAutoTask[]> {
    return read();
  }

  async enable(habitId: string, category: string | null): Promise<void> {
    const rows = read();
    const existing = rows.find((r) => r.habitId === habitId);
    if (existing) existing.category = category;
    else rows.push({ habitId, category, lastDay: null });
    write(rows);
  }

  async disable(habitId: string): Promise<void> {
    write(read().filter((r) => r.habitId !== habitId));
  }

  async claimDay(habitId: string, day: string): Promise<boolean> {
    const rows = read();
    const row = rows.find((r) => r.habitId === habitId);
    if (!row || (row.lastDay !== null && row.lastDay >= day)) return false;
    row.lastDay = day;
    write(rows);
    return true;
  }
}
