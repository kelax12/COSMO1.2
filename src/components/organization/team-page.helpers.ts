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

/** Longueur maximale d'une description (contrainte `org_teams_description_length`). */
export const TEAM_DESCRIPTION_MAX = 500;
