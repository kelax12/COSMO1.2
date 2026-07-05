// ═══════════════════════════════════════════════════════════════════
// Insights en langage naturel (#34) — helpers purs, testés unitairement.
// L'utilisateur moyen ne sait pas lire une heatmap : 2-3 phrases calculées
// client-side donnent la conclusion directement.
// ═══════════════════════════════════════════════════════════════════
import type { Task } from '@/modules/tasks';
import type { Habit } from '@/modules/habits';

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

const localDay = (iso: string): string => new Date(iso).toLocaleDateString('en-CA');

/** Jour de la semaine le plus productif (complétions de tâches, 30 derniers jours). */
export function bestDayInsight(tasks: Task[], now: Date = new Date()): string | null {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toLocaleDateString('en-CA');

  const byWeekday = new Array(7).fill(0) as number[];
  let total = 0;
  for (const t of tasks) {
    if (!t.completed || !t.completedAt) continue;
    if (localDay(t.completedAt) < cutoffStr) continue;
    byWeekday[new Date(t.completedAt).getDay()] += 1;
    total += 1;
  }
  if (total < 5) return null; // trop peu de données pour conclure
  const best = byWeekday.indexOf(Math.max(...byWeekday));
  const share = Math.round((byWeekday[best] / total) * 100);
  return `Votre meilleur jour : ${DAY_NAMES[best]} (${share} % de vos tâches complétées sur 30 jours).`;
}

/** Habitude la plus fragile : la plus manquée sur les 7 derniers jours. */
export function fragileHabitInsight(habits: Habit[], now: Date = new Date()): string | null {
  if (habits.length === 0) return null;
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString('en-CA'));
  }
  let worst: { name: string; missed: number } | null = null;
  for (const h of habits) {
    const missed = days.filter((day) => !h.completions[day]).length;
    if (missed > 0 && (!worst || missed > worst.missed)) {
      worst = { name: h.name, missed };
    }
  }
  if (!worst || worst.missed < 3) return null; // rien d'alarmant
  return `Habitude la plus fragile : « ${worst.name} » — ${worst.missed} oublis cette semaine.`;
}

/** Dynamique de complétion : cette semaine vs la précédente. */
export function momentumInsight(tasks: Task[], now: Date = new Date()): string | null {
  const dayStr = (offset: number): string => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('en-CA');
  };
  const thisWeekStart = dayStr(-6);
  const lastWeekStart = dayStr(-13);
  const lastWeekEnd = dayStr(-7);

  let thisWeek = 0;
  let lastWeek = 0;
  for (const t of tasks) {
    if (!t.completed || !t.completedAt) continue;
    const d = localDay(t.completedAt);
    if (d >= thisWeekStart) thisWeek += 1;
    else if (d >= lastWeekStart && d <= lastWeekEnd) lastWeek += 1;
  }
  if (thisWeek + lastWeek < 5) return null;
  if (lastWeek === 0) return `${thisWeek} tâches complétées cette semaine.`;
  const delta = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  if (delta > 10) return `En progression : ${thisWeek} tâches complétées cette semaine (+${delta} % vs la semaine dernière).`;
  if (delta < -10) return `En baisse : ${thisWeek} tâches complétées cette semaine (${delta} % vs la semaine dernière).`;
  return `Rythme stable : ${thisWeek} tâches complétées cette semaine.`;
}

/** Les insights disponibles (max 3), dans l'ordre d'intérêt. */
export function buildInsights(tasks: Task[], habits: Habit[], now: Date = new Date()): string[] {
  return [
    bestDayInsight(tasks, now),
    fragileHabitInsight(habits, now),
    momentumInsight(tasks, now),
  ].filter((s): s is string => s !== null);
}
