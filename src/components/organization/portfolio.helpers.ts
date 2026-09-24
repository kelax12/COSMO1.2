// ═══════════════════════════════════════════════════════════════════
// Portefeuille de projets (mig. 153, M2) — calculs purs
//
// Recherche, tri, avancement, retard, dépendances ouvertes, et les deux
// transformations qui fabriquent un projet à partir d'un autre : dupliquer,
// et enregistrer / instancier un modèle. Aucune de ces fonctions ne lit ni
// n'écrit : l'écran les appelle, les tests les rejouent.
// ═══════════════════════════════════════════════════════════════════

import { addDays, differenceInCalendarDays, parseISO, isValid } from 'date-fns';
import type {
  CreateTeamProjectInput,
  DraftProjectMilestone,
  DraftProjectTask,
  TeamProject,
  TeamProjectDependency,
  TeamProjectMilestone,
  TeamProjectStatus,
  TeamProjectTemplatePayload,
  TeamTask,
} from '@/modules/team-projects';

/** Au-delà, la liste de cartes (chacune avec ses tâches) devient interminable. */
export const PORTFOLIO_CARD_THRESHOLD = 20;

export type PortfolioSort = 'recent' | 'name' | 'dueDate' | 'progress' | 'status';

export const PROJECT_STATUSES: TeamProjectStatus[] = ['planned', 'active', 'on_hold', 'done'];

/** Pastille par statut de projet — clé de catalogue sous `portfolio.status`. */
export const PROJECT_STATUS_META: Record<TeamProjectStatus, { dot: string; soft: string }> = {
  planned: { dot: 'bg-slate-400', soft: 'bg-slate-500/10 text-slate-600 dark:text-slate-300' },
  active: { dot: 'bg-blue-500', soft: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  on_hold: { dot: 'bg-amber-500', soft: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  done: { dot: 'bg-emerald-500', soft: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
};

const STATUS_RANK: Record<TeamProjectStatus, number> = { active: 0, on_hold: 1, planned: 2, done: 3 };

/** Minuscules, sans accents : « Équipe » se trouve en tapant « equipe ». */
export const normalizeSearch = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Un projet correspond si CHAQUE mot de la recherche apparaît dans son nom,
 * sa description, son équipe, sa catégorie ou son responsable.
 */
export function matchesProjectSearch(
  project: TeamProject,
  query: string,
  context: { teamName?: string; categoryName?: string; ownerName?: string } = {},
): boolean {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeSearch(
    [project.name, project.description ?? '', context.teamName ?? '', context.categoryName ?? '', context.ownerName ?? ''].join(' '),
  );
  return words.every((w) => haystack.includes(w));
}

export interface ProjectProgress {
  done: number;
  total: number;
  /** 0..100, entier. `0` quand le projet n'a aucune tâche. */
  percent: number;
}

export function projectProgress(projectId: string, tasks: TeamTask[]): ProjectProgress {
  let done = 0;
  let total = 0;
  for (const t of tasks) {
    if (t.projectId !== projectId) continue;
    total += 1;
    if (t.completed) done += 1;
  }
  return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
}

const parseDate = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
};

/** Échéance du projet dépassée alors qu'il n'est pas terminé. */
export function isProjectLate(project: TeamProject, now: Date = new Date()): boolean {
  const due = parseDate(project.dueDate);
  if (!due || project.status === 'done') return false;
  return differenceInCalendarDays(due, now) < 0;
}

/** Prochain jalon NON atteint d'un projet, ou `null`. */
export function nextMilestone(projectId: string, milestones: TeamProjectMilestone[]): TeamProjectMilestone | null {
  return milestones
    .filter((m) => m.projectId === projectId && !m.completedAt)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null;
}

/**
 * Projets qui bloquent encore `projectId` : ceux dont il dépend et qui ne sont
 * pas terminés. Un bloqueur archivé ou invisible ne compte pas.
 */
export function openBlockers(
  projectId: string,
  deps: TeamProjectDependency[],
  projects: TeamProject[],
): TeamProject[] {
  const byId = new Map(projects.map((p) => [p.id, p]));
  return deps
    .filter((d) => d.projectId === projectId)
    .map((d) => byId.get(d.dependsOnId))
    .filter((p): p is TeamProject => !!p && !p.archivedAt && p.status !== 'done');
}

/** Tri du portefeuille. Stable : à égalité, le plus récent d'abord. */
export function sortProjects(
  projects: TeamProject[],
  sort: PortfolioSort,
  tasks: TeamTask[],
): TeamProject[] {
  const recent = (a: TeamProject, b: TeamProject) => b.createdAt.localeCompare(a.createdAt);
  const progressOf = new Map(projects.map((p) => [p.id, projectProgress(p.id, tasks).percent]));
  const cmp: Record<PortfolioSort, (a: TeamProject, b: TeamProject) => number> = {
    recent,
    name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    // Sans échéance en dernier : un projet non daté n'est pas « le plus urgent ».
    dueDate: (a, b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31'),
    progress: (a, b) => (progressOf.get(a.id) ?? 0) - (progressOf.get(b.id) ?? 0),
    status: (a, b) => STATUS_RANK[a.status ?? 'active'] - STATUS_RANK[b.status ?? 'active'],
  };
  return [...projects].sort((a, b) => cmp[sort](a, b) || recent(a, b));
}

// ─── Dupliquer ───────────────────────────────────────────────────────

export interface ProjectBlueprint {
  input: CreateTeamProjectInput;
  tasks: DraftProjectTask[];
  milestones: DraftProjectMilestone[];
}

/**
 * Copie d'un projet : mêmes réglages, mêmes tâches OUVERTES remises à zéro
 * (statut « à faire », assignés conservés), mêmes jalons non atteints. Le
 * responsable devient celui qui duplique : il crée le projet, il en répond.
 */
export function duplicateBlueprint(
  project: TeamProject,
  tasks: TeamTask[],
  milestones: TeamProjectMilestone[],
  options: { name: string; ownerId: string | null },
): ProjectBlueprint {
  return {
    input: {
      name: options.name,
      color: project.color,
      teamId: project.teamId ?? null,
      categoryId: project.categoryId ?? null,
      description: project.description ?? null,
      ownerId: options.ownerId,
      status: project.status === 'done' ? 'active' : project.status ?? 'active',
      startDate: project.startDate ?? null,
      dueDate: project.dueDate ?? null,
    },
    tasks: tasks
      .filter((t) => t.projectId === project.id && !t.completed)
      .map((t) => ({
        name: t.name,
        description: t.description,
        priority: t.priority,
        estimatedTime: t.estimatedTime,
        startDate: t.startDate || undefined,
        deadline: t.deadline || undefined,
        assigneeIds: t.assigneeIds,
      })),
    milestones: milestones
      .filter((m) => m.projectId === project.id && !m.completedAt)
      .map((m) => ({ name: m.name, dueDate: m.dueDate })),
  };
}

// ─── Modèles ─────────────────────────────────────────────────────────

const offsetFrom = (base: Date, value: string | null | undefined): number | null => {
  const d = parseDate(value);
  return d ? differenceInCalendarDays(d, base) : null;
};

/**
 * Projet → contenu de modèle. Les dates deviennent des DÉCALAGES depuis le
 * début du projet (ou, à défaut, sa création) : un modèle sert des mois plus
 * tard, des dates absolues seraient toutes dans le passé. Les assignés ne
 * sont PAS repris : un modèle décrit un travail, pas des personnes.
 */
export function buildTemplatePayload(
  project: TeamProject,
  tasks: TeamTask[],
  milestones: TeamProjectMilestone[],
): TeamProjectTemplatePayload {
  const base = parseDate(project.startDate) ?? parseDate(project.createdAt.slice(0, 10)) ?? new Date();
  const start = parseDate(project.startDate);
  const due = parseDate(project.dueDate);
  return {
    tasks: tasks
      .filter((t) => t.projectId === project.id)
      .map((t) => ({
        name: t.name,
        ...(t.description ? { description: t.description } : {}),
        priority: t.priority,
        ...(t.estimatedTime ? { estimatedTime: t.estimatedTime } : {}),
        startOffset: offsetFrom(base, t.startDate),
        deadlineOffset: offsetFrom(base, t.deadline),
      })),
    milestones: milestones
      .filter((m) => m.projectId === project.id)
      .map((m) => ({ name: m.name, offset: offsetFrom(base, m.dueDate) ?? 0 })),
    durationDays: start && due ? differenceInCalendarDays(due, start) : null,
  };
}

const dateAt = (base: Date, offset: number | null | undefined): string | undefined =>
  offset === null || offset === undefined ? undefined : addDays(base, offset).toLocaleDateString('en-CA');

/**
 * Modèle → tâches et jalons d'un nouveau projet qui commence le `startDate`
 * donné (date locale). Un décalage négatif reste possible : une tâche prévue
 * « trois jours avant le lancement » garde son sens.
 */
export function instantiateTemplate(
  payload: TeamProjectTemplatePayload,
  startDate: string,
): { tasks: DraftProjectTask[]; milestones: DraftProjectMilestone[]; dueDate: string | null } {
  const base = parseDate(startDate) ?? new Date();
  return {
    tasks: payload.tasks.map((t) => {
      let start = dateAt(base, t.startOffset);
      const deadline = dateAt(base, t.deadlineOffset);
      // Le CHECK serveur refuse début > échéance : on ne fabrique jamais ce cas.
      if (start && deadline && start > deadline) start = deadline;
      return {
        name: t.name,
        description: t.description,
        priority: t.priority,
        estimatedTime: t.estimatedTime,
        startDate: start,
        deadline,
      };
    }),
    milestones: payload.milestones.map((m) => ({ name: m.name, dueDate: dateAt(base, m.offset)! })),
    dueDate: payload.durationDays !== null && payload.durationDays !== undefined
      ? dateAt(base, payload.durationDays) ?? null
      : null,
  };
}

/** Date locale du jour, 'YYYY-MM-DD' (convention `en-CA` du projet). */
export const todayLocal = (): string => new Date().toLocaleDateString('en-CA');
