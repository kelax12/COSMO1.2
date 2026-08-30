export { useAdminStats, useIsAdmin, useAdminGate } from './hooks';
export { adminKeys, ACQUISITION_GOALS } from './constants';
export { AdminForbiddenError } from './repository';
export {
  chooseGranularity,
  fillMissingDays,
  aggregateWeekly,
  toCumulative,
  rankSources,
  stackBySource,
  DAY_THRESHOLD,
  OTHER_SOURCE,
} from './aggregate';
export type { Granularity } from './aggregate';
export type {
  AdminStats,
  AdminTotals,
  AdminDemoStats,
  AdminUsageStats,
  AdminAdoption,
  AdminActivation,
  AdminTasksCompletion,
  AdminCollaboration,
  AdminStickiness,
  RetentionCohort,
  DailyPoint,
  SourceDailyPoint,
  AdminActivation48h,
  SourceRetention,
  AdminOrgs,
} from './types';
