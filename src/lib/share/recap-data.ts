// Agrégats du « bilan de la semaine » partageable (image story 1080×1920).
//
// ⚠️ CONFIDENTIALITÉ — l'image sort de l'app et part sur un réseau social.
// Ce module ne produit QUE des agrégats : une grille de taux de complétion,
// des compteurs, une série. Aucun nom de tâche, d'habitude ou de catégorie,
// aucun email, aucun identifiant. Si un champ nominatif apparaît un jour ici,
// c'est une fuite, pas une amélioration.
//
// Dates en local (convention en-CA, cf. garde-fous timezone du projet) —
// jamais de new Date('YYYY-MM-DD'), qui parse en UTC.
import type { Habit } from '@/modules/habits/types';
import type { Task } from '@/modules/tasks/types';

/** Nombre de semaines de la heatmap (comme le « Suivi global »). */
export const RECAP_WEEKS = 26;

export interface RecapData {
  /** Lundi de la semaine couverte, 'YYYY-MM-DD'. */
  weekStart: string;
  /** Dimanche de la semaine couverte, 'YYYY-MM-DD'. */
  weekEnd: string;
  /**
   * Heatmap : RECAP_WEEKS colonnes × 7 lignes (lundi → dimanche), taux de
   * complétion du jour dans [0, 1]. `null` = jour futur (case vide).
   */
  grid: (number | null)[][];
  /** Tâches terminées dans la semaine (completedAt dans la fenêtre). */
  tasksCompleted: number;
  /** Jours consécutifs, jusqu'à aujourd'hui, avec au moins une habitude cochée. */
  streak: number;
  /** Minutes investies sur la semaine, ou null si la donnée n'est pas disponible. */
  minutes: number | null;
  /** Nombre d'habitudes suivies (contexte du taux, pas une donnée nominative). */
  habitCount: number;
}

const toKey = (date: Date): string => date.toLocaleDateString('en-CA');

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/** Lundi de la semaine d'une date (semaine ISO, lundi = premier jour). */
export function startOfWeek(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  return addDays(start, -daysSinceMonday);
}

/** Taux de complétion d'un jour : habitudes cochées / habitudes suivies. */
function dayRatio(habits: Habit[], key: string): number {
  if (habits.length === 0) return 0;
  const done = habits.reduce((count, habit) => count + (habit.completions?.[key] ? 1 : 0), 0);
  return done / habits.length;
}

/**
 * Série de jours consécutifs avec au moins une habitude cochée. La série
 * n'est pas cassée par la journée en cours encore vide : on démarre à hier si
 * aujourd'hui n'a rien — sinon le compteur tomberait à 0 chaque matin.
 */
export function computeStreak(habits: Habit[], today: Date): number {
  if (habits.length === 0) return 0;
  const hasAny = (date: Date) => habits.some((h) => h.completions?.[toKey(date)]);
  let cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);
  if (!hasAny(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (hasAny(cursor) && streak < 3650) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export interface BuildRecapInput {
  habits: Habit[];
  tasks: Task[];
  /** Minutes investies sur la semaine (module stats), null si indisponible. */
  minutes?: number | null;
  today?: Date;
}

export function buildRecap({ habits, tasks, minutes = null, today = new Date() }: BuildRecapInput): RecapData {
  const reference = new Date(today);
  reference.setHours(0, 0, 0, 0);
  const weekStart = startOfWeek(reference);
  const weekEnd = addDays(weekStart, 6);

  // La grille se termine sur la semaine courante ; on remonte RECAP_WEEKS - 1.
  const gridStart = addDays(weekStart, -7 * (RECAP_WEEKS - 1));
  const grid: (number | null)[][] = [];
  for (let week = 0; week < RECAP_WEEKS; week += 1) {
    const column: (number | null)[] = [];
    for (let day = 0; day < 7; day += 1) {
      const date = addDays(gridStart, week * 7 + day);
      column.push(date > reference ? null : dayRatio(habits, toKey(date)));
    }
    grid.push(column);
  }

  const startKey = toKey(weekStart);
  const endKey = toKey(weekEnd);
  const tasksCompleted = tasks.filter((task) => {
    if (!task.completed || !task.completedAt) return false;
    const key = new Date(task.completedAt).toLocaleDateString('en-CA');
    return key >= startKey && key <= endKey;
  }).length;

  return {
    weekStart: startKey,
    weekEnd: endKey,
    grid,
    tasksCompleted,
    streak: computeStreak(habits, reference),
    minutes,
    habitCount: habits.length,
  };
}

/** « 3 h 20 » / « 45 min » / '—' — jamais « 200 minutes ». */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes) || minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}
