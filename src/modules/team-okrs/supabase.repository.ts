// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS MODULE - Supabase Repository
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { ITeamOKRsRepository } from './repository';
import {
  TeamOKR,
  TeamKeyResult,
  CreateTeamOKRInput,
  UpdateTeamOKRInput,
  UpdateTeamKRInput,
} from './types';

interface OkrRow {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  category: string | null;
  start_date: string | null;
  end_date: string | null;
  created_by: string;
  created_at: string;
}

interface KrRow {
  id: string;
  okr_id: string;
  org_id: string;
  title: string;
  current_value: number;
  target_value: number;
  unit: string | null;
  assignee_id: string | null;
  completed: boolean;
  completed_at: string | null;
  weight: number | null;
}

// Coefficient effectif : entier borné [1, 10], défaut 1 (rétrocompat).
const clampWeight = (w: unknown): number => {
  const n = Math.round(Number(w));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 10);
};

const mapKr = (r: KrRow): TeamKeyResult => ({
  id: r.id,
  okrId: r.okr_id,
  orgId: r.org_id,
  title: r.title,
  currentValue: Number(r.current_value),
  // Garde B17 : target_value a CHECK > 0 en DB, on reste défensif à la lecture.
  targetValue: Number(r.target_value) > 0 ? Number(r.target_value) : 1,
  unit: r.unit ?? undefined,
  assigneeId: r.assignee_id,
  completed: r.completed,
  completedAt: r.completed_at,
  weight: clampWeight(r.weight),
});

export class SupabaseTeamOKRsRepository implements ITeamOKRsRepository {
  async getAll(orgId: string): Promise<TeamOKR[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: okrRows, error } = await supabase
      .from('team_okrs')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw normalizeApiError(error);
    const okrs = (okrRows ?? []) as OkrRow[];
    if (okrs.length === 0) return [];

    const { data: krRows, error: krErr } = await supabase
      .from('team_key_results')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });
    if (krErr) throw normalizeApiError(krErr);
    const krsByOkr = new Map<string, TeamKeyResult[]>();
    for (const kr of (krRows ?? []) as KrRow[]) {
      const arr = krsByOkr.get(kr.okr_id) ?? [];
      arr.push(mapKr(kr));
      krsByOkr.set(kr.okr_id, arr);
    }

    return okrs.map((o) => ({
      id: o.id,
      orgId: o.org_id,
      title: o.title,
      description: o.description ?? undefined,
      category: o.category ?? undefined,
      startDate: o.start_date ?? undefined,
      endDate: o.end_date ?? undefined,
      createdBy: o.created_by,
      createdAt: o.created_at,
      keyResults: krsByOkr.get(o.id) ?? [],
    }));
  }

  async create(orgId: string, input: CreateTeamOKRInput): Promise<TeamOKR> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error('Not authenticated');

    const { data: okrRow, error } = await supabase
      .from('team_okrs')
      .insert({
        org_id: orgId,
        created_by: uid,
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? null,
        start_date: input.startDate || null,
        end_date: input.endDate || null,
      })
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    const okr = okrRow as OkrRow;

    let keyResults: TeamKeyResult[] = [];
    if (input.keyResults.length > 0) {
      const { data: krRows, error: krErr } = await supabase
        .from('team_key_results')
        .insert(
          input.keyResults.map((kr) => ({
            okr_id: okr.id,
            org_id: orgId,
            title: kr.title,
            current_value: 0,
            target_value: kr.targetValue > 0 ? kr.targetValue : 1,
            unit: kr.unit ?? null,
            assignee_id: kr.assigneeId ?? null,
            weight: clampWeight(kr.weight),
          })),
        )
        .select('*');
      if (krErr) throw normalizeApiError(krErr);
      keyResults = ((krRows ?? []) as KrRow[]).map(mapKr);
    }

    return {
      id: okr.id,
      orgId: okr.org_id,
      title: okr.title,
      description: okr.description ?? undefined,
      category: okr.category ?? undefined,
      startDate: okr.start_date ?? undefined,
      endDate: okr.end_date ?? undefined,
      createdBy: okr.created_by,
      createdAt: okr.created_at,
      keyResults,
    };
  }

  async update(okrId: string, input: UpdateTeamOKRInput): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description || null;
    if (input.category !== undefined) patch.category = input.category || null;
    if (input.startDate !== undefined) patch.start_date = input.startDate || null;
    if (input.endDate !== undefined) patch.end_date = input.endDate || null;
    const { error } = await supabase.from('team_okrs').update(patch).eq('id', okrId);
    if (error) throw normalizeApiError(error);
  }

  async remove(okrId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.from('team_okrs').delete().eq('id', okrId);
    if (error) throw normalizeApiError(error);
  }

  async updateKeyResult(krId: string, input: UpdateTeamKRInput): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.currentValue !== undefined) patch.current_value = input.currentValue;
    if (input.targetValue !== undefined && input.targetValue > 0) patch.target_value = input.targetValue;
    if (input.unit !== undefined) patch.unit = input.unit || null;
    if (input.assigneeId !== undefined) patch.assignee_id = input.assigneeId;
    if (input.weight !== undefined) patch.weight = clampWeight(input.weight);
    if (input.completed !== undefined) {
      patch.completed = input.completed;
      patch.completed_at = input.completed ? new Date().toISOString() : null;
    }
    const { error } = await supabase.from('team_key_results').update(patch).eq('id', krId);
    if (error) throw normalizeApiError(error);
  }
}
