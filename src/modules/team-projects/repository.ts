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
  TeamTaskDependency,
  TeamTaskActivity,
} from './types';
import type { CreateOptions } from '@/lib/restore-id';

/** Options de restauration d'un commentaire (« Annuler » uniquement, C-42). */
export interface RestoreCommentOptions extends CreateOptions {
  /** Horodatage d'origine : sans lui, le commentaire revient a la fin du fil. */
  restoreCreatedAt?: string;
}

export interface ITeamProjectsRepository {
  // Projets — getProjects retourne AUSSI les archivés (filtrage côté UI).
  getProjects(orgId: string): Promise<TeamProject[]>;
  createProject(orgId: string, input: CreateTeamProjectInput): Promise<TeamProject>;
  // Archiver = updateProject({ archived }) : un seul chemin, celui que l'UI
  // emprunte (menu de la carte projet, droit `project.delete`, trigger
  // `enforce_team_project_archive_scope`). Une méthode `archiveProject`
  // dédiée a coexisté sans consommateur jusqu'au 2026-09-04 (C-66).
  updateProject(projectId: string, input: UpdateTeamProjectInput): Promise<TeamProject>;

  // Tâches d'équipe
  getTasks(orgId: string, filters?: TeamTaskFilters): Promise<TeamTask[]>;
  createTask(orgId: string, input: CreateTeamTaskInput): Promise<TeamTask>;
  updateTask(taskId: string, input: UpdateTeamTaskInput): Promise<TeamTask>;
  deleteTask(taskId: string): Promise<void>;

  // Commentaires (mig. 082) — journal immuable, delete auteur only.
  getComments(taskId: string): Promise<TeamTaskComment[]>;
  /**
   * `options` n'est renseigne que par un « Annuler » (C-42). Il porte DEUX
   * champs, et le second est propre a ce cas : un fil de commentaires est
   * ordonne par `createdAt`, donc restaurer sans l'horodatage remettrait le
   * commentaire A LA FIN du fil, apres des reponses qu'il precedait. La
   * conversation serait rendue incomprehensible par le geste cense la reparer.
   *
   * ❌ Les deux passent par ce SECOND argument, jamais par le payload : celui-ci
   *    vient d'un etat de composant (raison complete dans `src/lib/restore-id.ts`).
   * ⚠️ `author_id` reste pose par le SERVEUR depuis la session, comme a la
   *    creation : restaurer ne doit jamais permettre d'ecrire au nom d'un autre.
   */
  addComment(
    input: CreateTeamTaskCommentInput,
    options?: RestoreCommentOptions,
  ): Promise<TeamTaskComment>;
  deleteComment(commentId: string): Promise<void>;

  // Sous-tâches (mig. 092)
  getSubtasks(taskId: string): Promise<TeamSubtask[]>;
  createSubtask(input: CreateTeamSubtaskInput): Promise<TeamSubtask>;
  updateSubtask(subtaskId: string, input: UpdateTeamSubtaskInput): Promise<TeamSubtask>;
  deleteSubtask(subtaskId: string): Promise<void>;

  // 🗑️ Les étiquettes (mig. 093) ont été retirées de cette interface le
  // 2026-09-05 (C-49) : `getLabels`, `createLabel`, `updateLabel`,
  // `deleteLabel`, `getTaskLabels`, `addTaskLabel`, `removeTaskLabel`. Aucun
  // écran ne montait leurs hooks, donc aucun appelant. La TABLE reste en base.

  // Historique (mig. 094) — lecture seule : la table est append-only, écrite par trigger.
  // 🗑️ `getTaskActivity` (journal PAR TÂCHE) retiré le 2026-09-05 (C-49) :
  // sans appelant. `getOrgActivity` ci-dessous sert la revue hebdomadaire.
  /**
   * Journal de TOUTE l'organisation depuis `since` (ISO) — revue hebdomadaire
   * (#26). Borné côté serveur : la revue lit deux semaines, pas l'historique.
   */
  getOrgActivity(orgId: string, since: string): Promise<TeamTaskActivity[]>;

  // Dépendances entre tâches (mig. 108) — « bloque / bloqué par ».
  /**
   * Toutes les arêtes accessibles de l'org, en UNE requête : le chemin
   * critique se calcule sur un projet entier, en charger une par tâche
   * multiplierait les allers-retours par le nombre de cartes affichées.
   *
   * (Ce contrat était partagé avec `getTaskLabels`, retiré le 2026-09-05.)
   */
  getTaskDependencies(orgId: string): Promise<TeamTaskDependency[]>;
  /** `taskId` devient bloquée par `dependsOnId`. */
  addTaskDependency(taskId: string, dependsOnId: string, orgId: string): Promise<void>;
  removeTaskDependency(taskId: string, dependsOnId: string): Promise<void>;
}
