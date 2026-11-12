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
// Dépôt de démo NON réexporté : le baril est importé par le shell,
// la réexportation ramenait le dépôt dans le chunk d'ENTRÉE alors que la fabrique
// le charge à la demande (`src/lib/demo-repositories.ts`).
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

// 🗑️ `hooks.derived.ts` a été SUPPRIMÉ (C-49) : ses cinq
// sélecteurs n'avaient aucun consommateur. Le fichier était orphelin EN
// ENTIER. Cf. la note du baril `tasks`.
