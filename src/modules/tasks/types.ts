export interface Task {
  id: string;
  name: string;
  description?: string;
  priority: number;
  category: string;
  deadline: string;
  estimatedTime: number;
  createdAt?: string;
  bookmarked: boolean;
  completed: boolean;
  completedAt?: string;
  isCollaborative?: boolean;
  collaborators?: string[];
  pendingInvites?: string[];
  collaboratorValidations?: Record<string, boolean>;
  userId?: string;
}

export type CreateTaskInput = Omit<Task, 'id' | 'createdAt'>;

export type UpdateTaskInput = Partial<Omit<Task, 'id' | 'createdAt'>>;

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
