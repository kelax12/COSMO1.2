// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS MODULE - Supabase Repository
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { ITeamProjectsRepository } from './repository';
import {
  TeamProject,
  CreateTeamProjectInput,
  UpdateTeamProjectInput,
  TeamTask,
  CreateTeamTaskInput,
  UpdateTeamTaskInput,
  TeamTaskFilters,
} from './types';

interface ProjectRow {
  id: string;
  org_id: string;
  name: string;
  color: string;
  created_by: string;
  archived_at: string | null;
  created_at: string;
  team_id: string | null;
}

interface TaskRow {
  id: string;
  org_id: string;
  project_id: string;
  name: string;
  description: string | null;
  priority: number;
  deadline: string | null;
  estimated_time: number | null;
  assignee_ids: string[] | null;
  created_by: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

const mapProject = (r: ProjectRow): TeamProject => ({
  id: r.id,
  orgId: r.org_id,
  name: r.name,
  color: r.color,
  createdBy: r.created_by,
  archivedAt: r.archived_at,
  createdAt: r.created_at,
  teamId: r.team_id,
});

const mapTask = (r: TaskRow): TeamTask => ({
  id: r.id,
  orgId: r.org_id,
  projectId: r.project_id,
  name: r.name,
  description: r.description ?? undefined,
  priority: r.priority,
  deadline: r.deadline ?? '',
  estimatedTime: r.estimated_time ?? undefined,
  assigneeIds: r.assignee_ids ?? [],
  createdBy: r.created_by,
  completed: r.completed,
  completedAt: r.completed_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class SupabaseTeamProjectsRepository implements ITeamProjectsRepository {
  // ─── Projets ───────────────────────────────────────────────────────

  async getProjects(orgId: string): Promise<TeamProject[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('team_projects')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) throw normalizeApiError(error);
    return ((data ?? []) as ProjectRow[]).map(mapProject);
  }

  async createProject(orgId: string, input: CreateTeamProjectInput): Promise<TeamProject> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error('Not authenticated');
    // Whitelist explicite — org_id/created_by injectés serveur-side, jamais input.
    // Id généré client : pas de `.select()` de représentation après l'insert —
    // un manager non-admin rattachant le projet à une équipe hors de son
    // périmètre ne peut pas RELIRE la ligne (can_access_team_project) et
    // PostgREST remontait « new row violates row-level security » (bug #9).
    const id = crypto.randomUUID();
    const { error } = await supabase
      .from('team_projects')
      .insert({
        id,
        org_id: orgId,
        created_by: uid,
        name: input.name,
        color: input.color ?? 'blue',
        team_id: input.teamId ?? null,
      });
    if (error) throw normalizeApiError(error);
    return {
      id,
      orgId,
      name: input.name,
      color: input.color ?? 'blue',
      createdBy: uid,
      archivedAt: null,
      createdAt: new Date().toISOString(),
      teamId: input.teamId ?? null,
    };
  }

  async updateProject(projectId: string, input: UpdateTeamProjectInput): Promise<TeamProject> {
    if (!supabase) throw new Error('Supabase not configured');
    // Whitelist explicite — jamais org_id/created_by (mass-assignment V1).
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.color !== undefined) patch.color = input.color;
    if (input.teamId !== undefined) patch.team_id = input.teamId;
    if (input.archived !== undefined) patch.archived_at = input.archived ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .from('team_projects')
      .update(patch)
      .eq('id', projectId)
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    return mapProject(data as ProjectRow);
  }

  async archiveProject(projectId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase
      .from('team_projects')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', projectId);
    if (error) throw normalizeApiError(error);
  }

  // ─── Tâches ────────────────────────────────────────────────────────

  async getTasks(orgId: string, filters?: TeamTaskFilters): Promise<TeamTask[]> {
    if (!supabase) throw new Error('Supabase not configured');
    let query = supabase.from('team_tasks').select('*').eq('org_id', orgId);
    if (filters?.projectId) query = query.eq('project_id', filters.projectId);
    if (filters?.assigneeId) query = query.contains('assignee_ids', [filters.assigneeId]);
    if (filters?.completed !== undefined) query = query.eq('completed', filters.completed);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(1000);
    if (error) throw normalizeApiError(error);
    return ((data ?? []) as TaskRow[]).map(mapTask);
  }

  async createTask(orgId: string, input: CreateTeamTaskInput): Promise<TeamTask> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('team_tasks')
      .insert({
        org_id: orgId,
        created_by: uid,
        project_id: input.projectId,
        name: input.name,
        description: input.description ?? null,
        priority: input.priority ?? 3,
        deadline: input.deadline || null,
        estimated_time: input.estimatedTime ?? null,
        assignee_ids: input.assigneeIds ?? [],
      })
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    return mapTask(data as TaskRow);
  }

  async updateTask(taskId: string, input: UpdateTeamTaskInput): Promise<TeamTask> {
    if (!supabase) throw new Error('Supabase not configured');
    // Whitelist champ-par-champ — jamais org_id/created_by (mass-assignment V1).
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description || null;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.deadline !== undefined) patch.deadline = input.deadline || null;
    if (input.estimatedTime !== undefined) patch.estimated_time = input.estimatedTime;
    if (input.assigneeIds !== undefined) patch.assignee_ids = input.assigneeIds;
    if (input.projectId !== undefined) patch.project_id = input.projectId;
    if (input.completed !== undefined) {
      patch.completed = input.completed;
      patch.completed_at = input.completed ? new Date().toISOString() : null;
    }
    const { data, error } = await supabase
      .from('team_tasks')
      .update(patch)
      .eq('id', taskId)
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    return mapTask(data as TaskRow);
  }

  async deleteTask(taskId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.from('team_tasks').delete().eq('id', taskId);
    if (error) throw normalizeApiError(error);
  }
}
