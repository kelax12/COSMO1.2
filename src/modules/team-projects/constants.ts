// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS MODULE - Constants
// ═══════════════════════════════════════════════════════════════════

// Clés localStorage (démo) — préfixe cosmo_ (sweep clearDemoStorage).
export const TEAM_PROJECTS_STORAGE_KEY = 'cosmo_team_projects';
export const TEAM_TASKS_STORAGE_KEY = 'cosmo_team_tasks';
export const TEAM_TASK_COMMENTS_STORAGE_KEY = 'cosmo_team_task_comments';
export const TEAM_TASK_SUBTASKS_STORAGE_KEY = 'cosmo_team_task_subtasks';
export const TEAM_LABELS_STORAGE_KEY = 'cosmo_team_labels';
export const TEAM_TASK_LABELS_STORAGE_KEY = 'cosmo_team_task_labels';
export const TEAM_TASK_ACTIVITY_STORAGE_KEY = 'cosmo_team_task_activity';
export const TEAM_TASK_DEPENDENCIES_STORAGE_KEY = 'cosmo_team_task_dependencies';
/** Corbeille démo (mig. 152) : les tâches supprimées y attendent 30 jours. */
export const TEAM_TASK_TRASH_STORAGE_KEY = 'cosmo_team_task_trash';

/** Durée de la corbeille, en jours : celle que `purge_team_task_trash` applique. */
export const TEAM_TASK_TRASH_DAYS = 30;

/**
 * Plafond d'une lecture de tâches d'équipe. Exporté pour que l'écran puisse
 * DIRE qu'il montre un extrait : le toast de `warnIfTruncated` ne passe qu'une
 * fois par session, un bandeau reste tant que c'est vrai.
 */
export const TEAM_TASKS_READ_LIMIT = 1000;

/**
 * Projets : lecture paginée par pages de 500 (audit du 2026-09-24). Un
 * plafond unique de 200 masquait le reste d'un portefeuille de 500 projets.
 */
export const TEAM_PROJECTS_PAGE = 500;
export const TEAM_PROJECTS_READ_LIMIT = 5000;

export const teamProjectKeys = {
  all: ['team-projects'] as const,
  projects: (orgId: string) => [...teamProjectKeys.all, 'projects', orgId] as const,
  tasks: (orgId: string) => [...teamProjectKeys.all, 'tasks', orgId] as const,
  trash: (orgId: string) => [...teamProjectKeys.all, 'trash', orgId] as const,
  comments: (taskId: string) => [...teamProjectKeys.all, 'comments', taskId] as const,
  subtasks: (taskId: string) => [...teamProjectKeys.all, 'subtasks', taskId] as const,
  labels: (orgId: string) => [...teamProjectKeys.all, 'labels', orgId] as const,
  taskLabels: (orgId: string) => [...teamProjectKeys.all, 'task-labels', orgId] as const,
  activity: (taskId: string) => [...teamProjectKeys.all, 'activity', taskId] as const,
  dependencies: (orgId: string) => [...teamProjectKeys.all, 'dependencies', orgId] as const,
  // Portefeuille (mig. 153).
  milestones: (orgId: string) => [...teamProjectKeys.all, 'milestones', orgId] as const,
  projectDependencies: (orgId: string) => [...teamProjectKeys.all, 'project-dependencies', orgId] as const,
  // Équipes associées (mig. 164).
  projectTeams: (orgId: string) => [...teamProjectKeys.all, 'project-teams', orgId] as const,
  orgActivity: (orgId: string, since: string) =>
    [...teamProjectKeys.all, 'org-activity', orgId, since] as const,
};
