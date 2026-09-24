// ═══════════════════════════════════════════════════════════════════
// ORG-TEAMS MODULE - Supabase Repository
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { warnIfTruncated } from '@/lib/pagination.warning';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { getCurrentUserId } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import { IOrgTeamsRepository } from './repository';
import type { OrgTeam, OrgTeamMember, CreateOrgTeamInput, UpdateOrgTeamInput, DeleteOrgTeamOptions, TeamDeletionImpact } from './types';

interface TeamRow {
  id: string;
  org_id: string;
  name: string;
  color: string;
  created_by: string | null;
  created_at: string;
  description?: string | null;
}

const mapTeam = (r: TeamRow): OrgTeam => ({
  id: r.id,
  orgId: r.org_id,
  name: r.name,
  color: r.color,
  createdBy: r.created_by,
  createdAt: r.created_at,
  description: r.description ?? null,
});

export class SupabaseOrgTeamsRepository implements IOrgTeamsRepository {
  async getTeams(orgId: string): Promise<OrgTeam[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const db = supabase;
    // M1 (audit 2026-09-23) : pages enchaînées jusqu'au bout, au lieu de 200.
    const rows = await fetchAllPages<TeamRow>(async (from, to) => {
      const { data, error } = await db
        .from('org_teams')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to);
      if (error) throw normalizeApiError(error);
      return (data ?? []) as TeamRow[];
    }, 1000, 5000);
    return warnIfTruncated(rows, 5000, 'org_teams').map(mapTeam);
  }

  async getTeamMembers(orgId: string): Promise<OrgTeamMember[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const db = supabase;
    // `.limit(2000)` était au-dessus du `max-rows` de PostgREST (1 000) :
    // la réponse était tronquée à 1 000 sans que la garde ne voie rien.
    type MembershipRow = { team_id: string; org_id: string; user_id: string; is_lead: boolean | null };
    const rows = await fetchAllPages<MembershipRow>(async (from, to) => {
      const { data, error } = await db
        .from('org_team_members')
        .select('team_id, org_id, user_id, is_lead')
        .eq('org_id', orgId)
        // Ordre TOTAL (clé primaire) : sur un ordre partiel, deux pages
        // successives peuvent se recouvrir ou sauter des lignes.
        .order('team_id', { ascending: true })
        .order('user_id', { ascending: true })
        .range(from, to);
      if (error) throw normalizeApiError(error);
      return (data ?? []) as MembershipRow[];
    }, 1000, 50000);
    return warnIfTruncated(
      rows,
      50000,
      'team_members',
    ).map((r) => ({
      teamId: r.team_id,
      orgId: r.org_id,
      userId: r.user_id,
      // `?? false` et non `!`: la colonne est NOT NULL DEFAULT FALSE, mais une
      // réponse d'avant l'application de la mig. 107 la renverrait absente.
      isLead: r.is_lead ?? false,
    }));
  }

  async createTeam(orgId: string, input: CreateOrgTeamInput): Promise<OrgTeam> {
    if (!supabase) throw new Error('Supabase not configured');
    const uid = await getCurrentUserId();
    if (!uid) throw makeApiError('not_authenticated');
    // Whitelist explicite — org_id/created_by jamais depuis l'input.
    const { data, error } = await supabase
      .from('org_teams')
      .insert({
        org_id: orgId,
        created_by: uid,
        name: input.name,
        color: input.color ?? 'blue',
        ...(input.description ? { description: input.description } : {}),
      })
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    return mapTeam(data as TeamRow);
  }

  async updateTeam(teamId: string, input: UpdateOrgTeamInput): Promise<OrgTeam> {
    if (!supabase) throw new Error('Supabase not configured');
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.color !== undefined) patch.color = input.color;
    if (input.description !== undefined) patch.description = input.description || null;
    const { data, error } = await supabase
      .from('org_teams')
      .update(patch)
      .eq('id', teamId)
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    return mapTeam(data as TeamRow);
  }

  async deleteTeam(teamId: string, options?: DeleteOrgTeamOptions): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    // RPC et non `.delete()` (mig. 151) : un DELETE direct passait par
    // `ON DELETE SET NULL` et rendait les projets de l'équipe visibles de
    // TOUTE l'entreprise. Le trigger refuse désormais ce DELETE nu.
    const { error } = await supabase.rpc('delete_org_team', {
      p_team: teamId,
      p_target_team: options?.targetTeamId ?? null,
      p_make_public: options?.makePublic ?? false,
    });
    if (error) throw normalizeApiError(error);
  }

  async getTeamDeletionImpact(teamId: string): Promise<TeamDeletionImpact> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.rpc('org_team_deletion_impact', { p_team: teamId });
    if (error) throw normalizeApiError(error);
    const row = (Array.isArray(data) ? data[0] : data) as { projects?: number; okrs?: number } | null;
    return { projects: row?.projects ?? 0, okrs: row?.okrs ?? 0 };
  }

  async addTeamMember(teamId: string, orgId: string, userId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase
      .from('org_team_members')
      .insert({ team_id: teamId, org_id: orgId, user_id: userId });
    if (error) throw normalizeApiError(error);
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase
      .from('org_team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId);
    if (error) throw normalizeApiError(error);
  }

  async setTeamLead(teamId: string, userId: string, isLead: boolean): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    // Whitelist stricte : `is_lead` est la SEULE colonne modifiable de cette
    // table. Le trigger `freeze_team_membership_identity` (mig. 107) refuse de
    // toute façon un changement d'identité, mais on ne l'émet même pas.
    const { error } = await supabase
      .from('org_team_members')
      .update({ is_lead: isLead })
      .eq('team_id', teamId)
      .eq('user_id', userId);
    if (error) throw normalizeApiError(error);
  }
}
