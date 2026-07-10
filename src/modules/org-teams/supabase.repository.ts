// ═══════════════════════════════════════════════════════════════════
// ORG-TEAMS MODULE - Supabase Repository
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { IOrgTeamsRepository } from './repository';
import { OrgTeam, OrgTeamMember, CreateOrgTeamInput } from './types';

interface TeamRow {
  id: string;
  org_id: string;
  name: string;
  color: string;
  created_by: string | null;
  created_at: string;
}

const mapTeam = (r: TeamRow): OrgTeam => ({
  id: r.id,
  orgId: r.org_id,
  name: r.name,
  color: r.color,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

export class SupabaseOrgTeamsRepository implements IOrgTeamsRepository {
  async getTeams(orgId: string): Promise<OrgTeam[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('org_teams')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) throw normalizeApiError(error);
    return ((data ?? []) as TeamRow[]).map(mapTeam);
  }

  async getTeamMembers(orgId: string): Promise<OrgTeamMember[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('org_team_members')
      .select('team_id, org_id, user_id')
      .eq('org_id', orgId)
      .limit(2000);
    if (error) throw normalizeApiError(error);
    return ((data ?? []) as { team_id: string; org_id: string; user_id: string }[]).map((r) => ({
      teamId: r.team_id,
      orgId: r.org_id,
      userId: r.user_id,
    }));
  }

  async createTeam(orgId: string, input: CreateOrgTeamInput): Promise<OrgTeam> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error('Not authenticated');
    // Whitelist explicite — org_id/created_by jamais depuis l'input.
    const { data, error } = await supabase
      .from('org_teams')
      .insert({ org_id: orgId, created_by: uid, name: input.name, color: input.color ?? 'blue' })
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    return mapTeam(data as TeamRow);
  }

  async deleteTeam(teamId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.from('org_teams').delete().eq('id', teamId);
    if (error) throw normalizeApiError(error);
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
}
