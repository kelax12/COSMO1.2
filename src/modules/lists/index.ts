// ═══════════════════════════════════════════════════════════════════
// LISTS MODULE - Public API
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type { 
  TaskList, 
  CreateListInput, 
  UpdateListInput 
} from './types';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS & QUERY KEYS
// ═══════════════════════════════════════════════════════════════════

export { listKeys, LISTS_STORAGE_KEY } from './constants';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY
// ═══════════════════════════════════════════════════════════════════

export type { IListsRepository } from './repository';
export { LocalStorageListsRepository } from './repository';
export { SupabaseListsRepository } from './supabase.repository';

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════

export {
  useLists,
  useList,
  useListsForTask,
} from './hooks';

// ═══════════════════════════════════════════════════════════════════
// WRITE HOOKS (Mutations)
// ═══════════════════════════════════════════════════════════════════

export {
  useCreateList,
  useUpdateList,
  useDeleteList,
  useAddTaskToList,
  useRemoveTaskFromList,
} from './hooks';
