// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — lignes brutes Supabase et mappers vers le modèle métier
//
// Extrait de `supabase.repository.ts` le 2026-08-24. Ce n'est pas un
// rangement esthétique : le fichier d'origine était à 601 lignes, donc dans
// la liste `KNOWN_OVERSIZED` du cliquet de `src/architecture.guard.test.ts`,
// et le correctif de scalabilité (mig. 113) le faisait grossir encore. Le
// cliquet a fait exactement ce pour quoi il a été écrit : il a refusé la
// croissance nette et imposé la découpe qu'aucune revue n'avait demandée.
//
// Le partage est celui qui coûte le moins à relire : d'un côté la FORME des
// lignes (`snake_case` de Postgres) et leur traduction, de l'autre les accès.
// Aucune logique n'a changé.
// ═══════════════════════════════════════════════════════════════════

import {
  TeamProject,
  TeamTask,
  TeamTaskComment,
  TeamSubtask,
  TeamLabel,
  TeamTaskActivity,
} from './types';

export interface ProjectRow {
  id: string;
  org_id: string;
  name: string;
  color: string;
  created_by: string;
  archived_at: string | null;
  created_at: string;
  team_id: string | null;
  category_id: string | null;
}

export interface TaskRow {
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
  category_id: string | null;
}

export const mapProject = (r: ProjectRow): TeamProject => ({
  id: r.id,
  orgId: r.org_id,
  name: r.name,
  color: r.color,
  createdBy: r.created_by,
  archivedAt: r.archived_at,
  createdAt: r.created_at,
  teamId: r.team_id,
  categoryId: r.category_id,
});

export interface CommentRow {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  mentions: string[] | null;
  created_at: string;
}

export const mapComment = (r: CommentRow): TeamTaskComment => ({
  id: r.id,
  taskId: r.task_id,
  authorId: r.author_id,
  body: r.body,
  mentions: r.mentions ?? [],
  createdAt: r.created_at,
});

export const mapTask = (r: TaskRow): TeamTask => ({
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
  categoryId: r.category_id,
});


// ─── Sous-tâches (mig. 092) ──────────────────────────────────────────

export interface SubtaskRow {
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

export interface LabelRow {
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

export interface ActivityRow {
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
