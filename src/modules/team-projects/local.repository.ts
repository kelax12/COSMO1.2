// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS MODULE - LocalStorage Repository (mode démo)
// ═══════════════════════════════════════════════════════════════════
//
// Seeds déterministes (pas de Math.random()) : 3 projets, ~20 tâches
// réparties/assignées aux 6 membres de « Nova Studio », dates relatives.
// Rechargées à chaque loginDemo() (sweep cosmo_* de clearDemoStorage).

import type { RestoreCommentOptions } from './repository';
import { ITeamProjectsRepository } from './repository';
import {
  TeamProject,
  CreateTeamProjectInput,
  UpdateTeamProjectInput,
  TeamTask,
  TeamTaskStatus,
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
  TeamActivityField,
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

// Overlay anglais — cf. src/lib/seed-i18n.ts.
const DEMO_PROJECTS_EN: Record<string, Partial<TeamProject>> = {
  'tproj-1': { name: 'Website redesign' },
  'tproj-2': { name: 'Product launch' },
  'tproj-3': { name: 'Internal' },
};

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
  /**
   * Statut de flux (mig. 091). Les seeds ne produisaient que `todo` et `done`,
   * si bien que le kanban par statut — l'item #9 — n'avait qu'une seule
   * colonne remplie et paraissait cassé. `done` reste lié a `completed` : le
   * serveur garde les deux synchronises, la demo doit en faire autant.
   */
  status: Exclude<TeamTaskStatus, 'done'> = 'todo',
): TeamTask => {
  seq += 1;
  const assigneeIds = [MEMBERS[assigneeIdx % MEMBERS.length]];
  if (seq % 4 === 0) {
    const second = MEMBERS[(assigneeIdx + 1) % MEMBERS.length];
    if (!assigneeIds.includes(second)) assigneeIds.push(second);
  }
  return {
    id: `ttask-${seq}`,
    status: completed ? 'done' : status,
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
  t('tproj-1', 'Intégration du header responsive', 2, 3, 5, false, 'in_progress'),
  t('tproj-1', 'Audit accessibilité WCAG', 3, 4, -1, false, 'blocked'),
  t('tproj-1', 'Optimisation des images', 4, 2, 8, false, 'review'),
  t('tproj-1', 'Rédaction des contenus SEO', 5, 3, 2, false, 'in_progress'),
  t('tproj-1', 'Charte graphique validée', 1, 3, -5, true),
  t('tproj-1', 'Setup analytics', 2, 2, 10, false),
  // Lancement produit
  t('tproj-2', 'Plan de communication', 0, 5, 0, false),
  t('tproj-2', 'Kit presse', 5, 3, 4, false, 'in_progress'),
  t('tproj-2', 'Préparer la démo investisseurs', 1, 5, -2, false),
  t('tproj-2', 'Landing page de teasing', 2, 4, 6, false, 'review'),
  t('tproj-2', 'Campagne réseaux sociaux', 3, 3, 7, false),
  t('tproj-2', 'Brief agence vidéo', 4, 2, -3, true),
  t('tproj-2', 'Liste des early adopters', 5, 3, 9, false),
  // Interne
  t('tproj-3', 'Onboarding nouveaux arrivants', 1, 3, 5, false, 'in_progress'),
  t('tproj-3', 'Mise à jour du wiki', 4, 1, 12, false),
  t('tproj-3', 'Rétrospective sprint', 0, 2, -2, false),
  t('tproj-3', 'Budget prévisionnel Q3', 3, 4, -1, false, 'blocked'),
  t('tproj-3', 'Commande matériel', 2, 2, 3, true),
  t('tproj-3', 'Planifier le séminaire', 5, 3, 14, false),
];

/**
 * Dépendances de démonstration (mig. 108). Aucune traduction : une arête ne
 * porte pas de texte.
 *
 * Contrainte respectée ici comme en base : une dépendance ne relie que des
 * tâches du MÊME projet. La chaîne du projet « Refonte du site » est
 * volontairement non triviale — deux branches partent de l'intégration du
 * header, et la plus longue n'est pas celle qui compte le plus de tâches,
 * sinon le chemin critique serait devinable sans le calculer.
 */
const DEMO_TASK_DEPENDENCIES: TeamTaskDependency[] = [
  // Refonte du site : maquettes → intégration → { images → analytics, audit }
  { taskId: 'ttask-2', dependsOnId: 'ttask-1' },
  { taskId: 'ttask-4', dependsOnId: 'ttask-2' },
  { taskId: 'ttask-3', dependsOnId: 'ttask-2' },
  { taskId: 'ttask-7', dependsOnId: 'ttask-4' },
  // Lancement produit : le kit presse attend le plan de communication.
  { taskId: 'ttask-9', dependsOnId: 'ttask-8' },
];

// Overlay anglais — cf. src/lib/seed-i18n.ts. Les ids `ttask-N` reprennent
// l'ordre de déclaration ci-dessus (compteur `seq` incrémenté par `t()`).
const DEMO_TASKS_EN: Record<string, Partial<TeamTask>> = {
  'ttask-1': { name: 'Homepage mockups' },
  'ttask-2': { name: 'Responsive header integration' },
  'ttask-3': { name: 'WCAG accessibility audit' },
  'ttask-4': { name: 'Image optimization' },
  'ttask-5': { name: 'SEO content writing' },
  'ttask-6': { name: 'Brand guidelines approved' },
  'ttask-7': { name: 'Analytics setup' },
  'ttask-8': { name: 'Communication plan' },
  'ttask-9': { name: 'Press kit' },
  'ttask-10': { name: 'Prepare investor demo' },
  'ttask-11': { name: 'Teaser landing page' },
  'ttask-12': { name: 'Social media campaign' },
  'ttask-13': { name: 'Video agency brief' },
  'ttask-14': { name: 'Early adopters list' },
  'ttask-15': { name: 'New hire onboarding' },
  'ttask-16': { name: 'Wiki update' },
  'ttask-17': { name: 'Sprint retrospective' },
  'ttask-18': { name: 'Q3 budget forecast' },
  'ttask-19': { name: 'Equipment order' },
  'ttask-20': { name: 'Plan the offsite' },
};

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

// Overlay anglais — cf. src/lib/seed-i18n.ts. « Bug », « Client », « Urgent »
// s'écrivent déjà pareil en anglais.
const DEMO_LABELS_EN: Record<string, Partial<TeamLabel>> = {
  'lbl-tech': { name: 'Technical' },
};

const DEMO_COMMENTS: TeamTaskComment[] = [
  { id: 'comment-seed-1', taskId: 'ttask-1', authorId: 'friend-1', body: 'Premier jet des maquettes déposé sur Figma, retours bienvenus !', mentions: [], createdAt: iso(-4) },
  { id: 'comment-seed-2', taskId: 'ttask-1', authorId: DEMO_USER_ID, body: '@Marie Dupont super base, je préfère la variante B pour le hero.', mentions: ['friend-1'], createdAt: iso(-3) },
  { id: 'comment-seed-3', taskId: 'ttask-8', authorId: 'friend-2', body: 'Le planning presse est calé, reste à valider le budget.', mentions: [], createdAt: iso(-2) },
  // Adossé à la notification « mention » seedée dans le module organizations :
  // une notification qui pointe vers un commentaire inexistant serait un leurre.
  { id: 'comment-seed-4', taskId: 'ttask-8', authorId: 'friend-1', body: 'Il me faut ton avis sur le calendrier avant vendredi, tu peux jeter un œil ?', mentions: [DEMO_USER_ID], createdAt: iso(-1) },
];

// Overlay anglais — cf. src/lib/seed-i18n.ts. Le nom mentionné (@Marie Dupont)
// n'est pas traduit, comme `sharedBy` dans le module tasks.
const DEMO_COMMENTS_EN: Record<string, Partial<TeamTaskComment>> = {
  'comment-seed-1': { body: 'First draft of the mockups is up on Figma, feedback welcome!' },
  'comment-seed-2': { body: '@Marie Dupont great base, I prefer variant B for the hero.' },
  'comment-seed-3': { body: 'The press schedule is locked in, budget still needs approval.' },
  'comment-seed-4': { body: 'I need your input on the schedule before Friday, can you take a look?' },
};

/**
 * Sous-tâches de démo (mig. 092).
 *
 * Trois tâches couvrant les trois états que la barre de progression sait
 * rendre — aucune cochée, partiellement cochée, entièrement cochée. Une seule
 * tâche seedée ne montrerait qu'un tiers du composant.
 */
const st = (id: string, taskId: string, title: string, completed: boolean, position: number): TeamSubtask => ({
  id, taskId, title, completed, position, createdBy: DEMO_USER_ID, createdAt: iso(-6 + position),
});

const DEMO_SUBTASKS: TeamSubtask[] = [
  // ttask-1 « Maquettes de la page d'accueil » — 2/4, progression partielle.
  st('sub-seed-1', 'ttask-1', 'Moodboard et références', true, 0),
  st('sub-seed-2', 'ttask-1', 'Wireframes basse fidélité', true, 1),
  st('sub-seed-3', 'ttask-1', 'Variante A du hero', false, 2),
  st('sub-seed-4', 'ttask-1', 'Variante B du hero', false, 3),
  // ttask-2 « Intégration du header responsive » — 1/3.
  st('sub-seed-5', 'ttask-2', 'Breakpoints mobile', true, 0),
  st('sub-seed-6', 'ttask-2', 'Menu burger accessible', false, 1),
  st('sub-seed-7', 'ttask-2', 'Tests sur Safari iOS', false, 2),
  // ttask-10 « Préparer la démo investisseurs » — 3/3, checklist terminée.
  st('sub-seed-8', 'ttask-10', 'Script de la démo', true, 0),
  st('sub-seed-9', 'ttask-10', 'Jeu de données de démonstration', true, 1),
  st('sub-seed-10', 'ttask-10', 'Répétition chronométrée', true, 2),
];

// Overlay anglais — cf. src/lib/seed-i18n.ts.
const DEMO_SUBTASKS_EN: Record<string, Partial<TeamSubtask>> = {
  'sub-seed-1': { title: 'Moodboard and references' },
  'sub-seed-2': { title: 'Low-fidelity wireframes' },
  'sub-seed-3': { title: 'Hero variant A' },
  'sub-seed-4': { title: 'Hero variant B' },
  'sub-seed-5': { title: 'Mobile breakpoints' },
  'sub-seed-6': { title: 'Accessible burger menu' },
  'sub-seed-7': { title: 'Safari iOS testing' },
  'sub-seed-8': { title: 'Demo script' },
  'sub-seed-9': { title: 'Demo dataset' },
  'sub-seed-10': { title: 'Timed rehearsal' },
};

/**
 * Associations tâche ↔ label (mig. 093).
 *
 * Le vocabulaire seul ne se voit nulle part : les labels n'apparaissent sur le
 * kanban et dans les filtres que POSÉS sur des tâches. Deux tâches en portent
 * deux, pour que le cas multi-labels soit visible sans avoir à le créer.
 */
const DEMO_TASK_LABELS: TeamTaskLabel[] = [
  { taskId: 'ttask-1', labelId: 'lbl-client' },
  { taskId: 'ttask-2', labelId: 'lbl-tech' },
  { taskId: 'ttask-3', labelId: 'lbl-bug' },
  { taskId: 'ttask-3', labelId: 'lbl-urgent' },
  { taskId: 'ttask-4', labelId: 'lbl-tech' },
  { taskId: 'ttask-5', labelId: 'lbl-client' },
  { taskId: 'ttask-8', labelId: 'lbl-client' },
  { taskId: 'ttask-8', labelId: 'lbl-urgent' },
  { taskId: 'ttask-9', labelId: 'lbl-client' },
  { taskId: 'ttask-11', labelId: 'lbl-tech' },
  { taskId: 'ttask-12', labelId: 'lbl-client' },
  { taskId: 'ttask-18', labelId: 'lbl-urgent' },
];

/**
 * Journal d'activité de démo (mig. 094).
 *
 * Les valeurs reprennent EXACTEMENT le format écrit par le trigger
 * `log_team_task_activity` : statut brut, priorité en texte, date en texte,
 * assignés joints par des virgules, et `name` sans valeurs. Reformater ici
 * ferait diverger la démo de la production sur le seul écran censé prouver
 * que le journal est fidèle.
 *
 * La fenêtre est volontairement récente : `getOrgActivity` alimente aussi la
 * revue hebdomadaire, qui ne regarde que les sept derniers jours.
 */
const act = (
  id: string,
  taskId: string,
  actorId: string | null,
  field: TeamActivityField,
  oldValue: string | null,
  newValue: string | null,
  dayOffset: number,
): TeamTaskActivity => ({
  id, taskId, orgId: DEMO_ORG_ID, actorId, field, oldValue, newValue, createdAt: iso(dayOffset),
});

const DEMO_ACTIVITY: TeamTaskActivity[] = [
  act('act-seed-1', 'ttask-1', 'friend-1', 'status', 'todo', 'in_progress', -6),
  act('act-seed-2', 'ttask-1', DEMO_USER_ID, 'priority', '3', '4', -5),
  act('act-seed-3', 'ttask-2', 'friend-2', 'status', 'todo', 'in_progress', -5),
  act('act-seed-4', 'ttask-3', 'friend-3', 'status', 'in_progress', 'blocked', -4),
  // Échéance REPOUSSÉE (ancienne < nouvelle) : c'est le sens que
  // `isPostponement` reconnaît, et la seule forme qui alimente l'étape « ce qui
  // a dérapé » de la revue hebdomadaire. Les valeurs encadrent la deadline
  // réelle de la tâche — un journal qui finirait sur une autre date que celle
  // affichée serait incohérent.
  act('act-seed-5', 'ttask-4', 'user-lucas', 'deadline', dateStr(3), dateStr(8), -4),
  act('act-seed-6', 'ttask-4', DEMO_USER_ID, 'assignees', 'user-lucas', 'user-lucas,user-camille', -3),
  act('act-seed-7', 'ttask-10', DEMO_USER_ID, 'name', null, null, -2),
  act('act-seed-8', 'ttask-18', 'friend-3', 'status', 'todo', 'blocked', -2),
  act('act-seed-9', 'ttask-6', 'friend-1', 'status', 'review', 'done', -1),
];

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
    if (!p) throw new Error('Projet introuvable');
    if (input.name !== undefined) p.name = input.name;
    if (input.color !== undefined) p.color = input.color;
    if (input.teamId !== undefined) p.teamId = input.teamId;
    if (input.categoryId !== undefined) p.categoryId = input.categoryId;
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
      categoryId: input.categoryId ?? null,
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
