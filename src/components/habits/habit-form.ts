// Formulaire d'habitude (`HabitModal`) : état initial et charge utile
// d'enregistrement, en fonctions pures.
import type { CreateHabitInput, Habit, UpdateHabitInput } from '@/modules/habits';
import { ALL_WEEK_DAYS, isEveryDay, nextScheduleHistory, normalizeScheduledDays } from '@/modules/habits/schedule';

export interface HabitFormData {
  name: string;
  estimatedTime: number;
  color: string;
  /** Jours prévus (mig. 254). 7 jours = tous les jours, le défaut. */
  scheduledDays: number[];
}

export function initialHabitForm(habit: Habit | null | undefined, fallbackColor: string): HabitFormData {
  if (!habit) return { name: '', estimatedTime: 30, color: fallbackColor, scheduledDays: [...ALL_WEEK_DAYS] };
  return {
    name: habit.name,
    estimatedTime: habit.estimatedTime,
    color: habit.color,
    scheduledDays: isEveryDay(habit.scheduledDays) ? [...ALL_WEEK_DAYS] : normalizeScheduledDays(habit.scheduledDays),
  };
}

/**
 * Mise à jour : les jours ne sont écrits que s'ils changent, et le changement
 * est daté d'aujourd'hui (date MACHINE, même convention que `completions`) :
 * changer les jours ne rejuge pas le passé.
 */
export function habitUpdates(habit: Habit, form: HabitFormData, todayKey: string): UpdateHabitInput {
  const { name, estimatedTime, color } = form;
  const history = nextScheduleHistory(habit, form.scheduledDays, todayKey);
  if (!history) return { name, estimatedTime, color };
  const scheduledDays = isEveryDay(form.scheduledDays) ? [] : form.scheduledDays;
  return { name, estimatedTime, color, scheduledDays, scheduleHistory: history };
}

/** Création : une habitude « tous les jours » ne touche pas aux colonnes de la mig. 254. */
export function habitCreateInput(form: HabitFormData): CreateHabitInput {
  const { name, estimatedTime, color, scheduledDays } = form;
  return {
    name, estimatedTime, color, frequency: 'daily', icon: '✓', description: '',
    ...(isEveryDay(scheduledDays) ? {} : { scheduledDays }),
  };
}
