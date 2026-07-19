// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS MODULE - Constants
// ═══════════════════════════════════════════════════════════════════

// Clés localStorage (démo) — préfixe cosmo_ (sweep clearDemoStorage).
export const TEAM_PROJECTS_STORAGE_KEY = 'cosmo_team_projects';
export const TEAM_TASKS_STORAGE_KEY = 'cosmo_team_tasks';
export const TEAM_TASK_COMMENTS_STORAGE_KEY = 'cosmo_team_task_comments';

export const teamProjectKeys = {
  all: ['team-projects'] as const,
  projects: (orgId: string) => [...teamProjectKeys.all, 'projects', orgId] as const,
  tasks: (orgId: string) => [...teamProjectKeys.all, 'tasks', orgId] as const,
  comments: (taskId: string) => [...teamProjectKeys.all, 'comments', taskId] as const,
};
