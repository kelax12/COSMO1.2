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

export const teamProjectKeys = {
  all: ['team-projects'] as const,
  projects: (orgId: string) => [...teamProjectKeys.all, 'projects', orgId] as const,
  tasks: (orgId: string) => [...teamProjectKeys.all, 'tasks', orgId] as const,
  comments: (taskId: string) => [...teamProjectKeys.all, 'comments', taskId] as const,
  subtasks: (taskId: string) => [...teamProjectKeys.all, 'subtasks', taskId] as const,
  labels: (orgId: string) => [...teamProjectKeys.all, 'labels', orgId] as const,
  taskLabels: (orgId: string) => [...teamProjectKeys.all, 'task-labels', orgId] as const,
  activity: (taskId: string) => [...teamProjectKeys.all, 'activity', taskId] as const,
};
