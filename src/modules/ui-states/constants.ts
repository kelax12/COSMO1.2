// ═══════════════════════════════════════════════════════════════════
// UI-STATE MODULE - Constants
// ═══════════════════════════════════════════════════════════════════

import { ColorSettings, PriorityRange } from './types';

/**
 * LocalStorage keys
 */
export const UI_STATE_STORAGE_KEY = 'cosmo_ui_state';
export const FAVORITE_COLORS_KEY = 'cosmo_favorite_colors';
export const PRIORITY_RANGE_KEY = 'cosmo_priority_range';

/**
 * Default favorite colors
 */
export const DEFAULT_FAVORITE_COLORS: string[] = [
  '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#F97316', '#EC4899'
];

/**
 * Default priority range
 */
export const DEFAULT_PRIORITY_RANGE: PriorityRange = [1, 5];

/**
 * Default color settings (category ID -> display name)
 * Note: This maps to categories for backward compatibility
 */
export const DEFAULT_COLOR_SETTINGS: ColorSettings = {
  'cat-1': 'Travail',
  'cat-2': 'Personnel',
  'cat-3': 'Santé',
  'cat-4': 'Apprentissage',
  'cat-5': 'Projets',
};
