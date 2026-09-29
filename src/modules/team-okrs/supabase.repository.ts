// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS MODULE - Supabase Repository
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { warnIfTruncated } from '@/lib/pagination.warning';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { getCurrentUserId } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import { ITeamOKRsRepository } from './repository';
import {
  TeamOKR,
  TeamOKRAudience,
  TeamKeyResult,
  CreateTeamOKRInput,
  UpdateTeamOKRInput,
  UpdateTeamKRInput,
  SyncTeamKRInput,
  TrashedTeamOKR,
} from './types';

interface OkrRow {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  start_date: string | null;
  end_date: string | null;
  created_by: string;
  created_at: string;
  parent_okr_id?: string | null;
  /** Mig. 205. */
  audience?: string | null;
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
  estimated_time: number | null;
  progress_mode?: string | null;
  contributor_ids?: string[] | null;
  health?: string | null;
  health_updated_at?: string | null;
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
  estimatedTime: Number(r.estimated_time) > 0 ? Number(r.estimated_time) : 30,
  progressMode: r.progress_mode === 'tasks' ? 'tasks' : 'manual',
  contributorIds: r.contributor_ids ?? [],
  health: r.health === 'on_track' || r.health === 'at_risk' || r.health === 'off_track' ? r.health : null,
  healthUpdatedAt: r.health_updated_at ?? null,
});

/** Colonne absente (ligne d'avant la mig. 205) : on la déduit des liens. */
const toAudience = (raw: string | null | undefined, hasTeams: boolean): TeamOKRAudience =>
  raw === 'teams' || raw === 'custom' || raw === 'org' ? raw : hasTeams ? 'teams' : 'org';

export class SupabaseTeamOKRsRepository implements ITeamOKRsRepository {
  async getAll(orgId: string): Promise<TeamOKR[]> {
    if (!supabase) throw new Error('Supabase not configured');
    // M1 (audit 2026-09-23) : plus de plafond silencieux à 200 objectifs.
    const db = supabase;
    const okrRows = await fetchAllPages<OkrRow>(async (from, to) => {
      const { data, error } = await db
        .from('team_okrs')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to);
      if (error) throw normalizeApiError(error);
      return (data ?? []) as OkrRow[];
    }, 1000, 5000);
    const okrs = warnIfTruncated(okrRows, 5000, 'team_okrs');
    if (okrs.length === 0) return [];

    // Sans `.range`, PostgREST plafonne en silence à son `max-rows` (1 000 sur
    // Supabase) : une organisation à 300 OKR de 4 KR perdait des KR sans erreur.
    const krRows = await fetchAllPages<KrRow>(async (from, to) => {
      const { data, error: krErr } = await db
        .from('team_key_results')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to);
      if (krErr) throw normalizeApiError(krErr);
      return (data ?? []) as KrRow[];
    }, 1000, 50000);
    const krsByOkr = new Map<string, TeamKeyResult[]>();
    for (const kr of krRows) {
      const arr = krsByOkr.get(kr.okr_id) ?? [];
      arr.push(mapKr(kr));
      krsByOkr.set(kr.okr_id, arr);
    }

    // Rattachements d'équipes (cloisonnement) — RLS ne renvoie que les OKR
    // accessibles, donc les liens lus sont cohérents avec `okrs`.
    const { data: linkRows, error: linkErr } = await supabase
      .from('team_okr_teams')
      .select('okr_id, team_id')
      .eq('org_id', orgId);
    if (linkErr) throw normalizeApiError(linkErr);
    const teamsByOkr = new Map<string, string[]>();
    for (const l of (linkRows ?? []) as { okr_id: string; team_id: string }[]) {
      const arr = teamsByOkr.get(l.okr_id) ?? [];
      arr.push(l.team_id);
      teamsByOkr.set(l.okr_id, arr);
    }

    // Personnes nommées (mig. 205). La policy ne rend que les liens des OKR
    // que l'appelant voit : la liste d'un OKR confidentiel ne fuit pas.
    const { data: memberRows, error: memberErr } = await supabase
      .from('team_okr_members')
      .select('okr_id, user_id')
      .eq('org_id', orgId);
    if (memberErr) throw normalizeApiError(memberErr);
    const membersByOkr = new Map<string, string[]>();
    for (const m of (memberRows ?? []) as { okr_id: string; user_id: string }[]) {
      const arr = membersByOkr.get(m.okr_id) ?? [];
      arr.push(m.user_id);
      membersByOkr.set(m.okr_id, arr);
    }

    return okrs.map((o) => ({
      id: o.id,
      orgId: o.org_id,
      title: o.title,
      description: o.description ?? undefined,
      categoryId: o.category_id,
      startDate: o.start_date ?? undefined,
      endDate: o.end_date ?? undefined,
      createdBy: o.created_by,
      createdAt: o.created_at,
      teamIds: teamsByOkr.get(o.id) ?? [],
      audience: toAudience(o.audience, teamsByOkr.has(o.id)),
      memberIds: membersByOkr.get(o.id) ?? [],
      keyResults: krsByOkr.get(o.id) ?? [],
      parentOkrId: o.parent_okr_id ?? null,
    }));
  }

  async create(orgId: string, input: CreateTeamOKRInput): Promise<TeamOKR> {
    if (!supabase) throw new Error('Supabase not configured');
    const uid = await getCurrentUserId();
    if (!uid) throw makeApiError('not_authenticated');

    // Ids générés client + inserts SANS `.select()` de représentation : une
    // fois l'OKR rattaché à des équipes hors du périmètre du créateur, la
    // relecture (can_access_team_okr) échoue et PostgREST remontait
    // « new row violates row-level security » alors que l'écriture est légale
    // (bug #9 — même correctif que team_projects.createProject).
    const okrId = crypto.randomUUID();
    const teamIds = Array.from(new Set(input.teamIds ?? [])).slice(0, 20);
    const audience = input.audience ?? (teamIds.length > 0 ? 'teams' : 'org');
    const memberIds = audience === 'custom' ? Array.from(new Set(input.memberIds ?? [])).slice(0, 50) : [];
    // 🔴 L'audience est posée DÈS l'insertion : un OKR 'teams' ou 'custom'
    // n'existe jamais, même un instant, sous l'audience 'org' sans lien.
    const { error } = await supabase
      .from('team_okrs')
      .insert({
        id: okrId,
        org_id: orgId,
        created_by: uid,
        title: input.title,
        description: input.description ?? null,
        category_id: input.categoryId ?? null,
        start_date: input.startDate || null,
        end_date: input.endDate || null,
        audience,
        ...(input.parentOkrId ? { parent_okr_id: input.parentOkrId } : {}),
      });
    if (error) throw normalizeApiError(error);

    // Rattachements d'équipes (dédupliqués, cap 20).
    if (teamIds.length > 0) {
      const { error: linkErr } = await supabase
        .from('team_okr_teams')
        .insert(teamIds.map((teamId) => ({ okr_id: okrId, org_id: orgId, team_id: teamId })));
      if (linkErr) throw normalizeApiError(linkErr);
    }
    if (memberIds.length > 0) {
      const { error: memberErr } = await supabase
        .from('team_okr_members')
        .insert(memberIds.map((userId) => ({ okr_id: okrId, org_id: orgId, user_id: userId })));
      if (memberErr) throw normalizeApiError(memberErr);
    }

    const keyResults: TeamKeyResult[] = [];
    if (input.keyResults.length > 0) {
      const rows = input.keyResults.map((kr) => {
        const target = kr.targetValue > 0 ? kr.targetValue : 1;
        const current = Math.max(0, Math.min(kr.currentValue ?? 0, target));
        return {
          id: crypto.randomUUID(),
          okr_id: okrId,
          org_id: orgId,
          title: kr.title,
          current_value: current,
          target_value: target,
          unit: kr.unit ?? null,
          assignee_id: kr.assigneeId ?? null,
          weight: clampWeight(kr.weight),
          estimated_time: kr.estimatedTime && kr.estimatedTime > 0 ? Math.round(kr.estimatedTime) : 30,
          progress_mode: kr.progressMode ?? 'manual',
          contributor_ids: kr.contributorIds ?? [],
          completed: current >= target,
          completed_at: current >= target ? new Date().toISOString() : null,
        };
      });
      const { error: krErr } = await supabase.from('team_key_results').insert(rows);
      if (krErr) throw normalizeApiError(krErr);
      keyResults.push(...rows.map((r) => mapKr(r as KrRow)));
    }

    return {
      id: okrId,
      orgId,
      title: input.title,
      description: input.description || undefined,
      categoryId: input.categoryId ?? undefined,
      startDate: input.startDate || undefined,
      endDate: input.endDate || undefined,
      createdBy: uid,
      createdAt: new Date().toISOString(),
      teamIds,
      audience,
      memberIds,
      keyResults,
      parentOkrId: input.parentOkrId ?? null,
    };
  }

  async update(okrId: string, input: UpdateTeamOKRInput): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description || null;
    if (input.categoryId !== undefined) patch.category_id = input.categoryId;
    if (input.startDate !== undefined) patch.start_date = input.startDate || null;
    if (input.endDate !== undefined) patch.end_date = input.endDate || null;
    if (input.parentOkrId !== undefined) patch.parent_okr_id = input.parentOkrId;
    // 🔴 Fermer avant de toucher aux liens, ouvrir après (cf. mig. 205) :
    // passer à 'teams'/'custom' se fait dans ce premier UPDATE, repasser à
    // 'org' seulement une fois tous les liens retirés, en fin de méthode.
    if (input.audience !== undefined && input.audience !== 'org') patch.audience = input.audience;
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from('team_okrs').update(patch).eq('id', okrId);
      if (error) throw normalizeApiError(error);
    }

    // Rattachements d'équipes et personnes : on remplace l'ensemble (delete + insert).
    if (input.teamIds !== undefined || input.memberIds !== undefined) {
      const { data: okrRow, error: readErr } = await supabase
        .from('team_okrs')
        .select('org_id')
        .eq('id', okrId)
        .single();
      if (readErr) throw normalizeApiError(readErr);
      const orgId = (okrRow as { org_id: string }).org_id;

      if (input.teamIds !== undefined) {
        const { error: delErr } = await supabase.from('team_okr_teams').delete().eq('okr_id', okrId);
        if (delErr) throw normalizeApiError(delErr);

        const teamIds = Array.from(new Set(input.teamIds)).slice(0, 20);
        if (teamIds.length > 0) {
          const { error: insErr } = await supabase
            .from('team_okr_teams')
            .insert(teamIds.map((teamId) => ({ okr_id: okrId, org_id: orgId, team_id: teamId })));
          if (insErr) throw normalizeApiError(insErr);
        }
      }

      if (input.memberIds !== undefined) {
        const { error: delErr } = await supabase.from('team_okr_members').delete().eq('okr_id', okrId);
        if (delErr) throw normalizeApiError(delErr);

        const memberIds = input.audience === 'custom' ? Array.from(new Set(input.memberIds)).slice(0, 50) : [];
        if (memberIds.length > 0) {
          const { error: insErr } = await supabase
            .from('team_okr_members')
            .insert(memberIds.map((userId) => ({ okr_id: okrId, org_id: orgId, user_id: userId })));
          if (insErr) throw normalizeApiError(insErr);
        }
      }
    }

    if (input.audience === 'org') {
      const { error } = await supabase.from('team_okrs').update({ audience: 'org' }).eq('id', okrId);
      if (error) throw normalizeApiError(error);
    }
  }

  async remove(okrId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    // Corbeille (mig. 193) : la policy DELETE est désormais réservée à
    // l'admin, et un DELETE direct effacerait KR et points d'étape sans retour.
    const { error } = await supabase.rpc('trash_team_okr', { p_okr: okrId });
    if (error) throw normalizeApiError(error);
  }

  async getTrash(orgId: string): Promise<TrashedTeamOKR[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.rpc('get_team_okr_trash', { p_org: orgId });
    if (error) throw normalizeApiError(error);
    return ((data ?? []) as { id: string; title: string; deleted_at: string; deleted_by: string | null; created_by: string | null }[])
      .map((r) => ({ id: r.id, title: r.title, deletedAt: r.deleted_at, deletedBy: r.deleted_by, createdBy: r.created_by }));
  }

  async restore(okrId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.rpc('restore_team_okr', { p_okr: okrId });
    if (error) throw normalizeApiError(error);
  }

  async purge(okrId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.rpc('purge_team_okr', { p_okr: okrId });
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
    if (input.estimatedTime !== undefined) patch.estimated_time = input.estimatedTime > 0 ? Math.round(input.estimatedTime) : 30;
    if (input.progressMode !== undefined) patch.progress_mode = input.progressMode;
    if (input.contributorIds !== undefined) patch.contributor_ids = input.contributorIds;
    if (input.completed !== undefined) {
      patch.completed = input.completed;
      patch.completed_at = input.completed ? new Date().toISOString() : null;
    }
    const { error } = await supabase.from('team_key_results').update(patch).eq('id', krId);
    if (error) throw normalizeApiError(error);
  }

  async syncKeyResults(okrId: string, orgId: string, krs: SyncTeamKRInput[]): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const bounded = krs.slice(0, 10);

    // KR existants de l'OKR (pour calculer les suppressions).
    const { data: existingRows, error: readErr } = await supabase
      .from('team_key_results')
      .select('id')
      .eq('okr_id', okrId);
    if (readErr) throw normalizeApiError(readErr);
    const existingIds = new Set(((existingRows ?? []) as { id: string }[]).map((r) => r.id));
    const keptIds = new Set(bounded.filter((k) => k.id && existingIds.has(k.id)).map((k) => k.id as string));

    // Suppressions (KR retirés en édition).
    const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
    if (toDelete.length > 0) {
      const { error: delErr } = await supabase.from('team_key_results').delete().in('id', toDelete);
      if (delErr) throw normalizeApiError(delErr);
    }

    // Mises à jour + insertions.
    for (const input of bounded) {
      const target = input.targetValue > 0 ? input.targetValue : 1;
      const current = Math.max(0, Math.min(input.currentValue ?? 0, target));
      const completed = current >= target;
      const fields = {
        title: input.title,
        current_value: current,
        target_value: target,
        unit: input.unit ?? null,
        assignee_id: input.assigneeId ?? null,
        weight: clampWeight(input.weight),
        estimated_time: input.estimatedTime && input.estimatedTime > 0 ? Math.round(input.estimatedTime) : 30,
        progress_mode: input.progressMode ?? 'manual',
        contributor_ids: input.contributorIds ?? [],
        completed,
      };
      if (input.id && existingIds.has(input.id)) {
        const { error: upErr } = await supabase
          .from('team_key_results')
          .update({ ...fields, completed_at: completed ? new Date().toISOString() : null })
          .eq('id', input.id);
        if (upErr) throw normalizeApiError(upErr);
      } else {
        const { error: insErr } = await supabase.from('team_key_results').insert({
          ...fields,
          okr_id: okrId,
          org_id: orgId,
          completed_at: completed ? new Date().toISOString() : null,
        });
        if (insErr) throw normalizeApiError(insErr);
      }
    }
  }
}
