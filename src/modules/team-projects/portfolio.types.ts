// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS · Portefeuille (mig. 151, 152, 155)
//
// Ce que le projet a gagné en devenant un objet de pilotage : ses
// rattachements (équipes secondaires, membres directs et leur rôle),
// l'historique de sa santé, sa corbeille, et le suivi (« suivre ») des
// tâches et des projets. Séparé de `types.ts` pour que le cœur du module
// (tâches, sous-tâches, commentaires) reste lisible.
// ═══════════════════════════════════════════════════════════════════

import type { ProjectHealth, ProjectRole, TeamTaskActivity } from './types';

/** Équipe SECONDAIRE d'un projet (l'équipe principale reste `TeamProject.teamId`). */
export interface ProjectTeamLink {
  projectId: string;
  teamId: string;
}

/** Personne rattachée directement à un projet, avec son rôle SUR CE projet. */
export interface ProjectMember {
  projectId: string;
  userId: string;
  role: ProjectRole;
}

/** Tous les rattachements visibles d'une organisation, en une lecture. */
export interface ProjectLinks {
  teams: ProjectTeamLink[];
  members: ProjectMember[];
}

/** Déclaration de santé datée (historique, mig. 152). */
export interface ProjectUpdate {
  id: string;
  projectId: string;
  health: ProjectHealth;
  note: string | null;
  authorId: string | null;
  createdAt: string;
}

/**
 * Création atomique d'un projet (RPC `create_team_project_full`) : le projet,
 * ses équipes secondaires, ses membres et ses tâches initiales réussissent
 * ensemble ou pas du tout.
 */
export interface CreateProjectFullInput {
  name: string;
  color?: string;
  teamId?: string | null;
  categoryId?: string | null;
  ownerId?: string | null;
  description?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  isTemplate?: boolean;
  extraTeamIds?: string[];
  members?: { userId: string; role: ProjectRole }[];
  tasks?: { name: string; assigneeIds: string[] }[];
}

export interface DuplicateProjectInput {
  projectId: string;
  name: string;
  /** Décalage appliqué à toutes les dates (jours). */
  shiftDays?: number;
  keepAssignees?: boolean;
  asTemplate?: boolean;
}

/** Tâche en corbeille (mig. 151), restaurable 30 jours. */
export interface TrashedTask {
  taskId: string;
  projectId: string;
  name: string;
  deletedBy: string | null;
  deletedAt: string;
}

/** Ce que je suis (mig. 155). */
export interface MyFollows {
  taskIds: string[];
  projectIds: string[];
}

export type { TeamTaskActivity };
