// ═══════════════════════════════════════════════════════════════════
// Tasks — pure DB <-> domain mappers (extracted from supabase.repository.ts
// for unit-testability). The `mapToDb` whitelist is a SECURITY BOUNDARY:
// it must NEVER emit `user_id` (anti-mass-assignment, faille V1). The id is
// added server-side in the repository from `auth.getUser()`.
// ═══════════════════════════════════════════════════════════════════
import { Task, Subtask } from './types';

/** Supabase DB row type for the `tasks` table (snake_case). */
export interface TaskRow {
  id: string;
  name: string;
  description?: string;
  priority: number;
  category: string;
  deadline: string | null;
  estimated_time: number;
  created_at?: string;
  bookmarked?: boolean;
  completed?: boolean;
  completed_at?: string;
  subtasks?: Subtask[];
  kr_id?: string | null;
  is_collaborative?: boolean;
  pending_invites?: string[];
  collaborator_validations?: Record<string, boolean>;
  user_id?: string;
}

/** DB input type for insert/update operations (snake_case). */
export interface TaskDbInput {
  name?: string;
  description?: string;
  priority?: number;
  category?: string;
  deadline?: string | null;
  estimated_time?: number;
  bookmarked?: boolean;
  completed?: boolean;
  completed_at?: string;
  subtasks?: Subtask[];
  kr_id?: string | null;
  is_collaborative?: boolean;
  pending_invites?: string[];
  collaborator_validations?: Record<string, boolean>;
  user_id?: string;
}

export function mapTaskFromDb(row: TaskRow): Task {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priority: row.priority,
    category: row.category,
    deadline: row.deadline ?? '',
    estimatedTime: row.estimated_time,
    createdAt: row.created_at,
    bookmarked: row.bookmarked ?? false,
    completed: row.completed ?? false,
    completedAt: row.completed_at,
    subtasks: row.subtasks || [],
    krId: row.kr_id ?? undefined,
    isCollaborative: row.is_collaborative ?? false,
    pendingInvites: row.pending_invites || [],
    collaboratorValidations: row.collaborator_validations || {},
    userId: row.user_id,
  };
}

export function mapTaskToDb(input: Partial<Task>): TaskDbInput {
  const result: TaskDbInput = {};
  if (input.name !== undefined) result.name = input.name;
  if (input.description !== undefined) result.description = input.description;
  if (input.priority !== undefined) result.priority = input.priority;
  if (input.category !== undefined) result.category = input.category;
  // Échéance facultative : une chaîne vide signifie « pas de date » → NULL
  // en base (la colonne deadline est un timestamp, '' n'est pas valide).
  if (input.deadline !== undefined) result.deadline = input.deadline ? input.deadline : null;
  if (input.estimatedTime !== undefined) result.estimated_time = input.estimatedTime;
  if (input.bookmarked !== undefined) result.bookmarked = input.bookmarked;
  if (input.completed !== undefined) result.completed = input.completed;
  if (input.completedAt !== undefined) result.completed_at = input.completedAt;
  if (input.subtasks !== undefined) result.subtasks = input.subtasks;
  // Lien KR (#28) : chaîne vide = « délié » → NULL en base.
  if (input.krId !== undefined) result.kr_id = input.krId ? input.krId : null;
  if (input.isCollaborative !== undefined) result.is_collaborative = input.isCollaborative;
  if (input.pendingInvites !== undefined) result.pending_invites = input.pendingInvites;
  if (input.collaboratorValidations !== undefined) result.collaborator_validations = input.collaboratorValidations;
  return result;
}
