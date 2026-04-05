// ═══════════════════════════════════════════════════════════════════
// LISTS MODULE - Type Definitions
// ═══════════════════════════════════════════════════════════════════

/**
 * TaskList - Represents a list of tasks grouped together
 */
export interface TaskList {
  id: string;
  name: string;
  color: string;
  taskIds: string[];
}

/**
 * Input type for creating a new list
 */
export type CreateListInput = Omit<TaskList, 'id' | 'taskIds'>;

/**
 * Input type for updating an existing list
 */
export type UpdateListInput = Partial<Omit<TaskList, 'id'>>;
