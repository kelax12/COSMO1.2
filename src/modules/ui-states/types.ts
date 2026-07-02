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
 * Préférence de tri d'une liste de tâches (mémorisée par liste)
 */
export interface TaskSortPref {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Préférences de tri par liste — clé = listId (ou '__all__' hors filtre liste)
 */
export type TaskSortPrefs = Record<string, TaskSortPref>;

/**
 * UI State configuration
 */
export interface UIState {
  favoriteColors: string[];
  priorityRange: PriorityRange;
  colorSettings: ColorSettings;
}
