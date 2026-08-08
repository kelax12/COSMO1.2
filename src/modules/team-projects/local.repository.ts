// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS MODULE - LocalStorage Repository (mode démo)
// ═══════════════════════════════════════════════════════════════════
//
// Seeds déterministes (pas de Math.random()) : 3 projets, ~20 tâches
// réparties/assignées aux 6 membres de « Nova Studio », dates relatives.
// Rechargées à chaque loginDemo() (sweep cosmo_* de clearDemoStorage).

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
  CreateTeamTaskCommentInput,
} from './types';
import {
  TEAM_PROJECTS_STORAGE_KEY, TEAM_TASKS_STORAGE_KEY, TEAM_TASK_COMMENTS_STORAGE_KEY,
  TEAM_TASK_SUBTASKS_STORAGE_KEY,
  TEAM_LABELS_STORAGE_KEY,
  TEAM_TASK_LABELS_STORAGE_KEY,
  TEAM_TASK_ACTIVITY_STORAGE_KEY,
} from './constants';

const DEMO_ORG_ID = 'org-demo-1';
const DEMO_USER_ID = 'demo-user';

const DAY = 24 * 60 * 60 * 1000;
// Date locale 'YYYY-MM-DD' décalée de `offset` jours (déterministe).
const dateStr = (offset: number): string =>
  new Date(Date.now() + offset * DAY).toLocaleDateString('en-CA');
const iso = (offset: number): string => new Date(Date.now() + offset * DAY).toISOString();

const MEMBERS = ['demo-user', 'friend-1', 'friend-2', 'friend-3', 'user-lucas', 'user-camille'];

// Cloisonnement (v2, 1d) : Refonte → équipe Dev, Lancement → équipe Design,
// Interne → projet d'ORG (team_id null, visible par toute l'entreprise).
const DEMO_PROJECTS: TeamProject[] = [
  { id: 'tproj-1', orgId: DEMO_ORG_ID, name: 'Refonte du site', color: 'blue', createdBy: DEMO_USER_ID, archivedAt: null, createdAt: iso(-40), teamId: 'team-dev' },
  { id: 'tproj-2', orgId: DEMO_ORG_ID, name: 'Lancement produit', color: 'purple', createdBy: DEMO_USER_ID, archivedAt: null, createdAt: iso(-25), teamId: 'team-design' },
  { id: 'tproj-3', orgId: DEMO_ORG_ID, name: 'Interne', color: 'green', createdBy: 'friend-1', archivedAt: null, createdAt: iso(-15), teamId: null },
];

// Fabrique une tâche seed déterministe. Une tâche sur quatre reçoit un
// second assigné (démonstration de la multi-assignation).
let seq = 0;
const t = (
  projectId: string,
  name: string,
  assigneeIdx: number,
  priority: number,
  deadlineOffset: number | null,
  completed: boolean,
): TeamTask => {
  seq += 1;
  const assigneeIds = [MEMBERS[assigneeIdx % MEMBERS.length]];
  if (seq % 4 === 0) {
    const second = MEMBERS[(assigneeIdx + 1) % MEMBERS.length];
    if (!assigneeIds.includes(second)) assigneeIds.push(second);
  }
  return {
    id: `ttask-${seq}`,
    status: completed ? 'done' : 'todo',
    orgId: DEMO_ORG_ID,
    projectId,
    name,
    priority,
    deadline: deadlineOffset === null ? '' : dateStr(deadlineOffset),
    estimatedTime: 30 + (seq % 4) * 15,
    assigneeIds,
    createdBy: DEMO_USER_ID,
    completed,
    completedAt: completed ? iso(-2) : null,
    createdAt: iso(-30 + seq),
    updatedAt: iso(-1),
  };
};

const DEMO_TASKS: TeamTask[] = [
  // Refonte du site
  t('tproj-1', 'Maquettes de la page d\'accueil', 1, 4, 3, false),
  t('tproj-1', 'Intégration du header responsive', 2, 3, 5, false),
  t('tproj-1', 'Audit accessibilité WCAG', 3, 4, -1, false),
  t('tproj-1', 'Optimisation des images', 4, 2, 8, false),
  t('tproj-1', 'Rédaction des contenus SEO', 5, 3, 2, false),
  t('tproj-1', 'Charte graphique validée', 1, 3, -5, true),
  t('tproj-1', 'Setup analytics', 2, 2, 10, false),
  // Lancement produit
  t('tproj-2', 'Plan de communication', 0, 5, 1, false),
  t('tproj-2', 'Kit presse', 5, 3, 4, false),
  t('tproj-2', 'Préparer la démo investisseurs', 1, 5, -2, false),
  t('tproj-2', 'Landing page de teasing', 2, 4, 6, false),
  t('tproj-2', 'Campagne réseaux sociaux', 3, 3, 7, false),
  t('tproj-2', 'Brief agence vidéo', 4, 2, -3, true),
  t('tproj-2', 'Liste des early adopters', 5, 3, 9, false),
  // Interne
  t('tproj-3', 'Onboarding nouveaux arrivants', 1, 3, 5, false),
  t('tproj-3', 'Mise à jour du wiki', 4, 1, 12, false),
  t('tproj-3', 'Rétrospective sprint', 0, 2, 1, false),
  t('tproj-3', 'Budget prévisionnel Q3', 3, 4, -1, false),
  t('tproj-3', 'Commande matériel', 2, 2, 3, true),
  t('tproj-3', 'Planifier le séminaire', 5, 3, 14, false),
];

// Commentaires seed (mig. 082) — fil de discussion réaliste sur 2 tâches.
/**
 * Labels de démo — la fonctionnalité doit se montrer, pas se deviner. Un
 * vocabulaire vide donnerait l'impression d'un écran cassé au premier essai.
 */
const DEMO_LABELS: TeamLabel[] = [
  { id: 'lbl-bug', orgId: DEMO_ORG_ID, name: 'Bug', color: '#ef4444', createdBy: DEMO_USER_ID, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'lbl-client', orgId: DEMO_ORG_ID, name: 'Client', color: '#0ea5e9', createdBy: DEMO_USER_ID, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'lbl-urgent', orgId: DEMO_ORG_ID, name: 'Urgent', color: '#f59e0b', createdBy: DEMO_USER_ID, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'lbl-tech', orgId: DEMO_ORG_ID, name: 'Technique', color: '#8b5cf6', createdBy: DEMO_USER_ID, createdAt: '2026-01-01T00:00:00Z' },
];

const DEMO_COMMENTS: TeamTaskComment[] = [
  { id: 'comment-seed-1', taskId: 'ttask-1', authorId: 'friend-1', body: 'Premier jet des maquettes déposé sur Figma — retours bienvenus !', mentions: [], createdAt: iso(-4) },
  { id: 'comment-seed-2', taskId: 'ttask-1', authorId: DEMO_USER_ID, body: '@Marie Dupont super base, je préfère la variante B pour le hero.', mentions: ['friend-1'], createdAt: iso(-3) },
  { id: 'comment-seed-3', taskId: 'ttask-8', authorId: 'friend-2', body: 'Le planning presse est calé, reste à valider le budget.', mentions: [], createdAt: iso(-2) },
];

function readOrSeed<T>(key: string, seed: T): T {
  const data = localStorage.getItem(key);
  if (!data) {
    const clone = JSON.parse(JSON.stringify(seed)) as T;
    localStorage.setItem(key, JSON.stringify(clone));
    return clone;
  }
  try {
    return JSON.parse(data) as T;
  } catch {
    const clone = JSON.parse(JSON.stringify(seed)) as T;
    localStorage.setItem(key, JSON.stringify(clone));
    return clone;
  }
}

export class LocalStorageTeamProjectsRepository implements ITeamProjectsRepository {
  private getProjectsArray(): TeamProject[] {
    return readOrSeed<TeamProject[]>(TEAM_PROJECTS_STORAGE_KEY, DEMO_PROJECTS);
  }
  private saveProjects(p: TeamProject[]): void {
    localStorage.setItem(TEAM_PROJECTS_STORAGE_KEY, JSON.stringify(p));
  }
  private getTasksArray(): TeamTask[] {
    // Migration douce du localStorage antérieur à la multi-assignation
    // (mig. 072) : les tâches seedées/écrites avant portaient `assigneeId`
    // (singulier) et pas `assigneeIds`. Sans ce coercion, tout consommateur
    // qui itère `assigneeIds` (kanban, contributeurs, to-do) planterait sur
    // `undefined`. On dérive le tableau du champ legacy s'il existe.
    return readOrSeed<TeamTask[]>(TEAM_TASKS_STORAGE_KEY, DEMO_TASKS).map((t) => {
      if (Array.isArray(t.assigneeIds)) return t;
      const legacy = (t as TeamTask & { assigneeId?: string | null }).assigneeId;
      return { ...t, assigneeIds: legacy ? [legacy] : [] };
    });
  }
  private saveTasks(tks: TeamTask[]): void {
    localStorage.setItem(TEAM_TASKS_STORAGE_KEY, JSON.stringify(tks));
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
    };
    this.saveProjects([...projects, project]);
    return project;
  }

  async updateProject(projectId: string, input: UpdateTeamProjectInput): Promise<TeamProject> {
    const projects = this.getProjectsArray();
    const p = projects.find((x) => x.id === projectId);
    if (!p) throw new Error('Projet introuvable');
    if (input.name !== undefined) p.name = input.name;
    if (input.color !== undefined) p.color = input.color;
    if (input.teamId !== undefined) p.teamId = input.teamId;
    if (input.archived !== undefined) p.archivedAt = input.archived ? new Date().toISOString() : null;
    this.saveProjects(projects);
    return p;
  }

  async archiveProject(projectId: string): Promise<void> {
    const projects = this.getProjectsArray();
    const p = projects.find((x) => x.id === projectId);
    if (p) {
      p.archivedAt = new Date().toISOString();
      this.saveProjects(projects);
    }
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
    };
    this.saveTasks([task, ...tasks]);
    return task;
  }

  async updateTask(taskId: string, input: UpdateTeamTaskInput): Promise<TeamTask> {
    const tasks = this.getTasksArray();
    const task = tasks.find((x) => x.id === taskId);
    if (!task) throw new Error('Tâche introuvable');
    if (input.name !== undefined) task.name = input.name;
    if (input.description !== undefined) task.description = input.description;
    if (input.priority !== undefined) task.priority = input.priority;
    if (input.deadline !== undefined) task.deadline = input.deadline;
    if (input.estimatedTime !== undefined) task.estimatedTime = input.estimatedTime;
    if (input.assigneeIds !== undefined) task.assigneeIds = input.assigneeIds;
    if (input.projectId !== undefined) task.projectId = input.projectId;
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
    return readOrSeed<TeamTaskComment[]>(TEAM_TASK_COMMENTS_STORAGE_KEY, DEMO_COMMENTS);
  }
  private saveComments(c: TeamTaskComment[]): void {
    localStorage.setItem(TEAM_TASK_COMMENTS_STORAGE_KEY, JSON.stringify(c));
  }

  async getComments(taskId: string): Promise<TeamTaskComment[]> {
    return this.getCommentsArray()
      .filter((c) => c.taskId === taskId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }

  async addComment(input: CreateTeamTaskCommentInput): Promise<TeamTaskComment> {
    const comment: TeamTaskComment = {
      id: `comment-${Date.now()}`,
      taskId: input.taskId,
      authorId: DEMO_USER_ID,
      body: input.body,
      mentions: input.mentions ?? [],
      createdAt: new Date().toISOString(),
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
    return readOrSeed<TeamSubtask[]>(TEAM_TASK_SUBTASKS_STORAGE_KEY, []);
  }
  private saveSubtasks(s: TeamSubtask[]): void {
    localStorage.setItem(TEAM_TASK_SUBTASKS_STORAGE_KEY, JSON.stringify(s));
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
    if (!subtask) throw new Error('Sous-tâche introuvable');
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
    return readOrSeed<TeamLabel[]>(TEAM_LABELS_STORAGE_KEY, DEMO_LABELS);
  }
  private saveLabels(l: TeamLabel[]): void {
    localStorage.setItem(TEAM_LABELS_STORAGE_KEY, JSON.stringify(l));
  }
  private getTaskLabelsArray(): TeamTaskLabel[] {
    return readOrSeed<TeamTaskLabel[]>(TEAM_TASK_LABELS_STORAGE_KEY, []);
  }
  private saveTaskLabels(tl: TeamTaskLabel[]): void {
    localStorage.setItem(TEAM_TASK_LABELS_STORAGE_KEY, JSON.stringify(tl));
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
      throw new Error('Ce label existe déjà');
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
    if (!label) throw new Error('Label introuvable');
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
    return readOrSeed<TeamTaskActivity[]>(TEAM_TASK_ACTIVITY_STORAGE_KEY, [])
      .filter((a) => a.taskId === taskId)
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  }
}
