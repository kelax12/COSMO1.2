// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS · Portefeuille — interface commune démo / production
// ═══════════════════════════════════════════════════════════════════

import type { ProjectHealth, ProjectRole, TeamProject, TeamTaskActivity } from './types';
import type {
  CreateProjectFullInput,
  DuplicateProjectInput,
  MyFollows,
  ProjectLinks,
  ProjectUpdate,
  TrashedTask,
} from './portfolio.types';

export interface ITeamPortfolioRepository {
  getProjectLinks(orgId: string): Promise<ProjectLinks>;
  addProjectTeam(orgId: string, projectId: string, teamId: string): Promise<void>;
  removeProjectTeam(projectId: string, teamId: string): Promise<void>;
  setProjectMember(orgId: string, projectId: string, userId: string, role: ProjectRole): Promise<void>;
  removeProjectMember(projectId: string, userId: string): Promise<void>;

  getProjectUpdates(projectId: string): Promise<ProjectUpdate[]>;
  postProjectUpdate(projectId: string, health: ProjectHealth, note: string): Promise<void>;

  createProjectFull(orgId: string, input: CreateProjectFullInput): Promise<TeamProject>;
  duplicateProject(input: DuplicateProjectInput): Promise<TeamProject>;

  getTrash(orgId: string): Promise<TrashedTask[]>;
  restoreTask(taskId: string): Promise<void>;

  /** Historique d'UNE tâche (mig. 094), rendu par l'onglet Historique de sa fiche. */
  getTaskActivity(taskId: string): Promise<TeamTaskActivity[]>;

  getMyFollows(orgId: string): Promise<MyFollows>;
  setTaskFollow(orgId: string, taskId: string, follow: boolean): Promise<void>;
  setProjectFollow(orgId: string, projectId: string, follow: boolean): Promise<void>;
}
