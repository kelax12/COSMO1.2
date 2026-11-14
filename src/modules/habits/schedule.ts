// Jours prévus d'une habitude : logique pure, testée dans schedule.test.ts.
//
// Convention des jours : 0 = dimanche … 6 = samedi, comme `Date.getDay()`.
// Les clés de jour sont en date MACHINE (`toLocaleDateString('en-CA')`), même
// convention gelée que `habits.completions` (cf. CLAUDE.md du dossier).
//
// Règles produit :
//   • absent ou vide = tous les jours ;
//   • un jour non prévu est NEUTRE pour la série ;
//   • changer les jours ne rejuge pas le passé : chaque changement est daté dans
//     `scheduleHistory`, et un jour se juge avec le réglage en vigueur CE jour-là.
//
// ⚠️ Même règle, à la lettre, que `public.habit_day_scheduled` (mig. 254).

import type { Habit, HabitScheduleChange } from './types';

export const ALL_WEEK_DAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

/** Nombre maximal d'entrées d'historique conservées (même borne que la mig. 254). */
export const MAX_SCHEDULE_HISTORY = 100;

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Jours triés, dédoublonnés, bornés à 0..6. */
export function normalizeScheduledDays(days: readonly number[] | undefined | null): number[] {
  if (!days) return [];
  return Array.from(new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort(
    (a, b) => a - b,
  );
}

/** Vrai si le réglage couvre toute la semaine (absent et vide compris). */
export function isEveryDay(days: readonly number[] | undefined | null): boolean {
  const n = normalizeScheduledDays(days);
  return n.length === 0 || n.length === 7;
}

/** Jour de semaine d'une clé `YYYY-MM-DD`, lue comme une date calendaire. */
export function weekdayOfKey(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

type ScheduleSource = Pick<Habit, 'scheduledDays' | 'scheduleHistory'>;

/** Jours en vigueur à une date donnée. Vide = tous les jours. */
export function scheduledDaysOn(habit: ScheduleSource, dayKey: string): number[] {
  const history = habit.scheduleHistory ?? [];
  if (history.length > 0) {
    let current: HabitScheduleChange | undefined;
    for (const entry of history) {
      if (!DAY_KEY_RE.test(entry.from) || entry.from > dayKey) continue;
      if (!current || entry.from >= current.from) current = entry;
    }
    // Avant le premier changement daté : tous les jours (le défaut).
    return current ? normalizeScheduledDays(current.days) : [];
  }
  return normalizeScheduledDays(habit.scheduledDays);
}

/** « Ce jour est-il prévu pour cette habitude ? » */
export function isHabitScheduledOn(habit: ScheduleSource, dayKey: string): boolean {
  const days = scheduledDaysOn(habit, dayKey);
  return days.length === 0 || days.includes(weekdayOfKey(dayKey));
}

/** Prédicat prêt à passer à `calculateStreak`. */
export function scheduleOf(habit: ScheduleSource): (dayKey: string) => boolean {
  return (dayKey) => isHabitScheduledOn(habit, dayKey);
}

/**
 * Historique à écrire quand l'utilisateur passe aux jours `newDays` le jour
 * `todayKey`. Renvoie `null` si rien ne change (pas d'écriture).
 *
 * Le changement prend effet AUJOURD'HUI : les jours antérieurs restent jugés
 * avec l'ancien réglage. S'il n'y avait pas d'historique, l'ancien réglage est
 * d'abord daté depuis l'origine, pour qu'il continue de juger le passé.
 */
export function nextScheduleHistory(
  habit: ScheduleSource,
  newDays: readonly number[],
  todayKey: string,
): HabitScheduleChange[] | null {
  const next = isEveryDay(newDays) ? [...ALL_WEEK_DAYS] : normalizeScheduledDays(newDays);
  const currentRaw = scheduledDaysOn(habit, todayKey);
  const current = currentRaw.length === 0 ? [...ALL_WEEK_DAYS] : currentRaw;
  if (current.join(',') === next.join(',')) return null;

  let history = [...(habit.scheduleHistory ?? [])];
  if (history.length === 0) {
    const previous = normalizeScheduledDays(habit.scheduledDays);
    history.push({ from: '1970-01-01', days: previous.length === 0 ? [...ALL_WEEK_DAYS] : previous });
  }
  // Plusieurs changements le même jour : le dernier l'emporte.
  history = history.filter((e) => e.from !== todayKey);
  history.push({ from: todayKey, days: next });
  history.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  return history.slice(-MAX_SCHEDULE_HISTORY);
}

/**
 * Jours PRÉVUS d'une habitude entre deux bornes incluses (jours calendaires
 * locaux), et coches tombées sur ces jours-là. Base du taux de réussite des
 * statistiques : il se calcule sur les seuls jours prévus (mig. 254), et une
 * coche sur un jour non prévu ne gonfle pas le taux.
 */
export function scheduledPeriodStats(
  habit: Pick<Habit, 'completions' | 'scheduledDays' | 'scheduleHistory'>,
  start: Date,
  end: Date,
): { scheduledDaysCount: number; scheduledCompletions: number } {
  let scheduledDaysCount = 0;
  let scheduledCompletions = 0;
  const cursor = new Date(start);
  cursor.setHours(12, 0, 0, 0);
  const last = new Date(end);
  last.setHours(12, 0, 0, 0);
  for (let guard = 0; cursor <= last && guard < 3700; guard++) {
    const key = cursor.toLocaleDateString('en-CA');
    if (isHabitScheduledOn(habit, key)) {
      scheduledDaysCount++;
      if (habit.completions[key]) scheduledCompletions++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return { scheduledDaysCount, scheduledCompletions };
}
