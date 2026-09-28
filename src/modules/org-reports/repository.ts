// ═══════════════════════════════════════════════════════════════════
// ORG-REPORTS MODULE - Repository Interface
// ═══════════════════════════════════════════════════════════════════

import type { DailyActivityReport, ReportScope } from './types';

export interface IOrgReportsRepository {
  /**
   * Journées figées du périmètre entre `from` et `to` inclus ('YYYY-MM-DD').
   * La RLS (mig. 202) ne rend que ce que l'appelant a le droit de lire : un
   * périmètre interdit rend une liste vide, jamais une erreur.
   */
  getReports(orgId: string, scope: ReportScope, from: string, to: string): Promise<DailyActivityReport[]>;
}
