// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS MODULE - Supabase Repository
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/auth-user';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { warnIfTruncated } from '@/lib/pagination.warning';
import { ITeamProjectsRepository } from './repository';
import {
  TeamProject,
  CreateTeamProjectInput,
  UpdateTeamProjectInput,
  TeamTask,
  CreateTeamTaskInput,
  UpdateTeamTaskInput,
  TeamTaskFilters,
  TeamTaskComment,
  CreateTeamTaskCommentInput,
  TeamSubtask,
  CreateTeamSubtaskInput,
  UpdateTeamSubtaskInput,
  TeamLabel,
  CreateTeamLabelInput,
  UpdateTeamLabelInput,
  TeamTaskLabel,
  TeamTaskActivity,
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
  status: string | null;
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

interface CommentRow {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  mentions: string[] | null;
  created_at: string;
}

const mapComment = (r: CommentRow): TeamTaskComment => ({
  id: r.id,
  taskId: r.task_id,
  authorId: r.author_id,
  body: r.body,
  mentions: r.mentions ?? [],
  createdAt: r.created_at,
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
  // Repli sur `completed` : une ligne lue depuis un cache antérieur à la
  // mig. 091 n'a pas encore de `status`, et un `undefined` casserait le
  // groupement du kanban.
  status: (r.status as TeamTask['status'] | null) ?? (r.completed ? 'done' : 'todo'),
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
    const uid = await getCurrentUserId();
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
    // Reco #20 : la limite 1000 était silencieuse — au-delà, on prévient
    // (console dev + toast une fois par session) au lieu de tronquer sans bruit.
    return warnIfTruncated((data ?? []) as TaskRow[], 1000, 'team_tasks').map(mapTask);
  }

  async createTask(orgId: string, input: CreateTeamTaskInput): Promise<TeamTask> {
    if (!supabase) throw new Error('Supabase not configured');
    const uid = await getCurrentUserId();
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
        status: input.status ?? 'todo',
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
    // `status` et `completed` sont synchronisés par le trigger de la mig. 091.
    // On n'envoie donc JAMAIS les deux dans le même patch : le trigger traite
    // `status` en priorité, et un `completed` contradictoire serait écrasé
    // sans erreur — un bug silencieux plutôt qu'un échec visible.
    if (input.status !== undefined) {
      patch.status = input.status;
    } else if (input.completed !== undefined) {
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

  // ─── Commentaires (mig. 082) ───────────────────────────────────────

  async getComments(taskId: string): Promise<TeamTaskComment[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('team_task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) throw normalizeApiError(error);
    return ((data ?? []) as CommentRow[]).map(mapComment);
  }

  async addComment(input: CreateTeamTaskCommentInput): Promise<TeamTaskComment> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user?.id;
    if (!uid) throw new Error('Not authenticated');
    // Whitelist explicite (anti mass-assignment V1) ; author_id = self,
    // vérifié aussi par la policy WITH CHECK.
    const { data, error } = await supabase
      .from('team_task_comments')
      .insert({
        task_id: input.taskId,
        author_id: uid,
        body: input.body,
        mentions: input.mentions ?? [],
      })
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    return mapComment(data as CommentRow);
  }

  async deleteComment(commentId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.from('team_task_comments').delete().eq('id', commentId);
    if (error) throw normalizeApiError(error);
  }

  // ─── Sous-tâches (mig. 092) ──────────────────────────────────────

  async getSubtasks(taskId: string): Promise<TeamSubtask[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('team_task_subtasks')
      .select('*')
      .eq('task_id', taskId)
      // Même ordre que l'index (task_id, position) — pas de tri en mémoire.
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw normalizeApiError(error);
    return (data as SubtaskRow[]).map(mapSubtask);
  }

  async createSubtask(input: CreateTeamSubtaskInput): Promise<TeamSubtask> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error('Non authentifié');
    const { data, error } = await supabase
      .from('team_task_subtasks')
      .insert({
        task_id: input.taskId,
        title: input.title,
        position: input.position ?? 0,
        // La policy INSERT exige created_by = auth.uid() : l'omettre serait un 403.
        created_by: uid,
      })
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    return mapSubtask(data as SubtaskRow);
  }

  async updateSubtask(subtaskId: string, input: UpdateTeamSubtaskInput): Promise<TeamSubtask> {
    if (!supabase) throw new Error('Supabase not configured');
    // Whitelist champ-par-champ — jamais task_id ni created_by (mass-assignment).
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.completed !== undefined) patch.completed = input.completed;
    if (input.position !== undefined) patch.position = input.position;
    const { data, error } = await supabase
      .from('team_task_subtasks')
      .update(patch)
      .eq('id', subtaskId)
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    return mapSubtask(data as SubtaskRow);
  }

  async deleteSubtask(subtaskId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.from('team_task_subtasks').delete().eq('id', subtaskId);
    if (error) throw normalizeApiError(error);
  }

  // ─── Labels (mig. 093) ───────────────────────────────────────────

  async getLabels(orgId: string): Promise<TeamLabel[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('team_labels')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true });
    if (error) throw normalizeApiError(error);
    return (data as LabelRow[]).map(mapLabel);
  }

  async createLabel(orgId: string, input: CreateTeamLabelInput): Promise<TeamLabel> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error('Non authentifié');
    const { data, error } = await supabase
      .from('team_labels')
      .insert({
        org_id: orgId,
        name: input.name,
        color: input.color ?? '#6366f1',
        // La policy INSERT exige created_by = auth.uid().
        created_by: uid,
      })
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    return mapLabel(data as LabelRow);
  }

  async updateLabel(labelId: string, input: UpdateTeamLabelInput): Promise<TeamLabel> {
    if (!supabase) throw new Error('Supabase not configured');
    // Whitelist — jamais org_id ni created_by (mass-assignment).
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.color !== undefined) patch.color = input.color;
    const { data, error } = await supabase
      .from('team_labels')
      .update(patch)
      .eq('id', labelId)
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    return mapLabel(data as LabelRow);
  }

  async deleteLabel(labelId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.from('team_labels').delete().eq('id', labelId);
    if (error) throw normalizeApiError(error);
  }

  /**
   * Une seule requête pour toute l'organisation plutôt qu'une par tâche : les
   * chips de label s'affichent sur CHAQUE ligne de liste, une requête par tâche
   * ferait exploser le nombre d'aller-retours sur un écran de 50 tâches.
   *
   * Le filtre passe par les labels de l'org (la jonction ne porte pas d'org_id) ;
   * la RLS de `team_task_labels` reste la frontière réelle.
   */
  async getTaskLabels(orgId: string): Promise<TeamTaskLabel[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const labels = await this.getLabels(orgId);
    if (labels.length === 0) return [];
    const { data, error } = await supabase
      .from('team_task_labels')
      .select('task_id, label_id')
      .in('label_id', labels.map((l) => l.id));
    if (error) throw normalizeApiError(error);
    return (data as { task_id: string; label_id: string }[]).map((r) => ({
      taskId: r.task_id,
      labelId: r.label_id,
    }));
  }

  async addTaskLabel(taskId: string, labelId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase
      .from('team_task_labels')
      .insert({ task_id: taskId, label_id: labelId });
    if (error) throw normalizeApiError(error);
  }

  async removeTaskLabel(taskId: string, labelId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase
      .from('team_task_labels')
      .delete()
      .eq('task_id', taskId)
      .eq('label_id', labelId);
    if (error) throw normalizeApiError(error);
  }

  // ─── Historique (mig. 094) — lecture seule ───────────────────────

  async getTaskActivity(taskId: string): Promise<TeamTaskActivity[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('team_task_activity')
      .select('*')
      .eq('task_id', taskId)
      // Même ordre que l'index (task_id, created_at DESC).
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw normalizeApiError(error);
    return (data as ActivityRow[]).map(mapActivity);
  }
}

// ─── Sous-tâches (mig. 092) ──────────────────────────────────────────

interface SubtaskRow {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  position: number;
  created_by: string | null;
  created_at: string;
}

export const mapSubtask = (r: SubtaskRow): TeamSubtask => ({
  id: r.id,
  taskId: r.task_id,
  title: r.title,
  completed: r.completed,
  position: r.position,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

// ─── Labels & historique : lignes brutes ─────────────────────────────

interface LabelRow {
  id: string;
  org_id: string;
  name: string;
  color: string;
  created_by: string | null;
  created_at: string;
}

export const mapLabel = (r: LabelRow): TeamLabel => ({
  id: r.id,
  orgId: r.org_id,
  name: r.name,
  color: r.color,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

interface ActivityRow {
  id: string;
  task_id: string;
  org_id: string;
  actor_id: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export const mapActivity = (r: ActivityRow): TeamTaskActivity => ({
  id: r.id,
  taskId: r.task_id,
  orgId: r.org_id,
  actorId: r.actor_id,
  field: r.field as TeamTaskActivity['field'],
  oldValue: r.old_value,
  newValue: r.new_value,
  createdAt: r.created_at,
});
