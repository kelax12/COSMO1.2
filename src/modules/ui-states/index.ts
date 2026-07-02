// ═══════════════════════════════════════════════════════════════════
// UI-STATE MODULE - Public API
// ═══════════════════════════════════════════════════════════════════

// Types
export type { ColorSettings, PriorityRange, UIState, TaskSortPref, TaskSortPrefs } from './types';

// Constants
export {
  UI_STATE_STORAGE_KEY,
  FAVORITE_COLORS_KEY,
  PRIORITY_RANGE_KEY,
  TASK_SORT_PREFS_KEY,
  LAST_VISITED_PAGE_KEY,
  SORT_PREF_ALL_TASKS_KEY,
  DEFAULT_FAVORITE_COLORS,
  DEFAULT_PRIORITY_RANGE,
  DEFAULT_COLOR_SETTINGS,
} from './constants';

// Hooks
export {
  useFavoriteColors,
  usePriorityRange,
  useColorSettings,
  useUIState,
  useTaskSortPrefs,
  useLastVisitedPage,
  getLastVisitedPage,
} from './hooks';
