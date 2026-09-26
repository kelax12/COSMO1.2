// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — audience et purge d'un projet, accès Supabase (mig. 164)
//
// Équipes associées (`team_project_teams`) et purge d'un projet archivé.
// Extrait de `supabase.repository.ts`, qui reste sous 600 lignes.
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { warnIfTruncated } from '@/lib/pagination.warning';
import { getCurrentUserId } from '@/lib/auth-user';
import type { TeamProjectTeam } from './types';

const client = () => {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
};

/** Plafond : une organisation n'associe pas cinq mille équipes à ses projets. */
const PROJECT_TEAMS_LIMIT = 5000;

export async function getProjectTeams(orgId: string): Promise<TeamProjectTeam[]> {
  const { data, error } = await client()
    .from('team_project_teams')
    .select('project_id, team_id')
    .eq('org_id', orgId)
    .order('added_at', { ascending: false })
    .limit(PROJECT_TEAMS_LIMIT);
  if (error) throw normalizeApiError(error);
  const rows = (data ?? []) as { project_id: string; team_id: string }[];
  return warnIfTruncated(rows, PROJECT_TEAMS_LIMIT, 'team_project_teams')
    .map((r) => ({ projectId: r.project_id, teamId: r.team_id }));
}

export async function addProjectTeam(orgId: string, projectId: string, teamId: string): Promise<void> {
  const uid = await getCurrentUserId();
  // Whitelist explicite : `added_by` est vérifié par la policy (= auth.uid()).
  const { error } = await client()
    .from('team_project_teams')
    .insert({ org_id: orgId, project_id: projectId, team_id: teamId, added_by: uid });
  if (error) throw normalizeApiError(error);
}

export async function removeProjectTeam(projectId: string, teamId: string): Promise<void> {
  const { error } = await client()
    .from('team_project_teams')
    .delete()
    .eq('project_id', projectId)
    .eq('team_id', teamId);
  if (error) throw normalizeApiError(error);
}

export async function purgeArchivedProject(projectId: string): Promise<void> {
  const { error } = await client().rpc('purge_archived_team_project', { p_project: projectId });
  if (error) throw normalizeApiError(error);
}
