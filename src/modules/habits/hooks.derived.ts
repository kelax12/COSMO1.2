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

const calculateStreak = (completedDates: string[]): number => {
  if (completedDates.length === 0) return 0;

  const sorted = [...completedDates].sort().reverse();
  const today = new Date().toISOString().split('T')[0];

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (sorted[0] !== today && sorted[0] !== yesterdayStr) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const curr = new Date(sorted[i - 1]);
    const prev = new Date(sorted[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) streak++;
    else break;
  }
  return streak;
};

const calculateCompletionRate = (completedDates: string[], days: number): number => {
  if (days <= 0) return 0;
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - days);

  const recentCompletions = completedDates.filter((date) => {
    const d = new Date(date);
    return d >= startDate && d <= now;
  });

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
        currentStreak: calculateStreak(dates),
        completionRate7Days: calculateCompletionRate(dates, 7),
        completionRate30Days: calculateCompletionRate(dates, 30),
        totalCompletions: dates.length,
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
    const today = new Date().toISOString().split('T')[0];

    const dateLists = habits.map((h) => completedDatesFromCompletions(h.completions));

    const completedToday = dateLists.filter((dates) => dates.includes(today)).length;
    const totalCompletions = dateLists.reduce((sum, dates) => sum + dates.length, 0);

    const avgStreak =
      total > 0
        ? Math.round(dateLists.reduce((sum, dates) => sum + calculateStreak(dates), 0) / total)
        : 0;

    const longestStreak = dateLists.reduce((max, dates) => Math.max(max, calculateStreak(dates)), 0);

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
    const today = new Date().toISOString().split('T')[0];
    return habits.map((habit) => {
      const dates = completedDatesFromCompletions(habit.completions);
      return {
        id: habit.id,
        name: habit.name,
        color: habit.color,
        isCompletedToday: dates.includes(today),
        currentStreak: calculateStreak(dates),
      };
    });
  }, [habits]);

  return { data: status, ...rest };
};
