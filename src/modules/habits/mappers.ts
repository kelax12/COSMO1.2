// ═══════════════════════════════════════════════════════════════════
// Habits — pure DB <-> domain mappers (extracted for unit-testability).
// `mapHabitToDb` is a SECURITY BOUNDARY: never emit `user_id` (anti
// mass-assignment, faille V1). Canonical completion field is `completions`
// (Record<string,boolean>), never `completedDates` (faille B5).
// ═══════════════════════════════════════════════════════════════════
import { Habit } from './types';

/** Supabase DB row type for the `habits` table (snake_case). */
export interface HabitRow {
  id: string;
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  estimated_time: number;
  color: string;
  icon: string;
  completions?: Record<string, boolean>;
  created_at?: string;
  user_id?: string;
  // Colonnes supplementaires de `get_my_habits()` (mig. 119) — absentes d'un
  // SELECT direct sur la table, d'ou l'optionnalite.
  streak_current?: number;
  streak_best?: number;
  completions_total?: number;
  first_completion_date?: string | null;
  window_days?: number;
}

/** DB input type for insert/update operations (snake_case). */
export interface HabitDbInput {
  name?: string;
  description?: string;
  frequency?: 'daily' | 'weekly' | 'monthly';
  estimated_time?: number;
  color?: string;
  icon?: string;
  completions?: Record<string, boolean>;
  user_id?: string;
}

export function mapHabitFromDb(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    frequency: row.frequency,
    estimatedTime: row.estimated_time,
    color: row.color,
    icon: row.icon,
    completions: row.completions || {},
    createdAt: row.created_at,
    userId: row.user_id,
    streakCurrent: row.streak_current,
    streakBest: row.streak_best,
    completionsTotal: row.completions_total,
    firstCompletionDate: row.first_completion_date ?? undefined,
    completionsWindowDays: row.window_days,
  };
}

export function mapHabitToDb(input: Partial<Habit>): HabitDbInput {
  const result: HabitDbInput = {};
  if (input.name !== undefined) result.name = input.name;
  if (input.description !== undefined) result.description = input.description;
  if (input.frequency !== undefined) result.frequency = input.frequency;
  if (input.estimatedTime !== undefined) result.estimated_time = input.estimatedTime;
  if (input.color !== undefined) result.color = input.color;
  if (input.icon !== undefined) result.icon = input.icon;
  // 🔴 `completions` REMPLACE la colonne entière, elle ne la fusionne pas.
  // Depuis la mig. 119, la map lue par le client est BORNÉE à une fenêtre :
  // la renvoyer telle quelle DÉTRUIRAIT définitivement tout l'historique
  // au-delà de la fenêtre. Aucun écran ne le fait aujourd'hui (`HabitModal`
  // n'envoie que name / estimatedTime / color), et il ne faut pas commencer :
  // la bascule d'un jour passe par `toggle_habit_completion_v2`, qui écrit
  // une seule clé de façon atomique.
  if (input.completions !== undefined) result.completions = input.completions;
  return result;
}
