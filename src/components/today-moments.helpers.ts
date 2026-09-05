// ═══════════════════════════════════════════════════════════════════
// Découpage de la journée en trois moments (maquette 28) — calcul pur, testé.
// ═══════════════════════════════════════════════════════════════════
import type { CalendarEvent } from '@/modules/events';
import type { Habit } from '@/modules/habits';
import type { Task } from '@/modules/tasks';
import type { TeamTask } from '@/modules/team-projects';
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

export interface TodayCompletionReport {
  tasksDone: number;
  habitsDone: number;
  eventsToday: number;
  /** Total, pour distinguer « journée bouclée » de « compte vide ». */
  total: number;
  /** `HH:MM` de la DERNIÈRE chose terminée, ou null si aucun horodatage. */
  closedAt: string | null;
  /** Rendez-vous du jour PAS ENCORE terminés — ils gardent la journée ouverte. */
  upcomingEvents: number;
}

/**
 * Ce qui a été fait aujourd'hui — maquette 49, « La journée bouclée, sans
 * confettis ». Un fait, un chiffre, une heure.
 *
 * ⚠️ `closedAt` peut être null et l'appelant doit le supporter : `completedAt`
 * n'est pas garanti (les tâches créées avant son introduction, et le
 * repository local, n'en portent pas). Mieux vaut taire l'heure que la
 * remplacer par « maintenant » — ce serait afficher l'heure à laquelle on
 * REGARDE l'écran comme celle à laquelle on a fini.
 *
 * Aucune série de jours ici : la compter demanderait un historique de journées
 * complètes que rien ne stocke. « Cinquième jour d'affilée » aurait été un
 * chiffre inventé, et un chiffre inventé dans une récompense est pire qu'une
 * récompense absente.
 */
export function todayCompletionReport({
  tasks,
  teamTasks = [],
  habits,
  events,
  now = new Date(),
}: {
  tasks: Task[];
  /** Tâches d'équipe qui me sont assignées — elles comptent autant. */
  teamTasks?: TeamTask[];
  habits: Habit[];
  events: CalendarEvent[];
  now?: Date;
}): TodayCompletionReport {
  const today = now.toLocaleDateString('en-CA');

  let lastCompletion: Date | null = null;
  let tasksDone = 0;
  // ⚠️ Les DEUX sources sont comptées. Ne prendre que `tasks` sous-estimait le
  // chiffre d'un membre d'organisation : mesuré dans le navigateur, trois
  // tâches cochées d'affilée dans le fil s'affichaient « 1 tâche ». Un écran de
  // récompense qui compte moins que ce qu'on vient de faire est pire que pas
  // d'écran du tout. Les deux modèles portent `completedAt` (mig. 091 côté
  // équipe), donc les deux sont datables.
  for (const task of [...tasks, ...teamTasks]) {
    if (!task.completed || !task.completedAt) continue;
    const at = new Date(task.completedAt);
    if (Number.isNaN(at.getTime()) || at.toLocaleDateString('en-CA') !== today) continue;
    tasksDone += 1;
    if (!lastCompletion || at > lastCompletion) lastCompletion = at;
  }

  const habitsDone = habits.filter((habit) => habit.completions?.[today]).length;

  const todaysEvents = events.filter((event) => {
    const start = new Date(event.start);
    return !Number.isNaN(start.getTime()) && start.toLocaleDateString('en-CA') === today;
  });
  const eventsToday = todaysEvents.length;

  // 🔴 Un rendez-vous ne se « termine » pas d'un clic : il passe. Sans cette
  // distinction, « Tout est fait » ne pourrait JAMAIS s'afficher un jour où
  // l'agenda contient quoi que ce soit — la condition aurait été morte, et le
  // seul moyen de s'en apercevoir aurait été de tomber sur une journée sans
  // aucun rendez-vous. On regarde donc la fin (à défaut le début).
  const upcomingEvents = todaysEvents.filter((event) => {
    const end = new Date(event.end || event.start);
    return Number.isNaN(end.getTime()) ? false : end > now;
  }).length;

  return {
    tasksDone,
    habitsDone,
    eventsToday,
    total: tasksDone + habitsDone + eventsToday,
    closedAt: lastCompletion
      ? `${pad(lastCompletion.getHours())}:${pad(lastCompletion.getMinutes())}`
      : null,
    upcomingEvents,
  };
}
