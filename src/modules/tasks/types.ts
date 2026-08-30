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

// Derived bucket type for grouping. The canonical model stores a boolean
// `completed`; status is computed from it (faille B6).
export type TaskStatus = 'todo' | 'completed';

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
