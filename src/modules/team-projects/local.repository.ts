// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS MODULE - LocalStorage Repository (mode démo)
// ═══════════════════════════════════════════════════════════════════
//
// Ce fichier LIT et ÉCRIT. Les données de démonstration elles-mêmes vivent
// dans `demo-seed.ts` depuis le 2026-09-05 : elles y occupaient 278 lignes
// sur 712, et un jeu de données n'est pas un repository.

import type { RestoreCommentOptions } from './repository';
import { ITeamProjectsRepository } from './repository';
import {
  TeamProject,
  CreateTeamProjectInput,
  UpdateTeamProjectInput,
  TeamTask,
  CreateTeamTaskInput,
  UpdateTeamTaskInput,
  TeamTaskFilters,
  TeamTaskComment,
  TeamSubtask,
  CreateTeamSubtaskInput,
  UpdateTeamSubtaskInput,
  TeamLabel,
  CreateTeamLabelInput,
  UpdateTeamLabelInput,
  TeamTaskLabel,
  TeamTaskActivity,
  TeamTaskDependency,
  CreateTeamTaskCommentInput,
} from './types';
import {
  TEAM_PROJECTS_STORAGE_KEY, TEAM_TASKS_STORAGE_KEY, TEAM_TASK_COMMENTS_STORAGE_KEY,
  TEAM_TASK_SUBTASKS_STORAGE_KEY,
  TEAM_LABELS_STORAGE_KEY,
  TEAM_TASK_LABELS_STORAGE_KEY,
  TEAM_TASK_ACTIVITY_STORAGE_KEY,
  TEAM_TASK_DEPENDENCIES_STORAGE_KEY,
} from './constants';
import { localizeSeed } from '@/lib/seed-i18n';
import { DEPENDENCY_ERRORS, makeDependencyError } from '@/modules/tasks/dependency-errors';
import { safeGetItem, safeSetItem, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';
// Les jeux de démonstration vivent dans `demo-seed.ts` : un jeu de données
// n'est pas un repository, et il occupait ici 278 lignes sur 712.
import {
  DEMO_USER_ID,
  DEMO_PROJECTS, DEMO_PROJECTS_EN,
  DEMO_TASKS, DEMO_TASKS_EN,
  DEMO_COMMENTS, DEMO_COMMENTS_EN,
  DEMO_SUBTASKS, DEMO_SUBTASKS_EN,
  DEMO_LABELS, DEMO_LABELS_EN,
  DEMO_TASK_LABELS,
  DEMO_ACTIVITY,
  DEMO_TASK_DEPENDENCIES,
} from './demo-seed';

function readOrSeed<T>(key: string, seed: T): T {
  const data = safeGetItem(key);
  if (!data) {
    const clone = JSON.parse(JSON.stringify(seed)) as T;
    safeSetItem(key, JSON.stringify(clone));
    return clone;
  }
  try {
    return JSON.parse(data) as T;
  } catch {
    const clone = JSON.parse(JSON.stringify(seed)) as T;
    safeSetItem(key, JSON.stringify(clone));
    return clone;
  }
}

export class LocalStorageTeamProjectsRepository implements ITeamProjectsRepository {
  private getProjectsArray(): TeamProject[] {
    return readOrSeed<TeamProject[]>(TEAM_PROJECTS_STORAGE_KEY, localizeSeed(DEMO_PROJECTS, DEMO_PROJECTS_EN));
  }
  private saveProjects(p: TeamProject[]): void {
    writeJsonOrThrow(TEAM_PROJECTS_STORAGE_KEY, p);
  }
  private getTasksArray(): TeamTask[] {
    // Migration douce du localStorage antérieur à la multi-assignation
    // (mig. 072) : les tâches seedées/écrites avant portaient `assigneeId`
    // (singulier) et pas `assigneeIds`. Sans ce coercion, tout consommateur
    // qui itère `assigneeIds` (kanban, contributeurs, to-do) planterait sur
    // `undefined`. On dérive le tableau du champ legacy s'il existe.
    return readOrSeed<TeamTask[]>(TEAM_TASKS_STORAGE_KEY, localizeSeed(DEMO_TASKS, DEMO_TASKS_EN)).map((t) => {
      if (Array.isArray(t.assigneeIds)) return t;
      const legacy = (t as TeamTask & { assigneeId?: string | null }).assigneeId;
      return { ...t, assigneeIds: legacy ? [legacy] : [] };
    });
  }
  private saveTasks(tks: TeamTask[]): void {
    writeJsonOrThrow(TEAM_TASKS_STORAGE_KEY, tks);
  }

  async getProjects(orgId: string): Promise<TeamProject[]> {
    // Archivés inclus — le filtrage actif/archivé se fait côté UI.
    return this.getProjectsArray().filter((p) => p.orgId === orgId);
  }

  async createProject(orgId: string, input: CreateTeamProjectInput): Promise<TeamProject> {
    const projects = this.getProjectsArray();
    const project: TeamProject = {
      id: crypto.randomUUID(),
      orgId,
      name: input.name,
      color: input.color ?? 'blue',
      createdBy: DEMO_USER_ID,
      archivedAt: null,
      createdAt: new Date().toISOString(),
      teamId: input.teamId ?? null,
      categoryId: input.categoryId ?? null,
    };
    this.saveProjects([...projects, project]);
    return project;
  }

  async updateProject(projectId: string, input: UpdateTeamProjectInput): Promise<TeamProject> {
    const projects = this.getProjectsArray();
    const p = projects.find((x) => x.id === projectId);
    if (!p) throw makeApiError('not_found');
    if (input.name !== undefined) p.name = input.name;
    if (input.color !== undefined) p.color = input.color;
    if (input.teamId !== undefined) p.teamId = input.teamId;
    if (input.categoryId !== undefined) p.categoryId = input.categoryId;
    if (input.archived !== undefined) p.archivedAt = input.archived ? new Date().toISOString() : null;
    this.saveProjects(projects);
    return p;
  }

  async getTasks(orgId: string, filters?: TeamTaskFilters): Promise<TeamTask[]> {
    return this.getTasksArray().filter((tk) => {
      if (tk.orgId !== orgId) return false;
      if (filters?.projectId && tk.projectId !== filters.projectId) return false;
      if (filters?.assigneeId && !tk.assigneeIds.includes(filters.assigneeId)) return false;
      if (filters?.completed !== undefined && tk.completed !== filters.completed) return false;
      return true;
    });
  }

  async createTask(orgId: string, input: CreateTeamTaskInput): Promise<TeamTask> {
    const tasks = this.getTasksArray();
    const now = new Date().toISOString();
    const task: TeamTask = {
      id: crypto.randomUUID(),
      orgId,
      projectId: input.projectId,
      name: input.name,
      description: input.description,
      priority: input.priority ?? 3,
      deadline: input.deadline ?? '',
      estimatedTime: input.estimatedTime,
      assigneeIds: input.assigneeIds ?? [],
      createdBy: DEMO_USER_ID,
      completed: false,
      status: input.status ?? 'todo',
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      categoryId: input.categoryId ?? null,
    };
    this.saveTasks([task, ...tasks]);
    return task;
  }

  async updateTask(taskId: string, input: UpdateTeamTaskInput): Promise<TeamTask> {
    const tasks = this.getTasksArray();
    const task = tasks.find((x) => x.id === taskId);
    if (!task) throw makeApiError('not_found');
    if (input.name !== undefined) task.name = input.name;
    if (input.description !== undefined) task.description = input.description;
    if (input.priority !== undefined) task.priority = input.priority;
    if (input.deadline !== undefined) task.deadline = input.deadline;
    if (input.estimatedTime !== undefined) task.estimatedTime = input.estimatedTime;
    if (input.assigneeIds !== undefined) task.assigneeIds = input.assigneeIds;
    if (input.projectId !== undefined) task.projectId = input.projectId;
    if (input.categoryId !== undefined) task.categoryId = input.categoryId;
    // Reproduit le trigger `sync_team_task_status` de la mig. 091 : sans cette
    // symétrie, le mode démo divergerait de la production dès qu'un statut est
    // changé, et le kanban afficherait deux vérités différentes selon le mode.
    if (input.status !== undefined) {
      task.status = input.status;
      if (input.status === 'done') {
        task.completed = true;
        task.completedAt = task.completedAt ?? new Date().toISOString();
      } else {
        task.completed = false;
        task.completedAt = null;
      }
    } else if (input.completed !== undefined) {
      task.completed = input.completed;
      task.status = input.completed ? 'done' : 'todo';
      task.completedAt = input.completed ? new Date().toISOString() : null;
    }
    task.updatedAt = new Date().toISOString();
    this.saveTasks(tasks);
    return task;
  }

  async deleteTask(taskId: string): Promise<void> {
    this.saveTasks(this.getTasksArray().filter((x) => x.id !== taskId));
  }

  // ─── Commentaires (mig. 082) ───────────────────────────────────────

  private getCommentsArray(): TeamTaskComment[] {
    return readOrSeed<TeamTaskComment[]>(TEAM_TASK_COMMENTS_STORAGE_KEY, localizeSeed(DEMO_COMMENTS, DEMO_COMMENTS_EN));
  }
  private saveComments(c: TeamTaskComment[]): void {
    writeJsonOrThrow(TEAM_TASK_COMMENTS_STORAGE_KEY, c);
  }

  async getComments(taskId: string): Promise<TeamTaskComment[]> {
    return this.getCommentsArray()
      .filter((c) => c.taskId === taskId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }

  async addComment(
    input: CreateTeamTaskCommentInput,
    options?: RestoreCommentOptions,
  ): Promise<TeamTaskComment> {
    // Parite avec le depot Supabase : les deux champs de restauration viennent
    // d'un SECOND argument reserve aux « Annuler », jamais du payload (C-42).
    const comment: TeamTaskComment = {
      id: options?.restoreId ?? `comment-${Date.now()}`,
      taskId: input.taskId,
      authorId: DEMO_USER_ID,
      body: input.body,
      mentions: input.mentions ?? [],
      createdAt: options?.restoreCreatedAt ?? new Date().toISOString(),
    };
    this.saveComments([...this.getCommentsArray(), comment]);
    return comment;
  }

  async deleteComment(commentId: string): Promise<void> {
    // Auteur only (miroir de la RLS) — en démo, seul demo-user écrit.
    this.saveComments(this.getCommentsArray().filter((c) => c.id !== commentId));
  }

  // ─── Sous-tâches (mig. 092) ────────────────────────────────────────

  private getSubtasksArray(): TeamSubtask[] {
    return readOrSeed<TeamSubtask[]>(TEAM_TASK_SUBTASKS_STORAGE_KEY, localizeSeed(DEMO_SUBTASKS, DEMO_SUBTASKS_EN));
  }
  private saveSubtasks(s: TeamSubtask[]): void {
    writeJsonOrThrow(TEAM_TASK_SUBTASKS_STORAGE_KEY, s);
  }

  async getSubtasks(taskId: string): Promise<TeamSubtask[]> {
    // Même ordre que la requête Supabase (position, puis création) : la démo
    // et la prod doivent afficher la liste identiquement.
    return this.getSubtasksArray()
      .filter((s) => s.taskId === taskId)
      .sort((a, b) => a.position - b.position || (a.createdAt < b.createdAt ? -1 : 1));
  }

  async createSubtask(input: CreateTeamSubtaskInput): Promise<TeamSubtask> {
    const all = this.getSubtasksArray();
    const subtask: TeamSubtask = {
      id: crypto.randomUUID(),
      taskId: input.taskId,
      title: input.title,
      completed: false,
      position: input.position ?? all.filter((s) => s.taskId === input.taskId).length,
      createdBy: DEMO_USER_ID,
      createdAt: new Date().toISOString(),
    };
    this.saveSubtasks([...all, subtask]);
    return subtask;
  }

  async updateSubtask(subtaskId: string, input: UpdateTeamSubtaskInput): Promise<TeamSubtask> {
    const all = this.getSubtasksArray();
    const subtask = all.find((s) => s.id === subtaskId);
    if (!subtask) throw makeApiError('not_found');
    if (input.title !== undefined) subtask.title = input.title;
    if (input.completed !== undefined) subtask.completed = input.completed;
    if (input.position !== undefined) subtask.position = input.position;
    this.saveSubtasks(all);
    return subtask;
  }

  async deleteSubtask(subtaskId: string): Promise<void> {
    this.saveSubtasks(this.getSubtasksArray().filter((s) => s.id !== subtaskId));
  }

  // ─── Labels (mig. 093) ─────────────────────────────────────────────

  private getLabelsArray(): TeamLabel[] {
    return readOrSeed<TeamLabel[]>(TEAM_LABELS_STORAGE_KEY, localizeSeed(DEMO_LABELS, DEMO_LABELS_EN));
  }
  private saveLabels(l: TeamLabel[]): void {
    writeJsonOrThrow(TEAM_LABELS_STORAGE_KEY, l);
  }
  private getTaskLabelsArray(): TeamTaskLabel[] {
    return readOrSeed<TeamTaskLabel[]>(TEAM_TASK_LABELS_STORAGE_KEY, DEMO_TASK_LABELS);
  }
  private saveTaskLabels(tl: TeamTaskLabel[]): void {
    writeJsonOrThrow(TEAM_TASK_LABELS_STORAGE_KEY, tl);
  }

  async getLabels(_orgId: string): Promise<TeamLabel[]> {
    return [...this.getLabelsArray()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async createLabel(orgId: string, input: CreateTeamLabelInput): Promise<TeamLabel> {
    const all = this.getLabelsArray();
    // Miroir de l'index unique insensible à la casse (mig. 093) : sans lui, la
    // démo accepterait « bug » et « Bug » là où la prod renverrait une erreur.
    const wanted = input.name.trim().toLowerCase();
    if (all.some((l) => l.name.trim().toLowerCase() === wanted)) {
      throw makeApiError('duplicate_label');
    }
    const label: TeamLabel = {
      id: crypto.randomUUID(),
      orgId,
      name: input.name.trim(),
      color: input.color ?? '#6366f1',
      createdBy: DEMO_USER_ID,
      createdAt: new Date().toISOString(),
    };
    this.saveLabels([...all, label]);
    return label;
  }

  async updateLabel(labelId: string, input: UpdateTeamLabelInput): Promise<TeamLabel> {
    const all = this.getLabelsArray();
    const label = all.find((l) => l.id === labelId);
    if (!label) throw makeApiError('not_found');
    if (input.name !== undefined) label.name = input.name.trim();
    if (input.color !== undefined) label.color = input.color;
    this.saveLabels(all);
    return label;
  }

  async deleteLabel(labelId: string): Promise<void> {
    this.saveLabels(this.getLabelsArray().filter((l) => l.id !== labelId));
    // Miroir du ON DELETE CASCADE de la jonction.
    this.saveTaskLabels(this.getTaskLabelsArray().filter((tl) => tl.labelId !== labelId));
  }

  async getTaskLabels(_orgId: string): Promise<TeamTaskLabel[]> {
    return this.getTaskLabelsArray();
  }

  async addTaskLabel(taskId: string, labelId: string): Promise<void> {
    const all = this.getTaskLabelsArray();
    // Miroir de la PK composite : poser deux fois le même label est un no-op.
    if (all.some((tl) => tl.taskId === taskId && tl.labelId === labelId)) return;
    this.saveTaskLabels([...all, { taskId, labelId }]);
  }

  async removeTaskLabel(taskId: string, labelId: string): Promise<void> {
    this.saveTaskLabels(
      this.getTaskLabelsArray().filter((tl) => !(tl.taskId === taskId && tl.labelId === labelId)),
    );
  }

  // ─── Historique (mig. 094) ─────────────────────────────────────────

  /**
   * En production, ce journal est écrit par un trigger. En démo il n'y a pas
   * de base : on renvoie ce qui a été semé, sans jamais l'écrire depuis l'UI —
   * c'est ce qui garde la même propriété append-only des deux côtés.
   */
  async getTaskActivity(taskId: string): Promise<TeamTaskActivity[]> {
    return readOrSeed<TeamTaskActivity[]>(TEAM_TASK_ACTIVITY_STORAGE_KEY, DEMO_ACTIVITY)
      .filter((a) => a.taskId === taskId)
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  }

  /** Même contrat qu'en production : borné à l'org et à la fenêtre demandée. */
  async getOrgActivity(orgId: string, since: string): Promise<TeamTaskActivity[]> {
    return readOrSeed<TeamTaskActivity[]>(TEAM_TASK_ACTIVITY_STORAGE_KEY, DEMO_ACTIVITY)
      .filter((a) => a.orgId === orgId && a.createdAt >= since)
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  }

  // ─── Dépendances (mig. 108) ────────────────────────────────────────

  private getDependenciesArray(): TeamTaskDependency[] {
    return readOrSeed<TeamTaskDependency[]>(
      TEAM_TASK_DEPENDENCIES_STORAGE_KEY,
      DEMO_TASK_DEPENDENCIES,
    );
  }

  private saveDependencies(deps: TeamTaskDependency[]): void {
    writeJsonOrThrow(TEAM_TASK_DEPENDENCIES_STORAGE_KEY, deps);
  }

  async getTaskDependencies(_orgId: string): Promise<TeamTaskDependency[]> {
    return this.getDependenciesArray();
  }

  /**
   * Rejoue les DEUX gardes que la base applique par trigger (mig. 108) :
   * même projet, et pas de cycle. Sans elles, la démo laisserait construire un
   * graphe que la production refuserait — et le chemin critique se calculerait
   * sur une donnée impossible.
   */
  async addTaskDependency(taskId: string, dependsOnId: string, _orgId: string): Promise<void> {
    // C-48 — identifiants catalogues, pas des phrases anglaises. Une
    // auto-dependance EST un cycle de longueur 1.
    if (taskId === dependsOnId) throw makeDependencyError(DEPENDENCY_ERRORS.cycle);

    const deps = this.getDependenciesArray();
    if (deps.some((d) => d.taskId === taskId && d.dependsOnId === dependsOnId)) return;

    const tasks = this.getTasksArray();
    const target = tasks.find((t) => t.id === taskId);
    const blocker = tasks.find((t) => t.id === dependsOnId);
    if (!target || !blocker) throw makeDependencyError(DEPENDENCY_ERRORS.taskMissing);
    if (target.projectId !== blocker.projectId) {
      throw makeDependencyError(DEPENDENCY_ERRORS.crossProject);
    }

    // Remonte les bloquantes de `dependsOnId` : atteindre `taskId` = cycle.
    const seen = new Set<string>();
    let frontier = [dependsOnId];
    for (let depth = 0; depth < 200 && frontier.length > 0; depth++) {
      const next: string[] = [];
      for (const id of frontier) {
        if (id === taskId) throw makeDependencyError(DEPENDENCY_ERRORS.cycle);
        if (seen.has(id)) continue;
        seen.add(id);
        for (const d of deps) if (d.taskId === id) next.push(d.dependsOnId);
      }
      frontier = next;
    }

    this.saveDependencies([...deps, { taskId, dependsOnId }]);
  }

  async removeTaskDependency(taskId: string, dependsOnId: string): Promise<void> {
    this.saveDependencies(
      this.getDependenciesArray().filter(
        (d) => !(d.taskId === taskId && d.dependsOnId === dependsOnId),
      ),
    );
  }
}
