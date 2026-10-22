// ═══════════════════════════════════════════════════════════════════
// Page d'équipe (`/entreprise/teams/:id`) — calculs purs et testables
// ═══════════════════════════════════════════════════════════════════

import { parseISO, isValid, startOfDay, subDays } from 'date-fns';
import type { OrgTeam, OrgTeamMember } from '@/modules/org-teams';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import type { TeamOKR } from '@/modules/team-okrs';
import { okrProgress } from './team-stats.helpers';

/** Fenêtre des statistiques d'équipe, en jours. */
export const TEAM_STATS_WINDOW_DAYS = 30;

export interface TeamStats {
  /** Tâches ouvertes des projets de l'équipe. */
  open: number;
  /** Parmi elles, celles dont l'échéance est passée. */
  overdue: number;
  /** Terminées dans la fenêtre. */
  doneInWindow: number;
  /**
   * Part des tâches terminées dans la fenêtre sur (terminées + ouvertes), en
   * pourcentage entier. `null` quand il n'y a rien à mesurer : afficher « 0 % »
   * dirait qu'une équipe sans tâche ne livre rien.
   */
  completionRate: number | null;
}

const parse = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
};

/**
 * Projets de l'équipe : ceux qui lui APPARTIENNENT (`teamId`). Un projet
 * d'organisation (`teamId` null) n'appartient à aucune équipe, même si des
 * membres de celle-ci y travaillent.
 */
export function teamProjectsOf(team: Pick<OrgTeam, 'id'>, projects: TeamProject[]): TeamProject[] {
  return projects.filter((p) => p.teamId === team.id);
}

/** OKR rattachés à l'équipe (un OKR peut l'être à plusieurs). */
export function teamOkrsOf(team: Pick<OrgTeam, 'id'>, okrs: TeamOKR[]): TeamOKR[] {
  return okrs.filter((o) => o.teamIds.includes(team.id));
}

/** Avancement moyen des OKR, en pourcentage entier ; `null` sans OKR. */
export function averageOkrProgress(okrs: TeamOKR[]): number | null {
  if (okrs.length === 0) return null;
  return Math.round((okrs.reduce((s, o) => s + okrProgress(o), 0) / okrs.length) * 100);
}

/**
 * Statistiques des tâches des projets de l'équipe.
 *
 * `tasks` est l'ensemble de travail (ouvertes + terminées depuis le début de
 * la fenêtre) : une terminée plus ancienne n'y figure pas, et ne doit pas
 * compter si l'appelant passe une liste plus large.
 */
export function computeTeamStats(
  tasks: TeamTask[],
  projectIds: ReadonlySet<string>,
  now: Date = new Date(),
): TeamStats {
  const windowStart = startOfDay(subDays(now, TEAM_STATS_WINDOW_DAYS));
  const today = startOfDay(now);
  let open = 0;
  let overdue = 0;
  let doneInWindow = 0;
  for (const task of tasks) {
    if (!projectIds.has(task.projectId)) continue;
    if (task.completed) {
      const done = parse(task.completedAt);
      if (done && done >= windowStart) doneInWindow += 1;
      continue;
    }
    open += 1;
    const deadline = parse(task.deadline);
    if (deadline && deadline < today) overdue += 1;
  }
  const measured = open + doneInWindow;
  return {
    open,
    overdue,
    doneInWindow,
    completionRate: measured === 0 ? null : Math.round((doneInWindow / measured) * 100),
  };
}

/** Responsables d'abord, puis ordre alphabétique : c'est à eux qu'on s'adresse. */
export function sortTeamMembers<T extends { userId: string; displayName: string }>(
  members: T[],
  memberships: OrgTeamMember[],
): T[] {
  const leads = new Set(memberships.filter((m) => m.isLead).map((m) => m.userId));
  return [...members].sort((a, b) => {
    const la = leads.has(a.userId) ? 0 : 1;
    const lb = leads.has(b.userId) ? 0 : 1;
    return la - lb || a.displayName.localeCompare(b.displayName);
  });
}

/**
 * Peut modifier la fiche et les membres de l'équipe : miroir EXACT de
 * `can_manage_team` (mig. 107, policy UPDATE de la mig. 163).
 */
export function canManageTeam(
  team: Pick<OrgTeam, 'id' | 'createdBy'>,
  memberships: OrgTeamMember[],
  currentUserId: string | undefined,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  if (!currentUserId) return false;
  if (team.createdBy === currentUserId) return true;
  return memberships.some((m) => m.teamId === team.id && m.userId === currentUserId && m.isLead);
}

/** Tranche d'échéance d'une tâche ouverte, dans l'ordre d'affichage. */
export type LoadBucket = 'overdue' | 'thisWeek' | 'later' | 'noDate';
export const LOAD_BUCKETS: readonly LoadBucket[] = ['overdue', 'thisWeek', 'later', 'noDate'];

export interface MemberLoad {
  /** `null` = la ligne « non assignées ». */
  userId: string | null;
  counts: Record<LoadBucket, number>;
  total: number;
  /** Tâches ouvertes, les plus urgentes d'abord (échéance croissante, sans date en dernier). */
  tasks: TeamTask[];
}

/** Tranche d'échéance ; « cette semaine » = aujourd'hui et les 6 jours suivants. */
export function loadBucketOf(task: Pick<TeamTask, 'deadline'>, now: Date = new Date()): LoadBucket {
  const deadline = parse(task.deadline);
  if (!deadline) return 'noDate';
  const today = startOfDay(now);
  if (deadline < today) return 'overdue';
  const weekEnd = startOfDay(subDays(today, -7));
  return deadline < weekEnd ? 'thisWeek' : 'later';
}

/**
 * Charge de l'équipe : les tâches OUVERTES des projets de l'équipe, par
 * membre. Une tâche à plusieurs assignés compte pour chacun d'eux : c'est du
 * travail que chacun porte. Un assigné hors de l'équipe n'a pas de ligne, et
 * sa tâche n'est pas « non assignée » pour autant. Ordre des membres : celui
 * de `memberIds`, puis la ligne des non assignées.
 */
export function computeTeamLoad(
  tasks: TeamTask[],
  projectIds: ReadonlySet<string>,
  memberIds: string[],
  now: Date = new Date(),
): MemberLoad[] {
  const empty = (userId: string | null): MemberLoad => ({
    userId,
    counts: { overdue: 0, thisWeek: 0, later: 0, noDate: 0 },
    total: 0,
    tasks: [],
  });
  const byMember = new Map(memberIds.map((id) => [id, empty(id)]));
  const unassigned = empty(null);
  const add = (load: MemberLoad, task: TeamTask) => {
    load.counts[loadBucketOf(task, now)] += 1;
    load.total += 1;
    load.tasks.push(task);
  };
  for (const task of tasks) {
    if (task.completed || !projectIds.has(task.projectId)) continue;
    if (task.assigneeIds.length === 0) {
      add(unassigned, task);
      continue;
    }
    for (const id of task.assigneeIds) {
      const load = byMember.get(id);
      if (load) add(load, task);
    }
  }
  const byUrgency = (a: TeamTask, b: TeamTask) => {
    if (!a.deadline) return b.deadline ? 1 : 0;
    if (!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  };
  const rows = [...byMember.values(), unassigned];
  for (const row of rows) row.tasks.sort(byUrgency);
  return rows;
}

/** Longueur maximale d'une description (contrainte `org_teams_description_length`). */
export const TEAM_DESCRIPTION_MAX = 500;
