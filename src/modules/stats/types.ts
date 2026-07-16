// ═══════════════════════════════════════════════════════════════════
// STATS MODULE - Types
// ═══════════════════════════════════════════════════════════════════

/** Plage de dates locales inclusives, format YYYY-MM-DD (convention en-CA). */
export interface WorkTimeRange {
  start: string;
  end: string;
}

/** Agrégat « temps investi » (minutes) pour une plage de dates. */
export interface WorkTimeBucket {
  tasksTime: number;
  eventsTime: number;
  habitsTime: number;
  okrTime: number;
  totalTime: number;
}
