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
  isCollaborative?: boolean;
  pendingInvites?: string[];
  collaboratorValidations?: Record<string, boolean>;
  sharedBy?: string;
  userId?: string;
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
