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
  /**
   * Catégorie d'entreprise (mig. 111) — étiquette transverse, distincte du
   * projet lui-même. null = aucune catégorie.
   */
  categoryId?: string | null;
  // ─── Projet riche (mig. 153, M2) ───────────────────────────────────
  /** Texte libre, 5 000 caractères au plus. */
  description?: string | null;
  /** Responsable : pilote le projet (droits d'édition), sans en changer l'audience. */
  ownerId?: string | null;
  status?: TeamProjectStatus;
  /** Date locale 'YYYY-MM-DD'. `startDate <= dueDate` (CHECK serveur). */
  startDate?: string | null;
  dueDate?: string | null;
  /**
   * Modèle : jamais affiché comme un projet en cours. Son contenu vit dans
   * `templatePayload`, JAMAIS en vraies tâches (elles remonteraient dans
   * « Mes tâches » et les statistiques).
   */
  isTemplate?: boolean;
  templatePayload?: TeamProjectTemplatePayload | null;
}

/** Cycle de vie d'un projet (mig. 153). Défaut serveur : `active`. */
export type TeamProjectStatus = 'planned' | 'active' | 'on_hold' | 'done';

/**
 * Contenu d'un modèle : les dates sont des DÉCALAGES en jours depuis le début
 * du projet instancié, jamais des dates absolues (un modèle sert des mois).
 */
export interface TeamProjectTemplatePayload {
  tasks: {
    name: string;
    description?: string;
    priority?: number;
    estimatedTime?: number;
    startOffset?: number | null;
    deadlineOffset?: number | null;
  }[];
  milestones: { name: string; offset: number }[];
  /** Durée du projet en jours (fin - début), si le projet source en avait une. */
  durationDays?: number | null;
}

export interface CreateTeamProjectInput {
  name: string;
  color?: string;
  /** null/absent = projet d'org visible par toute l'entreprise. */
  teamId?: string | null;
  categoryId?: string | null;
  description?: string | null;
  ownerId?: string | null;
  status?: TeamProjectStatus;
  startDate?: string | null;
  dueDate?: string | null;
  isTemplate?: boolean;
  templatePayload?: TeamProjectTemplatePayload | null;
}

/** Tâche initiale d'une création atomique (RPC `create_team_project_with_tasks`). */
export interface DraftProjectTask {
  name: string;
  description?: string;
  priority?: number;
  estimatedTime?: number;
  startDate?: string;
  deadline?: string;
  assigneeIds?: string[];
}

/** Jalon initial d'une création atomique. */
export interface DraftProjectMilestone {
  name: string;
  dueDate: string;
}

/**
 * Patch projet — `project.edit` (mig. 153), ou responsable du projet. Le
 * responsable ne change ni `teamId`, ni `ownerId`, ni `isTemplate` (trigger).
 */
export interface UpdateTeamProjectInput {
  name?: string;
  color?: string;
  teamId?: string | null;
  categoryId?: string | null;
  /** true = archiver (archived_at → now), false = désarchiver (→ null). */
  archived?: boolean;
  description?: string | null;
  ownerId?: string | null;
  status?: TeamProjectStatus;
  startDate?: string | null;
  dueDate?: string | null;
}

/** Jalon d'un projet (mig. 153). */
export interface TeamProjectMilestone {
  id: string;
  orgId: string;
  projectId: string;
  name: string;
  /** Date locale 'YYYY-MM-DD'. */
  dueDate: string;
  completedAt: string | null;
  createdAt: string;
}

export interface CreateTeamProjectMilestoneInput {
  projectId: string;
  name: string;
  dueDate: string;
}

export interface UpdateTeamProjectMilestoneInput {
  name?: string;
  dueDate?: string;
  completed?: boolean;
}

/**
 * Arête entre projets (mig. 153) : `projectId` est BLOQUÉ par `dependsOnId`.
 * Même vocabulaire que `TeamTaskDependency` ; relue à l'envers, elle inverse
 * le plan sans qu'aucun type ne s'en aperçoive.
 */
export interface TeamProjectDependency {
  projectId: string;
  dependsOnId: string;
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
  /** Début planifié (mig. 153), 'YYYY-MM-DD' ou '' ; jamais après `deadline`. */
  startDate?: string;
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
  /**
   * Catégorie d'entreprise (mig. 111) — une tâche porte SA PROPRE catégorie,
   * indépendamment de celle de son projet (elle n'en hérite jamais
   * automatiquement). null = aucune catégorie.
   */
  categoryId?: string | null;
}

export interface CreateTeamTaskInput {
  projectId: string;
  name: string;
  description?: string;
  priority?: number;
  deadline?: string;
  startDate?: string;
  estimatedTime?: number;
  assigneeIds?: string[];
  status?: TeamTaskStatus;
  categoryId?: string | null;
}

/** Champs modifiables — jamais orgId/createdBy (whitelist mapToDb). */
export interface UpdateTeamTaskInput {
  name?: string;
  description?: string;
  priority?: number;
  deadline?: string;
  startDate?: string;
  estimatedTime?: number;
  assigneeIds?: string[];
  projectId?: string;
  completed?: boolean;
  status?: TeamTaskStatus;
  categoryId?: string | null;
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
  /**
   * « Ensemble de travail » : les tâches OUVERTES, plus celles terminées depuis
   * cet instant (ISO). C'est ce que lisent l'Aperçu et les Statistiques : la
   * lecture par défaut (les 1 000 dernières CRÉÉES, terminées comprises) faisait
   * sortir une vieille tâche encore ouverte dès que l'organisation en créait
   * 1 000 autres, et calculait les chiffres sur un extrait.
   */
  openOrCompletedSince?: string;
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

// ─── Dépendances entre tâches (mig. 108) ─────────────────────────────

/**
 * Arête orientée du graphe de dépendances : `taskId` est BLOQUÉE par
 * `dependsOnId`, donc `dependsOnId` doit se terminer en premier.
 *
 * Le sens se lit toujours dans ce vocabulaire (« bloquée par »), jamais
 * l'inverse : une arête relue à l'envers inverse le chemin critique sans
 * qu'aucun type ne s'en aperçoive.
 */
export interface TeamTaskDependency {
  taskId: string;
  dependsOnId: string;
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

/**
 * Une tâche à la corbeille (mig. 152), telle que la rend `get_team_trash` :
 * l'intitulé et qui l'a supprimée, jamais la description. Le contenu revient
 * avec la restauration.
 */
export interface TeamTrashedTask {
  id: string;
  projectId: string;
  name: string;
  deletedAt: string;
  deletedBy: string | null;
  createdBy: string | null;
}
