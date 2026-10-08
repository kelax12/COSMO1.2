/** Récurrence d'une tâche (#26) : à la complétion, l'occurrence suivante est générée. */
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

/** Élément de checklist d'une tâche (#12). */
export interface Subtask {
  id: string;
  name: string;
  completed: boolean;
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  priority: number;
  category: string;
  deadline: string;
  estimatedTime: number;
  createdAt?: string;
  /** Dernière modification (géré serveur — lecture seule, #40). */
  updatedAt?: string;
  bookmarked: boolean;
  completed: boolean;
  completedAt?: string;
  subtasks?: Subtask[];
  /** Id du Key Result OKR auquel la tâche contribue (#28). */
  krId?: string;
  /** Récurrence (#26) — défaut 'none'. */
  recurrence?: TaskRecurrence;
  /**
   * Occurrence dont cette tâche est issue (récurrence). Écrit par le SERVEUR
   * (`toggle_task_complete_v2`, mig. 086) et jamais par le client : c'est la
   * clé d'idempotence qui garantit au plus une occurrence générée par parent.
   * Lecture seule côté client — `mapTaskToDb` ne l'émet jamais.
   */
  recurrenceParentId?: string;
  isCollaborative?: boolean;
  pendingInvites?: string[];
  collaboratorValidations?: Record<string, boolean>;
  sharedBy?: string;
  userId?: string;
  /**
   * Statut (mig. 214) : colonne du Tableau. Tenu d'accord avec `completed` par
   * le trigger `sync_task_status`, et par `applyStatusSync` en démo et en
   * optimiste. `completed` reste le champ canonique de « terminée » (B6) :
   * `status === 'done'` en est le reflet, jamais une seconde vérité.
   * Absent sur une ligne lue avant la mig. 214 : `effectiveStatus()`.
   */
  status?: TaskStatus;
  /** État déclaré (mig. 214), même vocabulaire que les tâches d'équipe. `null` = aucun. */
  health?: TaskHealth | null;
}

/**
 * Arête du graphe de dépendances personnel (mig. 132) : `taskId` est bloquée
 * par `dependsOnId`. Même forme que `TeamTaskDependency` — les deux graphes
 * partagent leurs helpers de parcours (`@/lib/dependency-graph`).
 */
export interface TaskDependency {
  taskId: string;
  dependsOnId: string;
}

export type CreateTaskInput = Omit<Task, 'id' | 'createdAt'>;

export type UpdateTaskInput = Partial<Omit<Task, 'id' | 'createdAt'>>;

/**
 * Statut d'une tâche perso (mig. 214). Quatre valeurs et non cinq : `review`,
 * qui existe en entreprise (mig. 091), est retiré exprès (décision d'Axel,
 * 2026-10-08) : une relecture n'a pas de sens pour une personne seule.
 *
 * Remplace l'ancien type dérivé `'todo' | 'completed'` (B6), qui n'avait
 * aucun lecteur.
 */
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';

/** État déclaré, vocabulaire partagé avec `team_tasks.health` (mig. 204). */
export type TaskHealth = 'on_track' | 'at_risk' | 'off_track';

// Filter types for queries
export interface TaskFilters {
  completed?: boolean;
  bookmarked?: boolean;
  category?: string;
  priorityMin?: number;
  priorityMax?: number;
  deadlineBefore?: string;
  deadlineAfter?: string;
}
