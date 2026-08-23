// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS MODULE - Repository Interface
// ═══════════════════════════════════════════════════════════════════

import {
  TeamProject,
  CreateTeamProjectInput,
  UpdateTeamProjectInput,
  TeamTask,
  CreateTeamTaskInput,
  UpdateTeamTaskInput,
  TeamTaskFilters,
  TeamTaskComment,
  CreateTeamTaskCommentInput,
  TeamSubtask,
  CreateTeamSubtaskInput,
  UpdateTeamSubtaskInput,
  TeamLabel,
  CreateTeamLabelInput,
  UpdateTeamLabelInput,
  TeamTaskLabel,
  TeamTaskDependency,
  TeamTaskActivity,
} from './types';

export interface ITeamProjectsRepository {
  // Projets — getProjects retourne AUSSI les archivés (filtrage côté UI).
  getProjects(orgId: string): Promise<TeamProject[]>;
  createProject(orgId: string, input: CreateTeamProjectInput): Promise<TeamProject>;
  updateProject(projectId: string, input: UpdateTeamProjectInput): Promise<TeamProject>;
  archiveProject(projectId: string): Promise<void>;

  // Tâches d'équipe
  getTasks(orgId: string, filters?: TeamTaskFilters): Promise<TeamTask[]>;
  createTask(orgId: string, input: CreateTeamTaskInput): Promise<TeamTask>;
  updateTask(taskId: string, input: UpdateTeamTaskInput): Promise<TeamTask>;
  deleteTask(taskId: string): Promise<void>;

  // Commentaires (mig. 082) — journal immuable, delete auteur only.
  getComments(taskId: string): Promise<TeamTaskComment[]>;
  addComment(input: CreateTeamTaskCommentInput): Promise<TeamTaskComment>;
  deleteComment(commentId: string): Promise<void>;

  // Sous-tâches (mig. 092)
  getSubtasks(taskId: string): Promise<TeamSubtask[]>;
  createSubtask(input: CreateTeamSubtaskInput): Promise<TeamSubtask>;
  updateSubtask(subtaskId: string, input: UpdateTeamSubtaskInput): Promise<TeamSubtask>;
  deleteSubtask(subtaskId: string): Promise<void>;

  // Labels (mig. 093)
  getLabels(orgId: string): Promise<TeamLabel[]>;
  createLabel(orgId: string, input: CreateTeamLabelInput): Promise<TeamLabel>;
  updateLabel(labelId: string, input: UpdateTeamLabelInput): Promise<TeamLabel>;
  deleteLabel(labelId: string): Promise<void>;
  /** Toutes les jonctions accessibles — une requête pour toute l'org, pas une par tâche. */
  getTaskLabels(orgId: string): Promise<TeamTaskLabel[]>;
  addTaskLabel(taskId: string, labelId: string): Promise<void>;
  removeTaskLabel(taskId: string, labelId: string): Promise<void>;

  // Historique (mig. 094) — lecture seule : la table est append-only, écrite par trigger.
  getTaskActivity(taskId: string): Promise<TeamTaskActivity[]>;
  /**
   * Journal de TOUTE l'organisation depuis `since` (ISO) — revue hebdomadaire
   * (#26). Borné côté serveur : la revue lit deux semaines, pas l'historique.
   */
  getOrgActivity(orgId: string, since: string): Promise<TeamTaskActivity[]>;

  // Dépendances entre tâches (mig. 108) — « bloque / bloqué par ».
  /**
   * Toutes les arêtes accessibles de l'org, en UNE requête (même contrat que
   * `getTaskLabels`) : le chemin critique se calcule sur un projet entier, en
   * charger une par tâche multiplierait les allers-retours par le nombre de
   * cartes affichées.
   */
  getTaskDependencies(orgId: string): Promise<TeamTaskDependency[]>;
  /** `taskId` devient bloquée par `dependsOnId`. */
  addTaskDependency(taskId: string, dependsOnId: string, orgId: string): Promise<void>;
  removeTaskDependency(taskId: string, dependsOnId: string): Promise<void>;
}
