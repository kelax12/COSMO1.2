// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS MODULE - Supabase Repository
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import { warnIfTruncated } from '@/lib/pagination.warning';
import { TEAM_TASKS_READ_LIMIT, TEAM_PROJECTS_PAGE, TEAM_PROJECTS_READ_LIMIT } from './constants';
import type { RestoreCommentOptions } from './repository';
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
  TeamTaskActivity,
  TeamTaskDependency,
  TeamTrashedTask,
  DraftProjectTask,
  DraftProjectMilestone,
  TeamProjectMilestone,
  CreateTeamProjectMilestoneInput,
  UpdateTeamProjectMilestoneInput,
  TeamProjectDependency,
  TeamProjectTeam,
} from './types';
import * as portfolio from './supabase.portfolio';
import * as audience from './audience.repository';
import {
  mapProject,
  mapComment,
  mapTask,
  mapSubtask,
  mapActivity,
  type ProjectRow,
  type TaskRow,
  type CommentRow,
  type SubtaskRow,
  type ActivityRow,
} from './supabase.mappers';

export class SupabaseTeamProjectsRepository implements ITeamProjectsRepository {
  // ─── Projets ───────────────────────────────────────────────────────

  async getProjects(orgId: string): Promise<TeamProject[]> {
    if (!supabase) throw new Error('Supabase not configured');
    // ⚡ Lecture via la RPC `get_my_team_projects()` et NON `.from(...)` —
    // correctif du finding §2 de SCALABILITY.md (mig. 113).
    //
    // La policy `team_projects_select` filtre par `can_access_team_project(id)`,
    // une fonction appelée SUR UNE COLONNE : aucun index ne peut la servir, donc
    // Seq Scan de toute la table + une CTE récursive (`get_subtree`) évaluée
    // PAR LIGNE. Mesuré en prod : ≈ 60× le coût par ligne du prédicat de `tasks`.
    //
    // La RPC exprime le même ensemble en trois branches indexables et n'évalue
    // le sous-arbre managérial qu'UNE fois par organisation. Les policies restent
    // en place sur la table (défense en profondeur), et `p_org` est un filtre :
    // le périmètre vient de `auth.uid()` seul.
    // Tri DÉCROISSANT puis inversion : avec `limit`, un tri croissant garde les
    // lignes les PLUS ANCIENNES et fait disparaître les derniers projets créés
    // dès qu'on passe le plafond. L'affichage reste chronologique.
    //
    // Lecture PAGINÉE (audit du 2026-09-24, « entreprise avec 500 projets ») :
    // un plafond unique de 200 masquait le reste du portefeuille. Des pages de
    // 500 jusqu'à la dernière, bornées à `TEAM_PROJECTS_READ_LIMIT` pour qu'une
    // base anormale ne fasse pas tourner la boucle sans fin.
    const rows: ProjectRow[] = [];
    for (let from = 0; from < TEAM_PROJECTS_READ_LIMIT; from += TEAM_PROJECTS_PAGE) {
      const { data, error } = await supabase
        .rpc('get_my_team_projects', { p_org: orgId })
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + TEAM_PROJECTS_PAGE - 1);
      if (error) throw normalizeApiError(error);
      const page = (data ?? []) as unknown as ProjectRow[];
      rows.push(...page);
      if (page.length < TEAM_PROJECTS_PAGE) break;
    }
    return warnIfTruncated(rows, TEAM_PROJECTS_READ_LIMIT, 'team_projects').reverse().map(mapProject);
  }

  async createProject(orgId: string, input: CreateTeamProjectInput): Promise<TeamProject> {
    if (!supabase) throw new Error('Supabase not configured');
    const uid = await getCurrentUserId();
    if (!uid) throw makeApiError('not_authenticated');
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
        category_id: input.categoryId ?? null,
        // Mig. 153 — n'envoie que ce qui est RENSEIGNÉ : la création rapide
        // (« + projet » depuis une tâche) ne doit pas dépendre de colonnes
        // qu'elle n'utilise pas.
        ...(input.description ? { description: input.description } : {}),
        ...(input.ownerId ? { owner_id: input.ownerId } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.startDate ? { start_date: input.startDate } : {}),
        ...(input.dueDate ? { due_date: input.dueDate } : {}),
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
      categoryId: input.categoryId ?? null,
      description: input.description ?? null,
      ownerId: input.ownerId ?? null,
      status: input.status ?? 'active',
      startDate: input.startDate ?? null,
      dueDate: input.dueDate ?? null,
      isTemplate: false,
      templatePayload: null,
    };
  }

  createProjectWithTasks(
    orgId: string,
    input: CreateTeamProjectInput,
    tasks?: DraftProjectTask[],
    milestones?: DraftProjectMilestone[],
  ): Promise<string> {
    return portfolio.createProjectWithTasks(orgId, input, tasks, milestones);
  }

  // ─── Jalons & dépendances entre projets (mig. 153) ─────────────────
  getMilestones(orgId: string): Promise<TeamProjectMilestone[]> { return portfolio.getMilestones(orgId); }
  createMilestone(orgId: string, input: CreateTeamProjectMilestoneInput): Promise<void> { return portfolio.createMilestone(orgId, input); }
  updateMilestone(id: string, input: UpdateTeamProjectMilestoneInput): Promise<void> { return portfolio.updateMilestone(id, input); }
  deleteMilestone(id: string): Promise<void> { return portfolio.deleteMilestone(id); }
  getProjectDependencies(orgId: string): Promise<TeamProjectDependency[]> { return portfolio.getProjectDependencies(orgId); }
  addProjectDependency(projectId: string, dependsOnId: string, orgId: string): Promise<void> { return portfolio.addProjectDependency(projectId, dependsOnId, orgId); }
  removeProjectDependency(projectId: string, dependsOnId: string): Promise<void> { return portfolio.removeProjectDependency(projectId, dependsOnId); }

  // Équipes associées et purge (mig. 164).
  getProjectTeams(orgId: string): Promise<TeamProjectTeam[]> { return audience.getProjectTeams(orgId); }
  addProjectTeam(orgId: string, projectId: string, teamId: string): Promise<void> { return audience.addProjectTeam(orgId, projectId, teamId); }
  removeProjectTeam(projectId: string, teamId: string): Promise<void> { return audience.removeProjectTeam(projectId, teamId); }
  purgeArchivedProject(projectId: string): Promise<void> { return audience.purgeArchivedProject(projectId); }

  async updateProject(projectId: string, input: UpdateTeamProjectInput): Promise<TeamProject> {
    if (!supabase) throw new Error('Supabase not configured');
    // Whitelist explicite — jamais org_id/created_by (mass-assignment V1).
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.color !== undefined) patch.color = input.color;
    if (input.teamId !== undefined) patch.team_id = input.teamId;
    if (input.categoryId !== undefined) patch.category_id = input.categoryId;
    if (input.archived !== undefined) patch.archived_at = input.archived ? new Date().toISOString() : null;
    if (input.description !== undefined) patch.description = input.description || null;
    if (input.ownerId !== undefined) patch.owner_id = input.ownerId;
    if (input.status !== undefined) patch.status = input.status;
    if (input.startDate !== undefined) patch.start_date = input.startDate || null;
    if (input.dueDate !== undefined) patch.due_date = input.dueDate || null;
    const { data, error } = await supabase
      .from('team_projects')
      .update(patch)
      .eq('id', projectId)
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    return mapProject(data as ProjectRow);
  }

  // ─── Tâches ────────────────────────────────────────────────────────

  async getTasks(orgId: string, filters?: TeamTaskFilters): Promise<TeamTask[]> {
    if (!supabase) throw new Error('Supabase not configured');
    // ⚡ Même correctif que `getProjects` (mig. 113) : la policy `team_tasks_select`
    // filtre par `can_access_team_project(project_id)`, non indexable. Les filtres
    // applicatifs restent côté PostgREST — ils s'appliquent au résultat d'une RPC
    // `SETOF` exactement comme à une table.
    // Aucun identifiant demandé : rien à lire, aucune requête.
    if (filters?.ids && filters.ids.length === 0) return [];
    let query = supabase.rpc('get_my_team_tasks', { p_org: orgId }).select('*');
    if (filters?.projectId) query = query.eq('project_id', filters.projectId);
    if (filters?.assigneeId) query = query.contains('assignee_ids', [filters.assigneeId]);
    if (filters?.completed !== undefined) query = query.eq('completed', filters.completed);
    // Valeur entre guillemets : un horodatage ISO porte des `:` et des `.`, que
    // la grammaire de `or=()` de PostgREST ne doit pas avoir à deviner.
    if (filters?.openOrCompletedSince) {
      query = query.or(`completed.eq.false,completed_at.gte."${filters.openOrCompletedSince}"`);
    }
    if (filters?.ids) query = query.in('id', filters.ids);
    if (filters?.createdBy) query = query.eq('created_by', filters.createdBy);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.deadlineFrom) query = query.gte('deadline', filters.deadlineFrom);
    if (filters?.createdSince) query = query.gte('created_at', filters.createdSince);
    // `%`, `_` et `\` sont des jokers d'ILIKE : échappés, ils cherchent
    // littéralement ce qu'on a tapé.
    if (filters?.search) query = query.ilike('name', `%${filters.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const limit = Math.min(filters?.limit ?? TEAM_TASKS_READ_LIMIT, TEAM_TASKS_READ_LIMIT);
    const ordered = filters?.orderBy === 'deadline'
      ? query.order('deadline', { ascending: true })
      : query.order('created_at', { ascending: false });
    const { data, error } = await ordered.limit(limit);
    if (error) throw normalizeApiError(error);
    // Reco #20 : la limite 1000 était silencieuse — au-delà, on prévient
    // (console dev + toast une fois par session) au lieu de tronquer sans bruit.
    // Une lecture à plafond propre (« les 20 prochaines échéances ») est
    // tronquée PAR CONSTRUCTION : elle ne doit pas déclencher l'avertissement.
    const rows = (data ?? []) as unknown as TaskRow[];
    return (filters?.limit ? rows : warnIfTruncated(rows, TEAM_TASKS_READ_LIMIT, 'team_tasks')).map(mapTask);
  }

  async createTask(orgId: string, input: CreateTeamTaskInput): Promise<TeamTask> {
    if (!supabase) throw new Error('Supabase not configured');
    const uid = await getCurrentUserId();
    if (!uid) throw makeApiError('not_authenticated');
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
        // N'envoie la colonne que si elle est renseignée (mig. 153).
        ...(input.startDate ? { start_date: input.startDate } : {}),
        estimated_time: input.estimatedTime ?? null,
        assignee_ids: input.assigneeIds ?? [],
        status: input.status ?? 'todo',
        category_id: input.categoryId ?? null,
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
    if (input.startDate !== undefined) patch.start_date = input.startDate || null;
    if (input.estimatedTime !== undefined) patch.estimated_time = input.estimatedTime;
    if (input.assigneeIds !== undefined) patch.assignee_ids = input.assigneeIds;
    if (input.projectId !== undefined) patch.project_id = input.projectId;
    if (input.categoryId !== undefined) patch.category_id = input.categoryId;
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
    // Corbeille (mig. 152), jamais `.delete()` : un DELETE emportait en cascade
    // commentaires, sous-tâches et historique, et la policy ne l'ouvre plus
    // qu'aux admins. La RPC porte l'autorisation (`task.deleteAny` ou créateur).
    const { error } = await supabase.rpc('trash_team_task', { p_task: taskId });
    if (error) throw normalizeApiError(error);
  }

  async restoreTask(taskId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.rpc('restore_team_task', { p_task: taskId });
    if (error) throw normalizeApiError(error);
  }

  async getTrash(orgId: string): Promise<TeamTrashedTask[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.rpc('get_team_trash', { p_org: orgId });
    if (error) throw normalizeApiError(error);
    const rows = (data ?? []) as {
      id: string; project_id: string; name: string;
      deleted_at: string; deleted_by: string | null; created_by: string | null;
    }[];
    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      name: r.name,
      deletedAt: r.deleted_at,
      deletedBy: r.deleted_by,
      createdBy: r.created_by,
    }));
  }

  // ─── Commentaires (mig. 082) ───────────────────────────────────────

  async getComments(taskId: string): Promise<TeamTaskComment[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('team_task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw normalizeApiError(error);
    // Même règle que `getProjects` : au-delà de 200, ce sont les plus anciens
    // commentaires qui sortent, jamais celui qu'on vient d'écrire.
    return warnIfTruncated((data ?? []) as CommentRow[], 200, 'team_task_comments').reverse().map(mapComment);
  }

  async addComment(
    input: CreateTeamTaskCommentInput,
    options?: RestoreCommentOptions,
  ): Promise<TeamTaskComment> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user?.id;
    if (!uid) throw makeApiError('not_authenticated');
    // Whitelist explicite (anti mass-assignment V1) ; author_id = self,
    // vérifié aussi par la policy WITH CHECK.
    const { data, error } = await supabase
      .from('team_task_comments')
      .insert({
        task_id: input.taskId,
        // `author_id` vient de la SESSION, jamais de l'input — y compris sur
        // une restauration : « Annuler » ne doit pas permettre d'ecrire au nom
        // de quelqu'un d'autre. La policy WITH CHECK le verifie aussi.
        author_id: uid,
        body: input.body,
        mentions: input.mentions ?? [],
        // C-42 — restauration seulement. La whitelist reste explicite : on
        // n'etend pas le spread de l'input, on ajoute deux champs nommes.
        ...(options?.restoreId ? { id: options.restoreId } : {}),
        ...(options?.restoreCreatedAt ? { created_at: options.restoreCreatedAt } : {}),
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
    if (!uid) throw makeApiError('not_authenticated');
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

  // ─── Historique (mig. 094) — lecture seule ───────────────────────

  /**
   * Journal de l'organisation depuis `since` — revue hebdomadaire (#26).
   *
   * Le filtre `(org_id, created_at DESC)` suit exactement l'index
   * `idx_team_task_activity_org` de la mig. 094c : sans lui, la requête
   * scannerait le journal complet de l'entreprise à chaque ouverture.
   * La RLS reste la frontière — elle borne déjà le journal à l'org du lecteur.
   */
  async getOrgActivity(orgId: string, since: string): Promise<TeamTaskActivity[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('team_task_activity')
      .select('*')
      .eq('org_id', orgId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw normalizeApiError(error);
    return warnIfTruncated((data ?? []) as ActivityRow[], 500, 'team_task_activity').map(mapActivity);
  }

  // ─── Dépendances (mig. 108) ────────────────────────────────────────

  async getTaskDependencies(orgId: string): Promise<TeamTaskDependency[]> {
    if (!supabase) throw new Error('Supabase not configured');
    // ⚡ RPC indexable (mig. 117), pas `.from(...)` : la policy delegue son
    // perimetre a `team_tasks`, donc elle payait `can_access_team_project`
    // (et sa CTE recursive) UNE FOIS PAR ARETE. Cf. SCALABILITY.md 2bis.
    const { data, error } = await supabase
      .rpc('get_my_team_task_dependencies', { p_org: orgId })
      .select('task_id, depends_on_id')
      .limit(5000);
    if (error) throw normalizeApiError(error);
    return warnIfTruncated(
      (data ?? []) as unknown as { task_id: string; depends_on_id: string }[],
      5000,
      'team_task_dependencies',
    ).map((r) => ({
      taskId: r.task_id,
      dependsOnId: r.depends_on_id,
    }));
  }

  async addTaskDependency(taskId: string, dependsOnId: string, orgId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    // `org_id` est réécrit par le trigger de cohérence (mig. 108) depuis la
    // tâche elle-même ; on l'envoie parce que la colonne est NOT NULL, jamais
    // comme une source de vérité.
    const { error } = await supabase
      .from('team_task_dependencies')
      .insert({ task_id: taskId, depends_on_id: dependsOnId, org_id: orgId });
    if (error) throw normalizeApiError(error);
  }

  async removeTaskDependency(taskId: string, dependsOnId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase
      .from('team_task_dependencies')
      .delete()
      .eq('task_id', taskId)
      .eq('depends_on_id', dependsOnId);
    if (error) throw normalizeApiError(error);
  }
}
