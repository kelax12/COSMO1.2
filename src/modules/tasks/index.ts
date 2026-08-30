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
  useTasksByDate,
  useFilteredTasks,
  useTodaysTasks,
  usePendingTasks,
  useBookmarkedTasks,
  useCompletedTasks,
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

// ═══════════════════════════════════════════════════════════════════
// DERIVED HOOKS (Performance Optimized)
// ═══════════════════════════════════════════════════════════════════
export {
  useTasksByStatus,
  useTasksByCategory,
  useTasksByPriority,
  useTaskStats,
  useSearchTasks,
  useTasksInPriorityRange,
  useTasksDueWithinDays,
  useTaskLookup,
} from './hooks.derived';
