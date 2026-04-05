// UI-STATE MODULE - Type Definitions
// ═══════════════════════════════════════════════════════════════════

/**
 * Color settings mapping category IDs to display names
 */
export type ColorSettings = Record<string, string>;

/**
 * Priority range filter [min, max]
 */
export type PriorityRange = [number, number];

/**
 * UI State configuration
 */
export interface UIState {
  favoriteColors: string[];
  priorityRange: PriorityRange;
  colorSettings: ColorSettings;
}
