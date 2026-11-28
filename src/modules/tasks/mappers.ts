// ═══════════════════════════════════════════════════════════════════
// Tasks — pure DB <-> domain mappers (extracted from supabase.repository.ts
// for unit-testability). The `mapToDb` whitelist is a SECURITY BOUNDARY:
// it must NEVER emit `user_id` (anti-mass-assignment, faille V1). The id is
// added server-side in the repository from `auth.getUser()`.
// ═══════════════════════════════════════════════════════════════════
import { Task, Subtask, TaskRecurrence, TaskStatus, TaskHealth } from './types';
import { fromJson, toJson } from '@/lib/db-contract';
import type { ColumnsExist, DbPatch, DbRow, Json, Verified } from '@/lib/db-contract';
import { deadlineDayKey } from '@/lib/deadline';

/** Supabase DB row type for the `tasks` table (snake_case). */
export interface TaskRow {
  id: string;
  name: string;
  description?: string | null;
  priority: number;
  // Depuis la mig. 145 : NULL en base = aucune categorie.
  category: string | null;
  /** Échéance : un jour (mig. 251), NULL = aucune. Seule colonne d'échéance lue et écrite (DAT-01). */
  due_date?: string | null;
  estimated_time: number;
  created_at?: string | null;
  updated_at?: string | null;
  bookmarked?: boolean;
  completed?: boolean;
  completed_at?: string | null;
  /** jsonb : `Subtask[]`, lu par `fromJson`. */
  subtasks?: Json;
  kr_id?: string | null;
  recurrence?: string | null;
  recurrence_parent_id?: string | null;
  is_collaborative?: boolean;
  pending_invites?: string[] | null;
  /** jsonb : `Record<string, boolean>`, lu par `fromJson`. */
  collaborator_validations?: Json | null;
  user_id?: string;
  // Mig. 214 : absents d'une ligne servie avant la migration.
  status?: string | null;
  health?: string | null;
}

/**
 * Ce que `mapTaskToDb` émet : les colonnes du schéma, sans `id` ni `user_id`
 * (faille V1, rendue impossible à la compilation par `DbPatch`).
 */
export type TaskDbInput = DbPatch<'tasks'>;

export function mapTaskFromDb(row: TaskRow): Task {
  return {
    id: row.id,
    name: row.name,
    // Postgres renvoie NULL (pas undefined) pour les colonnes vides. Le modèle
    // domaine et les gardes zod attendent des strings (ou undefined) — on
    // coerce les NULL, sinon recréer une tâche via l'undo échoue avec
    // « Expected string, received null ».
    description: row.description ?? undefined,
    priority: row.priority,
    category: row.category ?? '',
    deadline: row.due_date ?? '',
    estimatedTime: row.estimated_time,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    bookmarked: row.bookmarked ?? false,
    completed: row.completed ?? false,
    completedAt: row.completed_at ?? undefined,
    subtasks: fromJson<Subtask[] | null>(row.subtasks) || [],
    krId: row.kr_id ?? undefined,
    recurrence: (row.recurrence as TaskRecurrence | null) ?? 'none',
    // Écrit par le serveur uniquement (mig. 086) — `mapTaskToDb` étant une
    // whitelist, il ne peut pas repartir en écriture, ce qui est voulu :
    // c'est la clé d'idempotence de la récurrence, pas un champ éditable.
    recurrenceParentId: row.recurrence_parent_id ?? undefined,
    isCollaborative: row.is_collaborative ?? false,
    pendingInvites: row.pending_invites || [],
    collaboratorValidations: fromJson<Record<string, boolean> | null>(row.collaborator_validations) || {},
    userId: row.user_id,
    // Mig. 214. 🔴 On ne DÉDUIT PAS le statut ici, on rend ce que la base a
    // servi. Une tâche lue repart entière dans plusieurs écritures (« Annuler »
    // une suppression, dupliquer) : un statut fabriqué à la lecture y
    // partirait en base, et avant l'application de la migration la colonne
    // n'existe pas, donc l'écriture échouerait. Lire par `effectiveStatus()`.
    status: (row.status as TaskStatus | null | undefined) ?? undefined,
    health: (row.health as TaskHealth | null | undefined) ?? undefined,
  };
}

/** Échéance facultative : jour du domaine → colonne `due_date`, '' → NULL. */
function deadlineToDb(deadline: string): string | null {
  return deadlineDayKey(deadline) || null;
}

/**
 * Paramètre `p_next_deadline` (timestamptz) de `toggle_task_complete_v2` :
 * minuit UTC du jour. `echeance_jour` (mig. 251) lit le jour de l'instant
 * + 13 h en UTC, donc rend ce même jour, quel que soit le fuseau réglé.
 */
export function nextOccurrenceInstant(dayKey: string): string {
  return `${deadlineDayKey(dayKey)}T00:00:00.000Z`;
}

export function mapTaskToDb(input: Partial<Task>): TaskDbInput {
  const result: TaskDbInput = {};
  if (input.name !== undefined) result.name = input.name;
  if (input.description !== undefined) result.description = input.description;
  if (input.priority !== undefined) result.priority = input.priority;
  // 🔴 `''` (NO_CATEGORY côté TypeScript) devient NULL en base depuis la
  // mig. 145 : une clé étrangère ne peut pas référencer la chaîne vide.
  // ⚠️ La conversion vit ICI, et NULLE PART AILLEURS. Propager `null` jusqu'aux
  // composants imposerait de revoir des dizaines de comparaisons
  // `t.category === ...` pour un gain nul, et créerait DEUX marqueurs d'absence
  // à vérifier partout — exactement ce que le commentaire d'`impact.ts`
  // interdit.
  if (input.category !== undefined) result.category = input.category === '' ? null : input.category;
  if (input.deadline !== undefined) result.due_date = deadlineToDb(input.deadline);
  if (input.estimatedTime !== undefined) result.estimated_time = input.estimatedTime;
  if (input.bookmarked !== undefined) result.bookmarked = input.bookmarked;
  if (input.completed !== undefined) result.completed = input.completed;
  if (input.completedAt !== undefined) result.completed_at = input.completedAt;
  if (input.subtasks !== undefined) result.subtasks = toJson(input.subtasks);
  // Lien KR (#28) : chaîne vide = « délié » → NULL en base.
  if (input.krId !== undefined) result.kr_id = input.krId ? input.krId : null;
  // Récurrence (#26).
  if (input.recurrence !== undefined) result.recurrence = input.recurrence;
  if (input.isCollaborative !== undefined) result.is_collaborative = input.isCollaborative;
  if (input.pendingInvites !== undefined) result.pending_invites = input.pendingInvites;
  if (input.collaboratorValidations !== undefined) result.collaborator_validations = toJson(input.collaboratorValidations);
  // Statut et État (mig. 214). Un état effacé (`null`) part en NULL : c'est
  // « aucun état déclaré », pas « ne touche pas à la colonne ».
  if (input.status !== undefined) result.status = input.status;
  if (input.health !== undefined) result.health = input.health ?? null;
  return result;
}

// ARC-07 : une colonne renommée en base casse `tsc` ici, pas en production.
export type TaskRowContract = Verified<ColumnsExist<TaskRow, DbRow<'tasks'>>>;
