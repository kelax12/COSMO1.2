// ═══════════════════════════════════════════════════════════════════
// TASKS MODULE - Public API
// ═══════════════════════════════════════════════════════════════════

// Types
export type { Task, CreateTaskInput, UpdateTaskInput, TaskFilters, TaskStatus } from './types';

// Constants
export { taskKeys, TASKS_STORAGE_KEY } from './constants';

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
  useTasksByDate,
  useFilteredTasks,
  useTodaysTasks,
  usePendingTasks,
  useBookmarkedTasks,
  useCompletedTasks,
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
  useTasksInfinite,
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
