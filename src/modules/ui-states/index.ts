// ═══════════════════════════════════════════════════════════════════
// UI-STATE MODULE - Public API
// ═══════════════════════════════════════════════════════════════════

// Types
export type { ColorSettings, PriorityRange, UIState } from './types';

// Constants
export {
  UI_STATE_STORAGE_KEY,
  FAVORITE_COLORS_KEY,
  PRIORITY_RANGE_KEY,
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
} from './hooks';
