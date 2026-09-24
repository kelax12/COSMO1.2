// ═══════════════════════════════════════════════════════════════════
// ORG-TEAMS MODULE - Supabase Repository
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { warnIfTruncated } from '@/lib/pagination.warning';
import { getCurrentUserId } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import { IOrgTeamsRepository } from './repository';
import { OrgTeam, OrgTeamMember, CreateOrgTeamInput, TeamDeletionImpact, DeleteTeamInput } from './types';

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
      // Tri DÉCROISSANT puis inversion : un tri croissant sous `limit` garde les
      // plus anciennes et fait disparaître l'équipe qu'on vient de créer.
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw normalizeApiError(error);
    return warnIfTruncated((data ?? []) as TeamRow[], 200, 'org_teams').reverse().map(mapTeam);
  }

  async getTeamMembers(orgId: string): Promise<OrgTeamMember[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('org_team_members')
      .select('team_id, org_id, user_id, is_lead')
      .eq('org_id', orgId)
      .limit(2000);
    if (error) throw normalizeApiError(error);
    return warnIfTruncated(
      (data ?? []) as { team_id: string; org_id: string; user_id: string; is_lead: boolean | null }[],
      2000,
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
      .insert({ org_id: orgId, created_by: uid, name: input.name, color: input.color ?? 'blue' })
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    return mapTeam(data as TeamRow);
  }

  async getDeletionImpact(teamId: string): Promise<TeamDeletionImpact> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.rpc('get_team_deletion_impact', { p_team: teamId });
    if (error) throw normalizeApiError(error);
    const row = (Array.isArray(data) ? data[0] : data) as
      | { active_projects: number; archived_projects: number; sole_okrs: number; shared_okrs: number }
      | undefined;
    return {
      activeProjects: row?.active_projects ?? 0,
      archivedProjects: row?.archived_projects ?? 0,
      soleOkrs: row?.sole_okrs ?? 0,
      sharedOkrs: row?.shared_okrs ?? 0,
    };
  }

  async deleteTeam({ teamId, targetTeamId, archiveProjects }: DeleteTeamInput): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.rpc('delete_team_with_transfer', {
      p_team: teamId,
      p_target: targetTeamId,
      p_archive_projects: archiveProjects,
    });
    if (!error) return;
    // 23503 = la clé étrangère (mig. 151) a refusé : il reste un projet ou un
    // OKR rattaché, peut-être invisible pour l'appelant. On le dit en clair
    // plutôt que « dépendances existantes ».
    if (error.code === '23503') throw makeApiError('team_has_dependents', error.message);
    throw normalizeApiError(error);
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
