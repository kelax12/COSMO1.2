// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS MODULE - Repository Interface
// ═══════════════════════════════════════════════════════════════════

import {
  TeamProject,
  CreateTeamProjectInput,
  TeamTask,
  CreateTeamTaskInput,
  UpdateTeamTaskInput,
  TeamTaskFilters,
} from './types';

export interface ITeamProjectsRepository {
  // Projets
  getProjects(orgId: string): Promise<TeamProject[]>;
  createProject(orgId: string, input: CreateTeamProjectInput): Promise<TeamProject>;
  archiveProject(projectId: string): Promise<void>;

  // Tâches d'équipe
  getTasks(orgId: string, filters?: TeamTaskFilters): Promise<TeamTask[]>;
  createTask(orgId: string, input: CreateTeamTaskInput): Promise<TeamTask>;
  updateTask(taskId: string, input: UpdateTeamTaskInput): Promise<TeamTask>;
  deleteTask(taskId: string): Promise<void>;
}
