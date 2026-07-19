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
  /** Équipe propriétaire (cloisonnement) — null = projet d'org, visible par tous. */
  teamId?: string | null;
}

export interface CreateTeamProjectInput {
  name: string;
  color?: string;
  /** null/absent = projet d'org visible par toute l'entreprise. */
  teamId?: string | null;
}

/** Patch projet (managers only — RLS team_projects_update, mig. 068). */
export interface UpdateTeamProjectInput {
  name?: string;
  color?: string;
  teamId?: string | null;
  /** true = archiver (archived_at → now), false = désarchiver (→ null). */
  archived?: boolean;
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
  /** auth.users.id des assignés — [] si non assignée (multi-assignation, mig. 072). */
  assigneeIds: string[];
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
  assigneeIds?: string[];
}

/** Champs modifiables — jamais orgId/createdBy (whitelist mapToDb). */
export interface UpdateTeamTaskInput {
  name?: string;
  description?: string;
  priority?: number;
  deadline?: string;
  estimatedTime?: number;
  assigneeIds?: string[];
  projectId?: string;
  completed?: boolean;
}

/** Commentaire sur une tâche d'équipe (journal immuable, mig. 082). */
export interface TeamTaskComment {
  id: string;
  taskId: string;
  /** auth.users.id de l'auteur — null si compte supprimé (FK SET NULL). */
  authorId: string | null;
  body: string;
  /** auth.users.id mentionnés via @ — purgés à la suppression de compte. */
  mentions: string[];
  createdAt: string;
}

export interface CreateTeamTaskCommentInput {
  taskId: string;
  body: string;
  mentions?: string[];
}

export interface TeamTaskFilters {
  projectId?: string;
  /** Filtre « assignée à » — matche si l'uid figure dans assigneeIds. */
  assigneeId?: string;
  completed?: boolean;
}
