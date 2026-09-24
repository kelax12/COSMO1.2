// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS · Exécution — Supabase (mig. 160)
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import type { IOkrExecutionRepository } from './execution.repository';
import type {
  CreateOkrCycleInput,
  KRCheckin,
  KRProjectLink,
  OkrCycle,
  PostKRCheckinInput,
} from './execution.types';
import type { ProjectHealth } from './execution.types';

const db = () => {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
};

interface CycleRow {
  id: string;
  org_id: string;
  name: string;
  start_date: string;
  end_date: string;
}

const mapCycle = (r: CycleRow): OkrCycle => ({
  id: r.id,
  orgId: r.org_id,
  name: r.name,
  startDate: r.start_date,
  endDate: r.end_date,
});

export class SupabaseOkrExecutionRepository implements IOkrExecutionRepository {
  async getCycles(orgId: string): Promise<OkrCycle[]> {
    const { data, error } = await db()
      .from('okr_cycles')
      .select('id, org_id, name, start_date, end_date')
      .eq('org_id', orgId)
      .order('start_date', { ascending: false })
      .limit(200);
    if (error) throw normalizeApiError(error);
    return ((data ?? []) as CycleRow[]).map(mapCycle);
  }

  async createCycle(orgId: string, input: CreateOkrCycleInput): Promise<OkrCycle> {
    const uid = await getCurrentUserId();
    if (!uid) throw makeApiError('not_authenticated');
    const { data, error } = await db()
      .from('okr_cycles')
      .insert({ org_id: orgId, created_by: uid, name: input.name, start_date: input.startDate, end_date: input.endDate })
      .select('id, org_id, name, start_date, end_date')
      .single();
    if (error) throw normalizeApiError(error);
    return mapCycle(data as CycleRow);
  }

  async deleteCycle(cycleId: string): Promise<void> {
    const { error } = await db().from('okr_cycles').delete().eq('id', cycleId);
    if (error) throw normalizeApiError(error);
  }

  async getKRProjects(orgId: string): Promise<KRProjectLink[]> {
    // RPC indexable (mig. 160) : un lien n'est rendu que si le projet ET
    // l'objectif sont visibles.
    const { data, error } = await db().rpc('get_my_team_kr_projects', { p_org: orgId });
    if (error) throw normalizeApiError(error);
    return ((data ?? []) as { kr_id: string; project_id: string }[]).map((r) => ({
      krId: r.kr_id,
      projectId: r.project_id,
    }));
  }

  async setKRProjects(orgId: string, krId: string, projectIds: string[]): Promise<void> {
    const { error: delErr } = await db().from('team_kr_projects').delete().eq('kr_id', krId);
    if (delErr) throw normalizeApiError(delErr);
    const unique = [...new Set(projectIds)].slice(0, 20);
    if (unique.length === 0) return;
    const { error } = await db()
      .from('team_kr_projects')
      .insert(unique.map((projectId) => ({ kr_id: krId, project_id: projectId, org_id: orgId })));
    if (error) throw normalizeApiError(error);
  }

  async getCheckins(krId: string): Promise<KRCheckin[]> {
    const { data, error } = await db()
      .from('team_kr_checkins')
      .select('id, kr_id, value, status, note, author_id, created_at')
      .eq('kr_id', krId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw normalizeApiError(error);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      krId: r.kr_id as string,
      value: Number(r.value),
      status: r.status as ProjectHealth,
      note: (r.note as string | null) ?? null,
      authorId: (r.author_id as string | null) ?? null,
      createdAt: r.created_at as string,
    }));
  }

  async postCheckin(input: PostKRCheckinInput): Promise<void> {
    const { error } = await db().rpc('post_kr_checkin', {
      p_kr: input.krId,
      p_value: input.value,
      p_status: input.status,
      p_note: input.note ?? null,
    });
    if (error) throw normalizeApiError(error);
  }
}
