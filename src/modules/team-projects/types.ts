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

/**
 * Statut de flux d'une tâche d'équipe (mig. 091).
 *
 * `completed` reste la colonne lue par tout le code existant : le serveur
 * garde les deux synchronisés dans les deux sens. On ne dérive donc JAMAIS
 * `completed` de `status` côté client — c'est le trigger qui fait autorité.
 */
export type TeamTaskStatus = 'todo' | 'in_progress' | 'review' | 'blocked' | 'done';

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
  /** Statut de flux (mig. 091) — synchronisé serveur avec `completed`. */
  status: TeamTaskStatus;
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
  status?: TeamTaskStatus;
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
  status?: TeamTaskStatus;
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

/** Sous-tâche d'une tâche d'équipe (mig. 092) — un seul niveau, pas de récursion. */
export interface TeamSubtask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  /** Ordre d'affichage, réordonnable sans renuméroter le reste. */
  position: number;
  /** null si le compte auteur a été supprimé (FK SET NULL). */
  createdBy: string | null;
  createdAt: string;
}

export interface CreateTeamSubtaskInput {
  taskId: string;
  title: string;
  position?: number;
}

/** Champs modifiables — jamais taskId (le déplacement inter-tâches n'a pas de sens ici). */
export interface UpdateTeamSubtaskInput {
  title?: string;
  completed?: boolean;
  position?: number;
}

// ─── Labels transverses (mig. 093) ───────────────────────────────────

/** Label d'organisation — vocabulaire partagé, écriture réservée aux managers. */
export interface TeamLabel {
  id: string;
  orgId: string;
  name: string;
  /** Hex `#rrggbb` (validé par CHECK côté base). */
  color: string;
  createdBy: string | null;
  createdAt: string;
}

export interface CreateTeamLabelInput {
  name: string;
  color?: string;
}

export interface UpdateTeamLabelInput {
  name?: string;
  color?: string;
}

/** Ligne de jonction tâche ↔ label. */
export interface TeamTaskLabel {
  taskId: string;
  labelId: string;
}

// ─── Historique (mig. 094) ───────────────────────────────────────────

/** Champs journalisés par le trigger `log_team_task_activity`. */
export type TeamActivityField =
  | 'status' | 'assignees' | 'deadline' | 'priority' | 'project' | 'name';

/**
 * Entrée du journal append-only. `oldValue`/`newValue` sont du texte : le
 * journal doit rester lisible même si le type de la colonne d'origine change.
 * Pour `name`, les deux sont null — savoir QUE le titre a changé suffit
 * (choix de la mig. 094, pour ne pas dupliquer le contenu dans le journal).
 */
export interface TeamTaskActivity {
  id: string;
  taskId: string;
  orgId: string;
  /** null si le compte auteur a été supprimé (FK SET NULL). */
  actorId: string | null;
  field: TeamActivityField;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}
