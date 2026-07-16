// ═══════════════════════════════════════════════════════════════════
// STATS MODULE - Supabase Repository Implementation
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import type { IStatsRepository } from './repository';
import type { WorkTimeBucket, WorkTimeRange } from './types';

// Aligné sur la garde `ord <= 32` de la RPC (migration 074).
const MAX_RANGES = 32;

export class SupabaseStatsRepository implements IStatsRepository {
  async getWorkTimeStats(ranges: WorkTimeRange[]): Promise<WorkTimeBucket[]> {
    if (ranges.length === 0) return [];
    // La RPC calcule en dates locales : on lui passe le fuseau du navigateur
    // pour répliquer parseLocalDate() (sinon un event à 00h30 locale
    // basculerait sur le jour UTC précédent).
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const { data, error } = await supabase.rpc('get_work_time_stats', {
      p_ranges: ranges.slice(0, MAX_RANGES),
      p_tz: tz,
    });
    if (error) throw normalizeApiError(error);
    return (data ?? []) as WorkTimeBucket[];
  }
}
