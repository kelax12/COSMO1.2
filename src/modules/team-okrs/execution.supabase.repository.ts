// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS · Exécution — Supabase (mig. 160)
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import type { IOkrExecutionRepository } from './execution.repository';
import type {
  KRCheckin,
  KRProjectLink,
  PostKRCheckinInput,
} from './execution.types';
import type { ProjectHealth } from './execution.types';

const db = () => {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
};

export class SupabaseOkrExecutionRepository implements IOkrExecutionRepository {
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
