// ═══════════════════════════════════════════════════════════════════
// STATS MODULE - React Query keys
// ═══════════════════════════════════════════════════════════════════

import type { WorkTimeRange } from './types';

export const statsKeys = {
  all: ['stats'] as const,
  workTime: (ranges: WorkTimeRange[]) => [...statsKeys.all, 'work-time', ranges] as const,
};
