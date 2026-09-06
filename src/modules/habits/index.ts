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
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
  useToggleHabitCompletion,
} from './hooks';

// Restauration (« Annuler ») — impose l'identifiant d'origine, cf. R-08.
export { useRestoreHabit } from './restore.hooks';

// ═══════════════════════════════════════════════════════════════════
// DERIVED HOOKS (Performance Optimized)
// ═══════════════════════════════════════════════════════════════════

// 🗑️ `hooks.derived.ts` a été SUPPRIMÉ le 2026-09-05 (C-49) : ses cinq
// sélecteurs n'avaient aucun consommateur. Le fichier était orphelin EN
// ENTIER. Cf. la note du baril `tasks`.
