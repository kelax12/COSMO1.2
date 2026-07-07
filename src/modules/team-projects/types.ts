// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS MODULE - Types (projets & tâches d'équipe)
// ═══════════════════════════════════════════════════════════════════

export interface TeamProject {
  id: string;
  orgId: string;
  name: string;
  color: string;
  createdBy: string;
  archivedAt?: string | null;
  createdAt: string;
}

export interface CreateTeamProjectInput {
  name: string;
  color?: string;
}

/** Tâche d'équipe — champs canoniques `name` / `completed` / `deadline` (B6). */
export interface TeamTask {
  id: string;
  orgId: string;
  projectId: string;
  name: string;
  description?: string;
  /** 1..5 (P1..P5). */
  priority: number;
  /** Date locale 'YYYY-MM-DD' ou '' si aucune. */
  deadline?: string;
  estimatedTime?: number;
  /** auth.users.id de l'assigné, ou null si non assignée. */
  assigneeId?: string | null;
  createdBy: string;
  completed: boolean;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamTaskInput {
  projectId: string;
  name: string;
  description?: string;
  priority?: number;
  deadline?: string;
  estimatedTime?: number;
  assigneeId?: string | null;
}

/** Champs modifiables — jamais orgId/createdBy (whitelist mapToDb). */
export interface UpdateTeamTaskInput {
  name?: string;
  description?: string;
  priority?: number;
  deadline?: string;
  estimatedTime?: number;
  assigneeId?: string | null;
  projectId?: string;
  completed?: boolean;
}

export interface TeamTaskFilters {
  projectId?: string;
  assigneeId?: string;
  completed?: boolean;
}
