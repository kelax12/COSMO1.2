// ═══════════════════════════════════════════════════════════════════
// TASKS MODULE - Public API
// ═══════════════════════════════════════════════════════════════════

// Types
export type { Task, Subtask, TaskDependency, CreateTaskInput, UpdateTaskInput, TaskFilters, TaskStatus, TaskRecurrence } from './types';

// Récurrence (#26) — helpers purs
export { nextOccurrenceDeadline, buildNextOccurrence } from './recurrence';

// Constants
export { taskKeys, TASKS_STORAGE_KEY, TASK_DEPENDENCIES_STORAGE_KEY } from './constants';

// Repository interface
export type { ITasksRepository } from './repository';

// Repository implementations
export { LocalStorageTasksRepository } from './local.repository';
export { SupabaseTasksRepository } from './supabase.repository';

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════
export {
  useTasks,
  useTask,
  usePendingSharedTasks,
  useFilteredTasks,
  usePendingTasks,
  useTaskDependencies,
} from './hooks';

// ═══════════════════════════════════════════════════════════════════
// WRITE HOOKS
// ═══════════════════════════════════════════════════════════════════
export {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useToggleTaskComplete,
  useToggleTaskBookmark,
  useAddTaskDependency,
  useRemoveTaskDependency,
} from './hooks';

// 🗑️ `hooks.derived.ts` a été SUPPRIMÉ le 2026-09-05 (C-49). Ses huit
// sélecteurs — `useTasksByStatus`, `useTasksByCategory`, `useTasksByPriority`,
// `useTaskStats`, `useSearchTasks`, `useTasksInPriorityRange`,
// `useTasksDueWithinDays`, `useTaskLookup` — étaient exportés sans qu'aucun
// écran ne les monte. Le fichier était orphelin EN ENTIER.
//
// ❌ Ne pas les recréer « pour la performance ». C'était l'intitulé de la
// section (« Performance Optimized ») et c'est un contresens : un `useMemo`
// sur une donnée déjà chargée ne fait économiser aucune requête. Un écran qui
// a besoin d'un sous-ensemble le calcule là où il l'affiche, et le jour où
// deux écrans veulent le MÊME sous-ensemble, il se factorise contre eux deux.

// Restauration d'un « Annuler » — fichier separe, cf. son en-tete.
export { useRestoreTask } from './restore.hooks';
