// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — accès Supabase du PORTEFEUILLE (mig. 153, M2)
//
// Jalons, dépendances entre projets et création atomique. Extrait de
// `supabase.repository.ts` pour ne pas le faire passer au-dessus du plafond
// de 600 lignes (`src/architecture.guard.test.ts`) : la classe y délègue en
// une ligne par méthode.
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { warnIfTruncated } from '@/lib/pagination.warning';
import type {
  CreateTeamProjectInput,
  CreateTeamProjectMilestoneInput,
  DraftProjectMilestone,
  DraftProjectTask,
  TeamProjectDependency,
  TeamProjectMilestone,
  UpdateTeamProjectMilestoneInput,
} from './types';
import { mapMilestone, type MilestoneRow } from './supabase.mappers';

const client = () => {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
};

/**
 * Projet + tâches initiales + jalons en UNE transaction (RPC INVOKER) : un
 * refus n'importe où — droit de créer une tâche, portée d'assignation, date
 * de début après l'échéance — annule tout. Avant la mig. 153, le client
 * enchaînait les appels et un échec au milieu laissait un projet à moitié créé.
 *
 * Whitelist explicite : aucun spread de l'input vers la base.
 */
export async function createProjectWithTasks(
  orgId: string,
  input: CreateTeamProjectInput,
  tasks: DraftProjectTask[] = [],
  milestones: DraftProjectMilestone[] = [],
): Promise<string> {
  const { data, error } = await client().rpc('create_team_project_with_tasks', {
    p_org: orgId,
    p_project: {
      name: input.name,
      color: input.color ?? 'blue',
      team_id: input.teamId ?? null,
      category_id: input.categoryId ?? null,
      description: input.description ?? null,
      owner_id: input.ownerId ?? null,
      status: input.status ?? 'active',
      start_date: input.startDate || null,
      due_date: input.dueDate || null,
      is_template: input.isTemplate ?? false,
      template_payload: input.isTemplate ? input.templatePayload ?? null : null,
    },
    p_tasks: tasks.map((t) => ({
      name: t.name,
      description: t.description ?? null,
      priority: t.priority ?? 3,
      estimated_time: t.estimatedTime ?? null,
      start_date: t.startDate || null,
      deadline: t.deadline || null,
      assignee_ids: t.assigneeIds ?? [],
    })),
    p_milestones: milestones.map((m) => ({ name: m.name, due_date: m.dueDate })),
  });
  if (error) throw normalizeApiError(error);
  return data as string;
}

// ─── Jalons ──────────────────────────────────────────────────────────

export async function getMilestones(orgId: string): Promise<TeamProjectMilestone[]> {
  // RPC indexable (même forme que la mig. 117) : la policy de la table
  // délègue à `team_projects`, donc à `can_access_team_project` PAR LIGNE.
  const { data, error } = await client()
    .rpc('get_my_team_project_milestones', { p_org: orgId })
    .select('*')
    .order('due_date', { ascending: true })
    .limit(2000);
  if (error) throw normalizeApiError(error);
  return warnIfTruncated((data ?? []) as unknown as MilestoneRow[], 2000, 'team_project_milestones').map(mapMilestone);
}

export async function createMilestone(orgId: string, input: CreateTeamProjectMilestoneInput): Promise<void> {
  // `org_id` est réécrit par le trigger depuis le projet ; il est envoyé parce
  // que la colonne est NOT NULL, jamais comme une source de vérité.
  // Pas de `.select()` de représentation : même raison que `createProject`.
  const { error } = await client()
    .from('team_project_milestones')
    .insert({ project_id: input.projectId, org_id: orgId, name: input.name, due_date: input.dueDate });
  if (error) throw normalizeApiError(error);
}

export async function updateMilestone(milestoneId: string, input: UpdateTeamProjectMilestoneInput): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.dueDate !== undefined) patch.due_date = input.dueDate;
  if (input.completed !== undefined) patch.completed_at = input.completed ? new Date().toISOString() : null;
  const { error } = await client().from('team_project_milestones').update(patch).eq('id', milestoneId);
  if (error) throw normalizeApiError(error);
}

export async function deleteMilestone(milestoneId: string): Promise<void> {
  const { error } = await client().from('team_project_milestones').delete().eq('id', milestoneId);
  if (error) throw normalizeApiError(error);
}

// ─── Dépendances entre projets ───────────────────────────────────────

export async function getProjectDependencies(orgId: string): Promise<TeamProjectDependency[]> {
  const { data, error } = await client()
    .rpc('get_my_team_project_dependencies', { p_org: orgId })
    .select('project_id, depends_on_id')
    .limit(2000);
  if (error) throw normalizeApiError(error);
  return warnIfTruncated(
    (data ?? []) as unknown as { project_id: string; depends_on_id: string }[],
    2000,
    'team_project_dependencies',
  ).map((r) => ({ projectId: r.project_id, dependsOnId: r.depends_on_id }));
}

export async function addProjectDependency(projectId: string, dependsOnId: string, orgId: string): Promise<void> {
  const { error } = await client()
    .from('team_project_dependencies')
    .insert({ project_id: projectId, depends_on_id: dependsOnId, org_id: orgId });
  if (error) throw normalizeApiError(error);
}

export async function removeProjectDependency(projectId: string, dependsOnId: string): Promise<void> {
  const { error } = await client()
    .from('team_project_dependencies')
    .delete()
    .eq('project_id', projectId)
    .eq('depends_on_id', dependsOnId);
  if (error) throw normalizeApiError(error);
}
