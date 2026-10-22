// ═══════════════════════════════════════════════════════════════════
// ORG-REPORTS MODULE - Durée des événements d'un rapport
// ═══════════════════════════════════════════════════════════════════

import type { ReportEvent } from './types';

/** Minutes d'agenda d'un événement, jamais négatives. */
export const eventMinutes = (e: Pick<ReportEvent, 'start' | 'end'>): number =>
  Math.max(0, Math.round((Date.parse(e.end) - Date.parse(e.start)) / 60000));
