// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS · Portefeuille — Supabase (mig. 151, 152, 155)
// ═══════════════════════════════════════════════════════════════════
//
// Toutes les écritures passent par la RLS : les rattachements par
// `can_manage_team_project`, la santé et la création atomique par leurs RPC.
// Aucune whitelist à contourner : chaque insert nomme ses colonnes.

import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import type { ITeamPortfolioRepository } from './portfolio.repository';
import type { ProjectHealth, ProjectRole, TeamProject, TeamTaskActivity } from './types';
import type {
  CreateProjectFullInput,
  DuplicateProjectInput,
  MyFollows,
  ProjectLinks,
  ProjectUpdate,
  TrashedTask,
} from './portfolio.types';
import { mapActivity, mapProject, type ActivityRow, type ProjectRow } from './supabase.mappers';

const db = () => {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
};

export class SupabaseTeamPortfolioRepository implements ITeamPortfolioRepository {
  async getProjectLinks(orgId: string): Promise<ProjectLinks> {
    // RPC indexable (mig. 152), pas `.from(...)` : la policy de ces tables
    // appelle `can_access_team_project` par ligne (cf. mig. 113).
    const { data, error } = await db().rpc('get_my_team_project_links', { p_org: orgId });
    if (error) throw normalizeApiError(error);
    const links = (data ?? {}) as Partial<ProjectLinks>;
    return { teams: links.teams ?? [], members: links.members ?? [] };
  }

  async addProjectTeam(orgId: string, projectId: string, teamId: string): Promise<void> {
    const { error } = await db()
      .from('team_project_teams')
      .insert({ project_id: projectId, team_id: teamId, org_id: orgId });
    if (error && error.code !== '23505') throw normalizeApiError(error);
  }

  async removeProjectTeam(projectId: string, teamId: string): Promise<void> {
    const { error } = await db()
      .from('team_project_teams')
      .delete()
      .eq('project_id', projectId)
      .eq('team_id', teamId);
    if (error) throw normalizeApiError(error);
  }

  async setProjectMember(orgId: string, projectId: string, userId: string, role: ProjectRole): Promise<void> {
    const { error } = await db()
      .from('team_project_members')
      .upsert({ project_id: projectId, user_id: userId, org_id: orgId, role }, { onConflict: 'project_id,user_id' });
    if (error) throw normalizeApiError(error);
  }

  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    const { error } = await db()
      .from('team_project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (error) throw normalizeApiError(error);
  }

  async getProjectUpdates(projectId: string): Promise<ProjectUpdate[]> {
    const { data, error } = await db()
      .from('team_project_updates')
      .select('id, project_id, health, note, author_id, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw normalizeApiError(error);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      projectId: r.project_id as string,
      health: r.health as ProjectHealth,
      note: (r.note as string | null) ?? null,
      authorId: (r.author_id as string | null) ?? null,
      createdAt: r.created_at as string,
    }));
  }

  async postProjectUpdate(projectId: string, health: ProjectHealth, note: string): Promise<void> {
    const { error } = await db().rpc('post_team_project_update', {
      p_project: projectId,
      p_health: health,
      p_note: note,
    });
    if (error) throw normalizeApiError(error);
  }

  async createProjectFull(orgId: string, input: CreateProjectFullInput): Promise<TeamProject> {
    const { data, error } = await db().rpc('create_team_project_full', {
      p_org: orgId,
      p_payload: {
        name: input.name,
        color: input.color ?? 'blue',
        teamId: input.teamId ?? null,
        categoryId: input.categoryId ?? null,
        ownerId: input.ownerId ?? null,
        description: input.description ?? null,
        startDate: input.startDate ?? null,
        targetDate: input.targetDate ?? null,
        isTemplate: input.isTemplate ?? false,
        extraTeamIds: input.extraTeamIds ?? [],
        members: input.members ?? [],
        tasks: input.tasks ?? [],
      },
    });
    if (error) throw normalizeApiError(error);
    return mapProject(data as ProjectRow);
  }

  async duplicateProject(input: DuplicateProjectInput): Promise<TeamProject> {
    const { data, error } = await db().rpc('duplicate_team_project', {
      p_project: input.projectId,
      p_name: input.name,
      p_shift_days: input.shiftDays ?? 0,
      p_keep_assignees: input.keepAssignees ?? false,
      p_as_template: input.asTemplate ?? false,
    });
    if (error) throw normalizeApiError(error);
    return mapProject(data as ProjectRow);
  }

  async getTrash(orgId: string): Promise<TrashedTask[]> {
    const { data, error } = await db().rpc('get_my_team_task_trash', { p_org: orgId });
    if (error) throw normalizeApiError(error);
    return ((data ?? []) as { task_id: string; project_id: string; name: string; deleted_by: string | null; deleted_at: string }[])
      .map((r) => ({
        taskId: r.task_id,
        projectId: r.project_id,
        name: r.name,
        deletedBy: r.deleted_by,
        deletedAt: r.deleted_at,
      }));
  }

  async restoreTask(taskId: string): Promise<void> {
    const { error } = await db().rpc('restore_team_task', { p_task: taskId });
    if (error) throw normalizeApiError(error);
  }

  async getTaskActivity(taskId: string): Promise<TeamTaskActivity[]> {
    const { data, error } = await db()
      .from('team_task_activity')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw normalizeApiError(error);
    return ((data ?? []) as ActivityRow[]).map(mapActivity);
  }

  async getMyFollows(orgId: string): Promise<MyFollows> {
    const [tasks, projects] = await Promise.all([
      db().from('team_task_followers').select('task_id').eq('org_id', orgId).limit(2000),
      db().from('team_project_followers').select('project_id').eq('org_id', orgId).limit(1000),
    ]);
    if (tasks.error) throw normalizeApiError(tasks.error);
    if (projects.error) throw normalizeApiError(projects.error);
    return {
      taskIds: (tasks.data ?? []).map((r) => r.task_id as string),
      projectIds: (projects.data ?? []).map((r) => r.project_id as string),
    };
  }

  async setTaskFollow(orgId: string, taskId: string, follow: boolean): Promise<void> {
    const uid = await getCurrentUserId();
    if (!uid) throw makeApiError('not_authenticated');
    const table = db().from('team_task_followers');
    const { error } = follow
      ? await table.upsert({ task_id: taskId, user_id: uid, org_id: orgId }, { onConflict: 'task_id,user_id' })
      : await table.delete().eq('task_id', taskId).eq('user_id', uid);
    if (error) throw normalizeApiError(error);
  }

  async setProjectFollow(orgId: string, projectId: string, follow: boolean): Promise<void> {
    const uid = await getCurrentUserId();
    if (!uid) throw makeApiError('not_authenticated');
    const table = db().from('team_project_followers');
    const { error } = follow
      ? await table.upsert({ project_id: projectId, user_id: uid, org_id: orgId }, { onConflict: 'project_id,user_id' })
      : await table.delete().eq('project_id', projectId).eq('user_id', uid);
    if (error) throw normalizeApiError(error);
  }
}
