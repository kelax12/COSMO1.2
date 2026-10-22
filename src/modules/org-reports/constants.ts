// ═══════════════════════════════════════════════════════════════════
// ORG-REPORTS MODULE - Clés React Query
// ═══════════════════════════════════════════════════════════════════

import type { ReportScope } from './types';

export const orgReportKeys = {
  all: ['org-reports'] as const,
  range: (orgId: string, scope: ReportScope, from: string, to: string) =>
    [...orgReportKeys.all, orgId, scope.kind === 'org' ? 'org' : scope.teamId, from, to] as const,
};

/** Une période longue reste bornée : un an de journées au plus. */
export const MAX_REPORT_DAYS = 366;
