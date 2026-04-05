// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - Derived/Computed Hooks (Performance Optimized)
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useOkrs } from './hooks';
import { OKR, KeyResult, OKRStatus } from './types';

// ═══════════════════════════════════════════════════════════════════
// PROGRESS CALCULATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate progress for a single key result
 */
const calculateKeyResultProgress = (kr: KeyResult): number => {
  if (kr.targetValue === 0) return 0;
  return Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100));
};

/**
 * Calculate overall progress for an OKR
 */
const calculateOKRProgress = (okr: OKR): number => {
  if (okr.keyResults.length === 0) return 0;

  const totalProgress = okr.keyResults.reduce(
    (sum, kr) => sum + calculateKeyResultProgress(kr),
    0
  );

  return Math.round(totalProgress / okr.keyResults.length);
};

// ═══════════════════════════════════════════════════════════════════
// DERIVED HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get OKRs with calculated progress
 */
export const useOkrsWithProgress = () => {
  const { data: okrs = [], ...rest } = useOkrs();

  const enriched = useMemo(() => {
    return okrs.map((okr) => ({
      ...okr,
      progress: calculateOKRProgress(okr),
      keyResults: okr.keyResults.map((kr) => ({
        ...kr,
        progress: calculateKeyResultProgress(kr),
      })),
    }));
  }, [okrs]);

  return { data: enriched, ...rest };
};

/**
 * Get OKRs grouped by status
 */
export const useOkrsByStatus = () => {
  const { data: okrs = [], ...rest } = useOkrs();

  const grouped = useMemo(() => {
    const result: Record<OKRStatus, OKR[]> = {
      not_started: [],
      in_progress: [],
      at_risk: [],
      completed: [],
    };

    okrs.forEach((okr) => {
      const status = okr.status || 'not_started';
      if (result[status]) {
        result[status].push(okr);
      }
    });

    return result;
  }, [okrs]);

  return { data: grouped, ...rest };
};

/**
 * Get OKR statistics
 */
export const useOkrStats = () => {
  const { data: okrs = [], ...rest } = useOkrs();

  const stats = useMemo(() => {
    const total = okrs.length;
    const completed = okrs.filter((o) => o.status === 'completed').length;
    const atRisk = okrs.filter((o) => o.status === 'at_risk').length;
    const inProgress = okrs.filter((o) => o.status === 'in_progress').length;
    const notStarted = okrs.filter((o) => o.status === 'not_started').length;

    // Calculate average progress
    const avgProgress =
      total > 0
        ? Math.round(
            okrs.reduce((sum, okr) => sum + calculateOKRProgress(okr), 0) / total
          )
        : 0;

    // Total key results
    const totalKeyResults = okrs.reduce(
      (sum, okr) => sum + okr.keyResults.length,
      0
    );

    // Completed key results (100%)
    const completedKeyResults = okrs.reduce(
      (sum, okr) =>
        sum +
        okr.keyResults.filter((kr) => kr.currentValue >= kr.targetValue).length,
      0
    );

    return {
      total,
      completed,
      atRisk,
      inProgress,
      notStarted,
      avgProgress,
      totalKeyResults,
      completedKeyResults,
      keyResultCompletionRate:
        totalKeyResults > 0
          ? Math.round((completedKeyResults / totalKeyResults) * 100)
          : 0,
    };
  }, [okrs]);

  return { data: stats, ...rest };
};

/**
 * Get OKRs ending soon (within N days)
 */
export const useOkrsEndingSoon = (days: number = 7) => {
  const { data: okrs = [], ...rest } = useOkrs();

  const filtered = useMemo(() => {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + days);

    return okrs.filter((okr) => {
      if (okr.status === 'completed') return false;
      if (!okr.endDate) return false;
      const endDate = new Date(okr.endDate);
      return endDate >= now && endDate <= futureDate;
    });
  }, [okrs, days]);

  return { data: filtered, ...rest };
};

/**
 * Get at-risk OKRs (behind schedule)
 */
export const useAtRiskOkrs = () => {
  const { data: okrs = [], ...rest } = useOkrs();

  const atRisk = useMemo(() => {
    return okrs.filter((okr) => {
      if (okr.status === 'completed') return false;
      if (!okr.startDate || !okr.endDate) return false;

      const start = new Date(okr.startDate);
      const end = new Date(okr.endDate);
      const now = new Date();

      // Calculate expected progress based on time elapsed
      const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      const daysElapsed = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      const expectedProgress = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;

      const actualProgress = calculateOKRProgress(okr);

      // At risk if actual progress is 20% or more behind expected
      return actualProgress < expectedProgress - 20;
    });
  }, [okrs]);

  return { data: atRisk, ...rest };
};
