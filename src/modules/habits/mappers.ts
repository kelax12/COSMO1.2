// ═══════════════════════════════════════════════════════════════════
// Habits — pure DB <-> domain mappers (extracted for unit-testability).
// `mapHabitToDb` is a SECURITY BOUNDARY: never emit `user_id` (anti
// mass-assignment, faille V1). Canonical completion field is `completions`
// (Record<string,boolean>), never `completedDates` (faille B5).
// ═══════════════════════════════════════════════════════════════════
import type { Habit, HabitScheduleChange } from './types';
import { toJson } from '@/lib/db-contract';
import type { ColumnsExist, DbPatch, DbRow, RpcRow, Verified } from '@/lib/db-contract';
import { normalizeScheduledDays } from './schedule';

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
  scheduled_days?: number[] | null;
  schedule_history?: HabitScheduleChange[] | null;
  // Colonnes supplementaires de `get_my_habits()` (mig. 119) — absentes d'un
  // SELECT direct sur la table, d'ou l'optionnalite.
  streak_current?: number;
  streak_best?: number;
  completions_total?: number;
  first_completion_date?: string | null;
  window_days?: number;
}

/**
 * Ce que `mapHabitToDb` émet : sans `id` ni `user_id` (faille V1) ni
 * `completions` (DAT-02), deux interdits que la compilation tient désormais.
 */
export type HabitDbInput = Omit<DbPatch<'habits'>, 'completions'>;

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
    ...(row.scheduled_days && row.scheduled_days.length > 0
      ? { scheduledDays: [...row.scheduled_days] }
      : {}),
    ...(row.schedule_history && row.schedule_history.length > 0
      ? { scheduleHistory: row.schedule_history }
      : {}),
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
  // Jours prévus (mig. 254). Vide ou 7 jours = « tous les jours » = NULL en
  // base. Émis seulement s'ils sont fournis : une création par défaut n'écrit
  // rien, donc ne dépend pas de la colonne.
  if (input.scheduledDays !== undefined) {
    const days = normalizeScheduledDays(input.scheduledDays);
    result.scheduled_days = days.length === 0 || days.length === 7 ? null : days;
  }
  if (input.scheduleHistory !== undefined) {
    result.schedule_history = toJson<HabitScheduleChange[]>(input.scheduleHistory.map((e) => ({
      from: e.from,
      days: normalizeScheduledDays(e.days),
    })));
  }
  // 🔴 `completions` n'est JAMAIS émis (DAT-02) : l'historique vit dans
  // `habit_completions` (mig. 248), écrit par `toggle_habit_completion_v2` et,
  // pour un « Annuler », par `createHabit`. Écrire la colonne JSONB remplacerait
  // son contenu (fenêtre bornée, mig. 119) et ne toucherait plus la table lue.
  return result;
}

// ARC-07 : une colonne renommée en base casse `tsc` ici, pas en production.
// `HabitRow` lit aussi les colonnes calculées de `get_my_habits()` (mig. 119).
export type HabitRowContract = Verified<ColumnsExist<HabitRow, DbRow<'habits'> & RpcRow<'get_my_habits'>>>;
