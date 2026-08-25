// ═══════════════════════════════════════════════════════════════════
// HABITS MODULE - Derived/Computed Hooks (Performance Optimized)
//
// All helpers consume the canonical Habit shape (`completions:
// Record<string, boolean>`) — the previous version of this file read a
// non-existent `completedDates` field which silently returned zeros.
// Faille B5.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useHabits } from './hooks';
import { calculateStreak as canonicalStreak } from './streak';
import { Habit, HabitFrequency } from './types';

// Convert the completions map to a list of ISO date strings (only the keys
// where the value is true).
const completedDatesFromCompletions = (
  completions: Record<string, boolean> | undefined
): string[] => {
  if (!completions) return [];
  const result: string[] = [];
  for (const date in completions) {
    if (completions[date]) result.push(date);
  }
  return result;
};

// ═══════════════════════════════════════════════════════════════════
// STREAK CALCULATIONS
// ═══════════════════════════════════════════════════════════════════

// UNE seule logique de streak CLIENT dans l'app (la source de verite est le serveur depuis la mig. 119, cf. `habitStreak`) : `modules/habits/streak.ts`, celle
// de la page Habitudes (HabitCard / HabitTable). Ce fichier en portait une
// SECONDE implémentation, subtilement différente ; ce n'est plus qu'un
// adaptateur de forme (liste de dates → Record attendu par la canonique).
const calculateStreak = (completedDates: string[]): number => {
  if (completedDates.length === 0) return 0;
  const completions: Record<string, boolean> = {};
  for (const date of completedDates) completions[date] = true;
  return canonicalStreak(completions);
};

const calculateCompletionRate = (completedDates: string[], days: number): number => {
  if (days <= 0) return 0;
  // Comparaison de chaînes YYYY-MM-DD locales — évite le mix UTC/local de
  // l'ancien `new Date(date)` (parse UTC minuit) vs bornes locales.
  const todayStr = new Date().toLocaleDateString('en-CA');
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  const startStr = start.toLocaleDateString('en-CA');

  const recentCompletions = completedDates.filter(
    (date) => date >= startStr && date <= todayStr
  );

  return Math.round((recentCompletions.length / days) * 100);
};

// ═══════════════════════════════════════════════════════════════════
// DERIVED HOOKS
// ═══════════════════════════════════════════════════════════════════

export const useHabitsWithStats = () => {
  const { data: habits = [], ...rest } = useHabits();

  const enriched = useMemo(() => {
    return habits.map((habit) => {
      const dates = completedDatesFromCompletions(habit.completions);
      return {
        ...habit,
        // Agregats SERVEUR d'abord (mig. 119) : `completions` est borne a une
        // fenetre glissante, en deriver serie et total les plafonnerait.
        // Les taux 7 et 30 jours restent calcules localement : leur fenetre
        // est tres inferieure a la fenetre transferee, ils sont donc exacts.
        currentStreak: habit.streakCurrent ?? calculateStreak(dates),
        completionRate7Days: calculateCompletionRate(dates, 7),
        completionRate30Days: calculateCompletionRate(dates, 30),
        totalCompletions: habit.completionsTotal ?? dates.length,
      };
    });
  }, [habits]);

  return { data: enriched, ...rest };
};

export const useHabitsByFrequency = () => {
  const { data: habits = [], ...rest } = useHabits();

  const grouped = useMemo(() => {
    const result: Record<HabitFrequency, Habit[]> = {
      daily: [],
      weekly: [],
      monthly: [],
    };
    habits.forEach((habit) => {
      const freq: HabitFrequency = habit.frequency || 'daily';
      if (result[freq]) result[freq].push(habit);
    });
    return result;
  }, [habits]);

  return { data: grouped, ...rest };
};

export const useHabitStats = () => {
  const { data: habits = [], ...rest } = useHabits();

  const stats = useMemo(() => {
    const total = habits.length;
    const today = new Date().toLocaleDateString('en-CA');

    const dateLists = habits.map((h) => completedDatesFromCompletions(h.completions));

    // ⚠️ Les agrégats SERVEUR d'abord (mig. 119). `h.completions` est borné à
    // une fenêtre glissante en mode Supabase : dériver série et total de cette
    // fenêtre les plafonnerait silencieusement. Le repli couvre la démo et le
    // repository local, qui ont toute la donnée.
    const streaks = habits.map((h, i) => h.streakCurrent ?? calculateStreak(dateLists[i]));
    const bests = habits.map((h, i) => h.streakBest ?? calculateStreak(dateLists[i]));

    const completedToday = dateLists.filter((dates) => dates.includes(today)).length;
    const totalCompletions = habits.reduce(
      (sum, h, i) => sum + (h.completionsTotal ?? dateLists[i].length),
      0,
    );

    const avgStreak =
      total > 0 ? Math.round(streaks.reduce((sum, n) => sum + n, 0) / total) : 0;

    const longestStreak = bests.reduce((max, n) => Math.max(max, n), 0);

    const avgCompletionRate7Days =
      total > 0
        ? Math.round(
            dateLists.reduce((sum, dates) => sum + calculateCompletionRate(dates, 7), 0) / total
          )
        : 0;

    return {
      total,
      completedToday,
      completionRateToday: total > 0 ? Math.round((completedToday / total) * 100) : 0,
      totalCompletions,
      avgStreak,
      longestStreak,
      avgCompletionRate7Days,
    };
  }, [habits]);

  return { data: stats, ...rest };
};

export const useHabitsNeedingAttention = (thresholdPercent: number = 50) => {
  const { data: habits = [], ...rest } = useHabits();

  const filtered = useMemo(() => {
    return habits.filter((habit) => {
      const dates = completedDatesFromCompletions(habit.completions);
      const rate = calculateCompletionRate(dates, 7);
      return rate < thresholdPercent;
    });
  }, [habits, thresholdPercent]);

  return { data: filtered, ...rest };
};

export const useTodaysHabitStatus = () => {
  const { data: habits = [], ...rest } = useHabits();

  const status = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA');
    return habits.map((habit) => {
      const dates = completedDatesFromCompletions(habit.completions);
      return {
        id: habit.id,
        name: habit.name,
        color: habit.color,
        isCompletedToday: dates.includes(today),
        currentStreak: habit.streakCurrent ?? calculateStreak(dates),
      };
    });
  }, [habits]);

  return { data: status, ...rest };
};
