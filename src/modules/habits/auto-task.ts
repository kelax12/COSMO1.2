// Tâche créée automatiquement par une habitude (mig. 265) : règles pures.
import type { CreateTaskInput } from '@/modules/tasks';
import type { Habit } from './types';
import type { HabitAutoTask } from './auto-task.repository';
import { isHabitScheduledOn } from './schedule';

/**
 * Habitudes dont la tâche du jour reste à créer : option active, jour prévu,
 * jour pas encore réservé. La réservation serveur (`claimDay`) tranche quand
 * même : ce filtre évite seulement des appels inutiles.
 */
export function dueAutoTasks(
  habits: Habit[],
  settings: HabitAutoTask[],
  day: string,
): Array<{ habit: Habit; setting: HabitAutoTask }> {
  const byId = new Map(habits.map((h) => [h.id, h]));
  const due: Array<{ habit: Habit; setting: HabitAutoTask }> = [];
  for (const setting of settings) {
    const habit = byId.get(setting.habitId);
    if (!habit) continue;
    if (setting.lastDay !== null && setting.lastDay >= day) continue;
    if (!isHabitScheduledOn(habit, day)) continue;
    due.push({ habit, setting });
  }
  return due;
}

/** Tâche du jour : nom et durée de l'habitude, échéance = ce jour, sa catégorie. */
export function autoTaskInput(habit: Habit, setting: HabitAutoTask, day: string): CreateTaskInput {
  return {
    name: habit.name,
    description: '',
    priority: 0,
    category: setting.category ?? '',
    deadline: day,
    estimatedTime: habit.estimatedTime,
    bookmarked: false,
    completed: false,
  };
}
