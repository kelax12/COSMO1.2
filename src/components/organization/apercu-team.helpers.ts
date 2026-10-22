import { addDays, format } from 'date-fns';
import { deadlineDayKey } from '@/lib/deadline';
import type { TeamOKR } from '@/modules/team-okrs';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import { WEEK_CAPACITY_MINUTES } from './my-work.helpers';

/**
 * Dérivations des widgets d'équipe et d'administration de l'Aperçu
 * (2026-10-19). Toutes PURES : elles lisent les tâches ouvertes que la
 * personne voit déjà (la RLS décide), jamais plus.
 */

const todayKey = (now: Date) => format(now, 'yyyy-MM-dd');

export const isTaskOverdue = (task: TeamTask, now: Date = new Date()): boolean => {
  const key = deadlineDayKey(task.deadline);
  return !task.completed && !!key && key < todayKey(now);
};

/**
 * « Mon équipe » : mes subordonnés directs. Sans subordonné (admin, chef
 * déclaré sans organigramme), tout le monde sauf moi : le widget reste utile.
 */
export function myTeam(members: readonly OrgMember[], me: string): OrgMember[] {
  const reports = members.filter((m) => m.managerId === me);
  return reports.length > 0 ? reports : members.filter((m) => m.userId !== me);
}

export interface MemberLoad {
  member: OrgMember;
  open: number;
  overdue: number;
  /** Minutes estimées sur les sept prochains jours (retards compris). */
  minutes: number;
  /** 0..150 : part de la capacité hebdomadaire, bornée pour l'affichage. */
  percent: number;
}

export function teamLoad(team: readonly OrgMember[], open: readonly TeamTask[], now: Date = new Date()): MemberLoad[] {
  const horizon = format(addDays(now, 7), 'yyyy-MM-dd');
  return team
    .map((member) => {
      const mine = open.filter((t) => !t.completed && t.assigneeIds.includes(member.userId));
      const week = mine.filter((t) => {
        const key = deadlineDayKey(t.deadline);
        return !!key && key <= horizon;
      });
      const minutes = week.reduce((sum, t) => sum + (t.estimatedTime ?? 0), 0);
      return {
        member,
        open: mine.length,
        overdue: mine.filter((t) => isTaskOverdue(t, now)).length,
        minutes,
        percent: Math.min(150, Math.round((minutes / WEEK_CAPACITY_MINUTES) * 100)),
      };
    })
    .sort((a, b) => b.percent - a.percent || b.open - a.open);
}

export interface OverdueGroup {
  member: OrgMember;
  tasks: TeamTask[];
}

/** Retards de l'équipe, par personne, les plus chargées en retard d'abord. */
export function teamOverdue(team: readonly OrgMember[], open: readonly TeamTask[], now: Date = new Date()): OverdueGroup[] {
  return team
    .map((member) => ({
      member,
      tasks: open
        .filter((t) => t.assigneeIds.includes(member.userId) && isTaskOverdue(t, now))
        .sort((a, b) => deadlineDayKey(a.deadline).localeCompare(deadlineDayKey(b.deadline))),
    }))
    .filter((g) => g.tasks.length > 0)
    .sort((a, b) => b.tasks.length - a.tasks.length);
}

/** Avancement d'un OKR : moyenne de ses résultats clés (garde B17 : cible nulle = 0). */
export function okrProgress(okr: TeamOKR): number {
  if (okr.keyResults.length === 0) return 0;
  const sum = okr.keyResults.reduce((acc, kr) => (
    acc + (kr.completed ? 100 : kr.targetValue > 0 ? Math.min(100, Math.max(0, (kr.currentValue / kr.targetValue) * 100)) : 0)
  ), 0);
  return Math.round(sum / okr.keyResults.length);
}

/**
 * En retard sur le calendrier : l'échéance est passée sans 100 %, ou le temps
 * écoulé dépasse l'avancement de plus de 20 points.
 */
export function isOkrBehind(okr: TeamOKR, now: Date = new Date()): boolean {
  const progress = okrProgress(okr);
  if (progress >= 100 || !okr.endDate) return false;
  const end = new Date(okr.endDate).getTime();
  if (end < now.getTime()) return true;
  const start = okr.startDate ? new Date(okr.startDate).getTime() : NaN;
  if (Number.isNaN(start) || end <= start) return false;
  const elapsed = ((now.getTime() - start) / (end - start)) * 100;
  return elapsed - progress > 20;
}

export interface OkrRow { okr: TeamOKR; progress: number; behind: boolean }

/** Les OKR, les plus en retard d'abord. `teamOnly` : seulement ceux rattachés à une équipe. */
export function okrRows(okrs: readonly TeamOKR[], teamOnly: boolean, now: Date = new Date()): OkrRow[] {
  return okrs
    .filter((o) => !teamOnly || o.teamIds.length > 0)
    .map((okr) => ({ okr, progress: okrProgress(okr), behind: isOkrBehind(okr, now) }))
    .sort((a, b) => Number(b.behind) - Number(a.behind) || a.progress - b.progress);
}

export interface RiskyProject {
  project: TeamProject;
  overdue: number;
  open: number;
  /** Ce qui le met en risque : santé déclarée et/ou retards. */
  health: TeamProject['health'];
}

/** Projets actifs en risque : santé déclarée à risque / hors piste, ou des tâches en retard. */
export function riskyProjects(projects: readonly TeamProject[], open: readonly TeamTask[], now: Date = new Date()): RiskyProject[] {
  return projects
    .filter((p) => !p.archivedAt && !p.isTemplate)
    .map((project) => {
      const tasks = open.filter((t) => t.projectId === project.id && !t.completed);
      return { project, open: tasks.length, overdue: tasks.filter((t) => isTaskOverdue(t, now)).length, health: project.health ?? null };
    })
    .filter((r) => r.overdue > 0 || r.health === 'at_risk' || r.health === 'off_track')
    .sort((a, b) => (b.health === 'off_track' ? 1 : 0) - (a.health === 'off_track' ? 1 : 0) || b.overdue - a.overdue);
}

export const unassignedTasks = (open: readonly TeamTask[], activeProjectIds: ReadonlySet<string>): TeamTask[] =>
  open
    .filter((t) => !t.completed && t.assigneeIds.length === 0 && activeProjectIds.has(t.projectId))
    .sort((a, b) => (deadlineDayKey(a.deadline) || '9999').localeCompare(deadlineDayKey(b.deadline) || '9999'));
