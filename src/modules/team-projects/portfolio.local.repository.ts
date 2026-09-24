// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS · Portefeuille — mode démo (localStorage)
//
// Rejoue les règles des mig. 151, 152 et 155 là où elles changent ce que
// l'écran montre : restauration sous le MÊME identifiant, historique de santé,
// rattachements, suivi. Sans ces miroirs, la démo afficherait un produit que
// la production ne livre pas.
// ═══════════════════════════════════════════════════════════════════

import { readJsonArray, writeJsonOrThrow, readJson } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';
import type { ITeamPortfolioRepository } from './portfolio.repository';
import type {
  CreateProjectFullInput,
  DuplicateProjectInput,
  MyFollows,
  ProjectLinks,
  ProjectUpdate,
  TrashedTask,
} from './portfolio.types';
import type {
  ProjectHealth,
  ProjectRole,
  TeamProject,
  TeamSubtask,
  TeamTask,
  TeamTaskActivity,
  TeamTaskComment,
  TeamTaskDependency,
} from './types';
import {
  TEAM_TASKS_STORAGE_KEY,
  TEAM_TASK_COMMENTS_STORAGE_KEY,
  TEAM_TASK_SUBTASKS_STORAGE_KEY,
  TEAM_TASK_DEPENDENCIES_STORAGE_KEY,
  TEAM_PROJECTS_STORAGE_KEY,
  TEAM_TASK_ACTIVITY_STORAGE_KEY,
} from './constants';
import {
  TEAM_FOLLOWS_STORAGE_KEY,
  TEAM_PROJECT_LINKS_STORAGE_KEY,
  TEAM_PROJECT_UPDATES_STORAGE_KEY,
  readLocalTrash,
  writeLocalTrash,
} from './portfolio.local.store';
import { LocalStorageTeamProjectsRepository } from './local.repository';
import { DEMO_USER_ID } from './demo-seed';

const EMPTY_LINKS: ProjectLinks = { teams: [], members: [] };
const EMPTY_FOLLOWS: MyFollows = { taskIds: [], projectIds: [] };

const addDays = (date: string | null | undefined, days: number): string | null => {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
};

export class LocalStorageTeamPortfolioRepository implements ITeamPortfolioRepository {
  private core = new LocalStorageTeamProjectsRepository();

  private links(): ProjectLinks {
    return readJson<ProjectLinks>(TEAM_PROJECT_LINKS_STORAGE_KEY) ?? { ...EMPTY_LINKS };
  }
  private saveLinks(l: ProjectLinks): void {
    writeJsonOrThrow(TEAM_PROJECT_LINKS_STORAGE_KEY, l);
  }

  async getProjectLinks(_orgId: string): Promise<ProjectLinks> {
    return this.links();
  }

  async addProjectTeam(_orgId: string, projectId: string, teamId: string): Promise<void> {
    const l = this.links();
    if (!l.teams.some((t) => t.projectId === projectId && t.teamId === teamId)) {
      l.teams.push({ projectId, teamId });
      this.saveLinks(l);
    }
  }

  async removeProjectTeam(projectId: string, teamId: string): Promise<void> {
    const l = this.links();
    this.saveLinks({ ...l, teams: l.teams.filter((t) => !(t.projectId === projectId && t.teamId === teamId)) });
  }

  async setProjectMember(_orgId: string, projectId: string, userId: string, role: ProjectRole): Promise<void> {
    const l = this.links();
    const others = l.members.filter((m) => !(m.projectId === projectId && m.userId === userId));
    this.saveLinks({ ...l, members: [...others, { projectId, userId, role }] });
  }

  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    const l = this.links();
    this.saveLinks({ ...l, members: l.members.filter((m) => !(m.projectId === projectId && m.userId === userId)) });
  }

  async getProjectUpdates(projectId: string): Promise<ProjectUpdate[]> {
    return (readJsonArray<ProjectUpdate>(TEAM_PROJECT_UPDATES_STORAGE_KEY) ?? [])
      .filter((u) => u.projectId === projectId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async postProjectUpdate(projectId: string, health: ProjectHealth, note: string): Promise<void> {
    const now = new Date().toISOString();
    const trimmed = note.trim() || null;
    await this.core.getProjects('');
    const projects = readJsonArray<TeamProject>(TEAM_PROJECTS_STORAGE_KEY) ?? [];
    const project = projects.find((p) => p.id === projectId);
    if (!project) throw makeApiError('not_found');
    project.health = health;
    project.healthNote = trimmed;
    project.healthUpdatedAt = now;
    project.healthUpdatedBy = DEMO_USER_ID;
    writeJsonOrThrow(TEAM_PROJECTS_STORAGE_KEY, projects);
    const updates = readJsonArray<ProjectUpdate>(TEAM_PROJECT_UPDATES_STORAGE_KEY) ?? [];
    writeJsonOrThrow(TEAM_PROJECT_UPDATES_STORAGE_KEY, [
      { id: crypto.randomUUID(), projectId, health, note: trimmed, authorId: DEMO_USER_ID, createdAt: now },
      ...updates,
    ]);
  }

  async createProjectFull(orgId: string, input: CreateProjectFullInput): Promise<TeamProject> {
    const project = await this.core.createProject(orgId, input);
    for (const teamId of input.extraTeamIds ?? []) {
      if (teamId !== project.teamId) await this.addProjectTeam(orgId, project.id, teamId);
    }
    for (const m of input.members ?? []) await this.setProjectMember(orgId, project.id, m.userId, m.role);
    for (const t of input.tasks ?? []) {
      await this.core.createTask(orgId, { projectId: project.id, name: t.name, assigneeIds: t.assigneeIds });
    }
    return project;
  }

  async duplicateProject(input: DuplicateProjectInput): Promise<TeamProject> {
    const shift = input.shiftDays ?? 0;
    const all = await this.core.getProjects('');
    const projects = readJsonArray<TeamProject>(TEAM_PROJECTS_STORAGE_KEY) ?? all;
    const src = projects.find((p) => p.id === input.projectId);
    if (!src) throw makeApiError('not_found');
    const copy = await this.core.createProject(src.orgId, {
      name: input.name,
      color: src.color,
      teamId: src.teamId ?? null,
      categoryId: src.categoryId ?? null,
      ownerId: input.keepAssignees ? src.ownerId ?? null : DEMO_USER_ID,
      description: src.description ?? null,
      startDate: addDays(src.startDate, shift),
      targetDate: addDays(src.targetDate, shift),
      status: input.asTemplate ? 'planned' : 'active',
      isTemplate: input.asTemplate ?? false,
    });
    const l = this.links();
    for (const t of l.teams.filter((x) => x.projectId === src.id)) {
      await this.addProjectTeam(src.orgId, copy.id, t.teamId);
    }
    const tasks = await this.core.getTasks(src.orgId, { projectId: src.id });
    const map = new Map<string, string>();
    for (const t of [...tasks].reverse()) {
      const created = await this.core.createTask(src.orgId, {
        projectId: copy.id,
        name: t.name,
        description: t.description,
        priority: t.priority,
        deadline: addDays(t.deadline, shift) ?? '',
        startDate: addDays(t.startDate, shift) ?? '',
        estimatedTime: t.estimatedTime,
        assigneeIds: input.keepAssignees ? t.assigneeIds : [],
        categoryId: t.categoryId ?? null,
        isMilestone: t.isMilestone ?? false,
      });
      map.set(t.id, created.id);
      for (const s of await this.core.getSubtasks(t.id)) {
        await this.core.createSubtask({ taskId: created.id, title: s.title, position: s.position });
      }
    }
    for (const d of await this.core.getTaskDependencies(src.orgId)) {
      const a = map.get(d.taskId);
      const b = map.get(d.dependsOnId);
      if (a && b) await this.core.addTaskDependency(a, b, src.orgId);
    }
    return copy;
  }

  async getTrash(orgId: string): Promise<TrashedTask[]> {
    return readLocalTrash()
      .filter((e) => e.task.orgId === orgId)
      .map((e) => ({
        taskId: e.task.id,
        projectId: e.task.projectId,
        name: e.task.name,
        deletedBy: e.deletedBy,
        deletedAt: e.deletedAt,
      }));
  }

  async restoreTask(taskId: string): Promise<void> {
    const trash = readLocalTrash();
    const entry = trash.find((e) => e.task.id === taskId);
    if (!entry) throw makeApiError('not_found');
    // Force le semis des tableaux avant d'y réinsérer (un tableau jamais lu
    // est absent du stockage, et l'écrire tel quel effacerait les données de démo).
    await this.core.getTasks(entry.task.orgId);
    await this.core.getSubtasks(taskId);
    await this.core.getComments(taskId);
    await this.core.getTaskDependencies(entry.task.orgId);

    const tasks = readJsonArray<TeamTask>(TEAM_TASKS_STORAGE_KEY) ?? [];
    writeJsonOrThrow(TEAM_TASKS_STORAGE_KEY, [entry.task, ...tasks.filter((t) => t.id !== taskId)]);
    const subtasks = readJsonArray<TeamSubtask>(TEAM_TASK_SUBTASKS_STORAGE_KEY) ?? [];
    writeJsonOrThrow(TEAM_TASK_SUBTASKS_STORAGE_KEY, [...subtasks, ...entry.subtasks]);
    const comments = readJsonArray<TeamTaskComment>(TEAM_TASK_COMMENTS_STORAGE_KEY) ?? [];
    writeJsonOrThrow(TEAM_TASK_COMMENTS_STORAGE_KEY, [...comments, ...entry.comments]);
    const ids = new Set([...tasks.map((t) => t.id), taskId]);
    const deps = readJsonArray<TeamTaskDependency>(TEAM_TASK_DEPENDENCIES_STORAGE_KEY) ?? [];
    writeJsonOrThrow(TEAM_TASK_DEPENDENCIES_STORAGE_KEY, [
      ...deps,
      ...entry.dependencies.filter((d) => ids.has(d.taskId) && ids.has(d.dependsOnId)),
    ]);
    writeLocalTrash(trash.filter((e) => e.task.id !== taskId));
  }

  async getTaskActivity(taskId: string): Promise<TeamTaskActivity[]> {
    return (readJsonArray<TeamTaskActivity>(TEAM_TASK_ACTIVITY_STORAGE_KEY) ?? [])
      .filter((a) => a.taskId === taskId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  private follows(): MyFollows {
    return readJson<MyFollows>(TEAM_FOLLOWS_STORAGE_KEY) ?? { ...EMPTY_FOLLOWS };
  }

  async getMyFollows(_orgId: string): Promise<MyFollows> {
    return this.follows();
  }

  async setTaskFollow(_orgId: string, taskId: string, follow: boolean): Promise<void> {
    const f = this.follows();
    const taskIds = f.taskIds.filter((id) => id !== taskId);
    writeJsonOrThrow(TEAM_FOLLOWS_STORAGE_KEY, { ...f, taskIds: follow ? [...taskIds, taskId] : taskIds });
  }

  async setProjectFollow(_orgId: string, projectId: string, follow: boolean): Promise<void> {
    const f = this.follows();
    const projectIds = f.projectIds.filter((id) => id !== projectId);
    writeJsonOrThrow(TEAM_FOLLOWS_STORAGE_KEY, { ...f, projectIds: follow ? [...projectIds, projectId] : projectIds });
  }
}
