// ═══════════════════════════════════════════════════════════════════
// ORG-REPORTS MODULE - Public API
// ═══════════════════════════════════════════════════════════════════

export type {
  ReportScope,
  ReportTask,
  ReportProject,
  ReportKr,
  ReportEvent,
  ReportTeamLine,
  ActivityReportPayload,
  DailyActivityReport,
  AggregatedReport,
} from './types';
export type { IOrgReportsRepository } from './repository';
export { orgReportKeys, MAX_REPORT_DAYS } from './constants';
export {
  aggregateReports,
  groupTasksByProject,
  groupEventsByPerson,
  groupActivityByPerson,
  normalizePayload,
  periodBounds,
  shiftPeriod,
  lastReportDay,
  addDays,
  toDayKey,
  fromDayKey,
  type ReportPeriodKind,
  type TaskGroup,
  type EventGroup,
  type PersonActivity,
} from './aggregate';
export {
  eventMinutes,
  totalEventMinutes,
  previousPeriod,
  trendOf,
  dailySeries,
  sortProjectsByGain,
  sortKrsByGain,
  buildHighlights,
  type Trend,
  type DailySeries,
  type Highlights,
} from './insights';
export { useActivityReports } from './hooks';
