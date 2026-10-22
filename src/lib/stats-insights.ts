// ═══════════════════════════════════════════════════════════════════
// Insights en langage naturel (#34) — helpers purs, testés unitairement.
// L'utilisateur moyen ne sait pas lire une heatmap : 2-3 phrases calculées
// client-side donnent la conclusion directement.
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 CES FONCTIONS NE RENDENT PAS DE TEXTE. Elles rendaient des phrases
// FRANÇAISES EN DUR — noms de jours compris — affichées telles quelles à un
// visiteur anglophone (revue du 2026-09-02, point 6). Elles rendent désormais
// des faits typés ; c'est la page qui les met en mots via le catalogue.
//
// ❌ Ne jamais réintroduire de littéral affichable ici : ce module est importé
//    par une page, il n'a pas de locale à lui.

import type { Task } from '@/modules/tasks';
import type { Habit } from '@/modules/habits';

/** Un fait mesuré, prêt à être mis en mots par le catalogue `statistics`. */
export type Insight =
  /** Jour de la semaine dominant. `weekday` : 0 = dimanche. */
  | { kind: 'bestDay'; weekday: number; share: number }
  | { kind: 'fragileHabit'; name: string; missed: number }
  /** Première semaine mesurable : aucune semaine précédente à comparer. */
  | { kind: 'momentumFirst'; count: number }
  | { kind: 'momentumUp'; count: number; delta: number }
  | { kind: 'momentumDown'; count: number; delta: number }
  | { kind: 'momentumStable'; count: number };

const localDay = (iso: string): string => new Date(iso).toLocaleDateString('en-CA');

/** Jour de la semaine le plus productif (complétions de tâches, 30 derniers jours). */
export function bestDayInsight(tasks: Task[], now: Date = new Date()): Insight | null {
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
  return { kind: 'bestDay', weekday: best, share: Math.round((byWeekday[best] / total) * 100) };
}

/** Combien de fois une habitude est ATTENDUE sur une fenêtre de 7 jours. */
const expectedOccurrences = (frequency: Habit['frequency']): number => {
  switch (frequency) {
    case 'daily': return 7;
    case 'weekly': return 1;
    case 'monthly': return 0; // une habitude mensuelle ne se juge pas sur 7 jours
  }
};

/**
 * Habitude la plus fragile : la plus manquée sur les 7 derniers jours.
 *
 * 🔴 Deux corrections (revue du 2026-09-02, point 26) :
 *   1. les jours ANTÉRIEURS à la création de l'habitude ne comptent pas — une
 *      habitude créée hier affichait « 6 oublis cette semaine », ce qui est un
 *      reproche adressé à quelqu'un qui vient de s'y mettre ;
 *   2. la FRÉQUENCE compte — une habitude hebdomadaire cochée une fois dans la
 *      semaine était comptée à 6 oublis alors qu'elle est parfaitement tenue.
 *
 * ⚠️ Le seuil de 3 oublis s'applique aux jours réellement attendus : une
 *    habitude dont la fenêtre utile fait moins de 3 jours ne peut donc pas
 *    être signalée, et c'est voulu.
 */
export function fragileHabitInsight(habits: Habit[], now: Date = new Date()): Insight | null {
  if (habits.length === 0) return null;
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString('en-CA'));
  }

  let worst: { name: string; missed: number } | null = null;
  for (const h of habits) {
    const expected = expectedOccurrences(h.frequency);
    if (expected === 0) continue;

    // Fenêtre bornée à la vie de l'habitude.
    const createdDay = h.createdAt ? localDay(h.createdAt) : null;
    const liveDays = createdDay ? days.filter((day) => day >= createdDay) : days;
    if (liveDays.length === 0) continue;

    const done = liveDays.filter((day) => h.completions[day]).length;
    // Attendu ramené au prorata de la fenêtre réellement vécue.
    const dueOnWindow = Math.round((expected * liveDays.length) / 7);
    const missed = Math.max(0, dueOnWindow - done);
    if (missed > 0 && (!worst || missed > worst.missed)) {
      worst = { name: h.name, missed };
    }
  }
  if (!worst || worst.missed < 3) return null; // rien d'alarmant
  return { kind: 'fragileHabit', name: worst.name, missed: worst.missed };
}

/** Dynamique de complétion : cette semaine vs la précédente. */
export function momentumInsight(tasks: Task[], now: Date = new Date()): Insight | null {
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
  if (lastWeek === 0) return { kind: 'momentumFirst', count: thisWeek };
  const delta = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  if (delta > 10) return { kind: 'momentumUp', count: thisWeek, delta };
  if (delta < -10) return { kind: 'momentumDown', count: thisWeek, delta };
  return { kind: 'momentumStable', count: thisWeek };
}

/** Les insights disponibles (max 3), dans l'ordre d'intérêt. */
export function buildInsights(tasks: Task[], habits: Habit[], now: Date = new Date()): Insight[] {
  return [
    bestDayInsight(tasks, now),
    fragileHabitInsight(habits, now),
    momentumInsight(tasks, now),
  ].filter((s): s is Insight => s !== null);
}
