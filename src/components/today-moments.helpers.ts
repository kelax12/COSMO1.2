// ═══════════════════════════════════════════════════════════════════
// Découpage de la journée en trois moments (maquette 28) — calcul pur, testé.
// ═══════════════════════════════════════════════════════════════════
import type { CalendarEvent } from '@/modules/events';
import type { TodayItem } from '@/modules/today';

export type MomentKey = 'morning' | 'afternoon' | 'evening';

export const MOMENTS: readonly MomentKey[] = ['morning', 'afternoon', 'evening'] as const;

/** Bornes en heure LOCALE. Midi et 18 h : les deux coupures qu'on nomme. */
export const AFTERNOON_FROM = 12;
export const EVENING_FROM = 18;

export function momentOfHour(hour: number): MomentKey {
  if (hour < AFTERNOON_FROM) return 'morning';
  if (hour < EVENING_FROM) return 'afternoon';
  return 'evening';
}

export interface MomentEntry {
  key: string;
  /** Heure locale `HH:MM` pour un rendez-vous, `null` pour une tâche. */
  time: string | null;
  /** Minutes depuis minuit — sert au tri ; les tâches passent après. */
  minutes: number;
  event?: CalendarEvent;
  task?: TodayItem;
}

export interface MomentGroup {
  moment: MomentKey;
  entries: MomentEntry[];
}

export interface BuildMomentsInput {
  events: CalendarEvent[];
  tasks: TodayItem[];
  now?: Date;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Range les rendez-vous du jour et les tâches à faire dans les trois moments.
 *
 * 🔴 Une tâche N'A PAS d'heure dans ce produit — ni `tasks`, ni `team_tasks`
 * n'en portent (vérifié dans les deux modèles). Elle est donc placée dans le
 * moment COURANT, celui où il reste à la faire, et elle avance avec la journée.
 * On ne lui invente pas de créneau : une tâche affichée à « 11:00 » parce qu'un
 * algorithme l'a répartie serait une heure fausse, indiscernable d'une vraie.
 *
 * Un rendez-vous, lui, va dans le moment de SON heure — c'est la seule donnée
 * temporelle réelle de l'écran.
 *
 * Le jour est lu en heure locale (`toLocaleDateString('en-CA')`), jamais via
 * `toISOString()` : à 23 h à l'est de Greenwich celui-ci renvoie le lendemain
 * et la journée se vide le soir.
 */
export function buildMoments({ events, tasks, now = new Date() }: BuildMomentsInput): MomentGroup[] {
  const today = now.toLocaleDateString('en-CA');
  const currentMoment = momentOfHour(now.getHours());

  const byMoment: Record<MomentKey, MomentEntry[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };

  for (const event of events) {
    const start = new Date(event.start);
    if (Number.isNaN(start.getTime())) continue;
    if (start.toLocaleDateString('en-CA') !== today) continue;
    const hour = start.getHours();
    byMoment[momentOfHour(hour)].push({
      key: `event-${event.id}`,
      time: `${pad(hour)}:${pad(start.getMinutes())}`,
      minutes: hour * 60 + start.getMinutes(),
      event,
    });
  }

  for (const task of tasks) {
    if (task.done) continue;
    byMoment[currentMoment].push({
      key: `${task.source}-${task.id}`,
      time: null,
      // `Infinity` : à l'intérieur d'un moment, ce qui a une heure passe avant
      // ce qui n'en a pas. L'ordre des tâches entre elles reste celui que
      // `mergeTodayItems` a déjà tranché (retard, puis priorité, puis nom).
      minutes: Number.POSITIVE_INFINITY,
      task,
    });
  }

  return MOMENTS.map((moment) => ({
    moment,
    entries: byMoment[moment].sort((a, b) => a.minutes - b.minutes),
  })).filter((group) => group.entries.length > 0);
}
