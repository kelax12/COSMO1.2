// ═══════════════════════════════════════════════════════════════════
// HABITS MODULE - Public API
// ═══════════════════════════════════════════════════════════════════

// Types
export type { Habit, CreateHabitInput, UpdateHabitInput, HabitFrequency } from './types';

// Constants
export { habitKeys, HABITS_STORAGE_KEY } from './constants';

// Repository interface
export type { IHabitsRepository } from './repository';

// Repository implementations
export { LocalStorageHabitsRepository } from './local.repository';
export { SupabaseHabitsRepository } from './supabase.repository';

// React Query hooks
export {
  useHabits,
  useHabit,
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
  useToggleHabitCompletion,
} from './hooks';

// ═══════════════════════════════════════════════════════════════════
// DERIVED HOOKS (Performance Optimized)
// ═══════════════════════════════════════════════════════════════════

export {
  useHabitsWithStats,
  useHabitsByFrequency,
  useHabitStats,
  useHabitsNeedingAttention,
  useTodaysHabitStatus,
} from './hooks.derived';
