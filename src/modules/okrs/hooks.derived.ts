// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - Derived/Computed Hooks (Performance Optimized)
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useOkrs } from './hooks';
import { OKR, KeyResult, OKRStatus } from './types';

// ═══════════════════════════════════════════════════════════════════
// ENRICHED KEY RESULT TYPE
// ═══════════════════════════════════════════════════════════════════

export type EnrichedKeyResult = KeyResult & { okrId: string };

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

/**
 * Derive an OKR status from its fields. The `OKR` model stores `completed`
 * + `progress` + dates rather than a persisted `status`, so status is computed:
 * - completed flag wins
 * - behind expected schedule by ≥20% → at_risk
 * - zero progress → not_started, otherwise in_progress
 */
const deriveOKRStatus = (okr: OKR): OKRStatus => {
  if (okr.completed) return 'completed';
  const progress = calculateOKRProgress(okr);
  if (okr.startDate && okr.endDate) {
    const start = new Date(okr.startDate).getTime();
    const end = new Date(okr.endDate).getTime();
    const now = Date.now();
    const totalDays = (end - start) / (1000 * 60 * 60 * 24);
    const elapsed = (now - start) / (1000 * 60 * 60 * 24);
    const expected = totalDays > 0 ? (elapsed / totalDays) * 100 : 0;
    if (progress < expected - 20) return 'at_risk';
  }
  return progress <= 0 ? 'not_started' : 'in_progress';
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
      const status = deriveOKRStatus(okr);
      result[status].push(okr);
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
    const statuses = okrs.map(deriveOKRStatus);
    const completed = statuses.filter((s) => s === 'completed').length;
    const atRisk = statuses.filter((s) => s === 'at_risk').length;
    const inProgress = statuses.filter((s) => s === 'in_progress').length;
    const notStarted = statuses.filter((s) => s === 'not_started').length;

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
      if (okr.completed) return false;
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
      if (okr.completed) return false;
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

// ═══════════════════════════════════════════════════════════════════
// KEY RESULT DERIVED HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Flat list of all KeyResults enriched with their parent okrId.
 * Derived from useOkrs() — single source of truth, no data duplication.
 */
export const useKeyResults = () => {
  const { data: okrs = [], ...rest } = useOkrs();

  const keyResults = useMemo<EnrichedKeyResult[]>(
    () =>
      okrs.flatMap((o) =>
        o.keyResults.map((kr) => ({ ...kr, okrId: o.id }))
      ),
    [okrs]
  );

  return { data: keyResults, ...rest };
};

/**
 * Completed KeyResults with guaranteed non-null completedAt.
 * Optimized for dashboard period-based filtering (jour/semaine/mois).
 */
export const useCompletedKeyResults = () => {
  const { data: keyResults, ...rest } = useKeyResults();

  const completed = useMemo(
    () =>
      keyResults.filter(
        (kr): kr is EnrichedKeyResult & { completedAt: string } =>
          kr.completed && kr.completedAt != null
      ),
    [keyResults]
  );

  return { data: completed, ...rest };
};
