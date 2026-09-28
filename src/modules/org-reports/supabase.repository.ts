// ═══════════════════════════════════════════════════════════════════
// ORG-REPORTS MODULE - Supabase Repository (table `org_activity_reports`, mig. 202)
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import type { IOrgReportsRepository } from './repository';
import type { DailyActivityReport, ReportScope } from './types';
import { normalizePayload } from './aggregate';
import { MAX_REPORT_DAYS } from './constants';

export class SupabaseOrgReportsRepository implements IOrgReportsRepository {
  async getReports(orgId: string, scope: ReportScope, from: string, to: string): Promise<DailyActivityReport[]> {
    if (!supabase) throw new Error('Supabase not configured');
    let query = supabase
      .from('org_activity_reports')
      .select('day, payload')
      .eq('org_id', orgId)
      .gte('day', from)
      .lte('day', to)
      .order('day', { ascending: true })
      .limit(MAX_REPORT_DAYS);
    query = scope.kind === 'org'
      ? query.eq('scope', 'org')
      : query.eq('scope', 'team').eq('team_id', scope.teamId);
    const { data, error } = await query;
    if (error) throw normalizeApiError(error);
    return (data ?? []).map((r) => ({ day: r.day as string, payload: normalizePayload(r.payload) }));
  }
}
