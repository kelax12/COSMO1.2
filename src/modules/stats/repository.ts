// ═══════════════════════════════════════════════════════════════════
// STATS MODULE - Interface du repository (démo : local.repository.ts)
// ═══════════════════════════════════════════════════════════════════
//
// Agrégats « temps investi » consommés par StatisticsPage.
// - Prod : SupabaseStatsRepository → RPC SQL `get_work_time_stats`
//   (le calcul reste dans Postgres, le client ne reçoit que les totaux).
// - Démo : LocalStatsRepository → même calcul que l'historique client
//   (calculateWorkTimeForPeriod) sur les données localStorage.
// Les deux implémentations DOIVENT rester équivalentes : la RPC réplique
// la sémantique de calculateWorkTimeForPeriod (dates locales inclusives).

import type { WorkTimeBucket, WorkTimeRange } from './types';

export interface IStatsRepository {
  /** Un bucket par plage, dans l'ordre des plages fournies. */
  getWorkTimeStats(ranges: WorkTimeRange[]): Promise<WorkTimeBucket[]>;
}
