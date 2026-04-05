// ═══════════════════════════════════════════════════════════════════
// HABITS MODULE - Derived/Computed Hooks (Performance Optimized)
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useHabits } from './hooks';
import { Habit, HabitFrequency } from './types';

// ═══════════════════════════════════════════════════════════════════
// STREAK CALCULATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate current streak for a habit
 */
const calculateStreak = (completedDates: string[]): number => {
  if (completedDates.length === 0) return 0;

  const sorted = [...completedDates].sort().reverse();
  const today = new Date().toISOString().split('T')[0];
  
  // Check if today or yesterday is completed
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  if (sorted[0] !== today && sorted[0] !== yesterdayStr) {
    return 0; // Streak broken
  }

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const curr = new Date(sorted[i - 1]);
    const prev = new Date(sorted[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
};

/**
 * Calculate completion rate for last N days
 */
const calculateCompletionRate = (completedDates: string[], days: number): number => {
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

/**
 * Get habits with calculated streaks and stats
 */
export const useHabitsWithStats = () => {
  const { data: habits = [], ...rest } = useHabits();

  const enriched = useMemo(() => {
    return habits.map((habit) => ({
      ...habit,
      currentStreak: calculateStreak(habit.completedDates || []),
      completionRate7Days: calculateCompletionRate(habit.completedDates || [], 7),
      completionRate30Days: calculateCompletionRate(habit.completedDates || [], 30),
      totalCompletions: habit.completedDates?.length || 0,
    }));
  }, [habits]);

  return { data: enriched, ...rest };
};

/**
 * Get habits grouped by frequency
 */
export const useHabitsByFrequency = () => {
  const { data: habits = [], ...rest } = useHabits();

  const grouped = useMemo(() => {
    const result: Record<HabitFrequency, Habit[]> = {
      daily: [],
      weekly: [],
      monthly: [],
    };

    habits.forEach((habit) => {
      const freq = habit.frequency || 'daily';
      if (result[freq]) {
        result[freq].push(habit);
      }
    });

    return result;
  }, [habits]);

  return { data: grouped, ...rest };
};

/**
 * Get habit statistics
 */
export const useHabitStats = () => {
  const { data: habits = [], ...rest } = useHabits();

  const stats = useMemo(() => {
    const total = habits.length;
    const today = new Date().toISOString().split('T')[0];
    
    const completedToday = habits.filter((h) =>
      h.completedDates?.includes(today)
    ).length;

    const totalCompletions = habits.reduce(
      (sum, h) => sum + (h.completedDates?.length || 0),
      0
    );

    const avgStreak =
      total > 0
        ? Math.round(
            habits.reduce(
              (sum, h) => sum + calculateStreak(h.completedDates || []),
              0
            ) / total
          )
        : 0;

    const longestStreak = habits.reduce(
      (max, h) => Math.max(max, calculateStreak(h.completedDates || [])),
      0
    );

    const avgCompletionRate7Days =
      total > 0
        ? Math.round(
            habits.reduce(
              (sum, h) =>
                sum + calculateCompletionRate(h.completedDates || [], 7),
              0
            ) / total
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

/**
 * Get habits that need attention (low completion rate)
 */
export const useHabitsNeedingAttention = (thresholdPercent: number = 50) => {
  const { data: habits = [], ...rest } = useHabits();

  const filtered = useMemo(() => {
    return habits.filter((habit) => {
      const rate = calculateCompletionRate(habit.completedDates || [], 7);
      return rate < thresholdPercent;
    });
  }, [habits, thresholdPercent]);

  return { data: filtered, ...rest };
};

/**
 * Get today's habit status
 */
export const useTodaysHabitStatus = () => {
  const { data: habits = [], ...rest } = useHabits();

  const status = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    
    return habits.map((habit) => ({
      id: habit.id,
      name: habit.name,
      color: habit.color,
      isCompletedToday: habit.completedDates?.includes(today) || false,
      currentStreak: calculateStreak(habit.completedDates || []),
    }));
  }, [habits]);

  return { data: status, ...rest };
};
