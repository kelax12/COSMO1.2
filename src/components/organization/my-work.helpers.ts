// ═══════════════════════════════════════════════════════════════════
// Aperçu entreprise (« Mon travail ») — dérivations pures
//
// Audit du 2026-09-24 : l'Aperçu lisait toute l'organisation pour n'en garder
// que mes tâches, reconstruisait le fil d'activité depuis l'état courant des
// tâches, et ne répondait pas à la première question d'un membre : « qu'est-ce
// qui m'attend ? ». Tout ce qui se calcule ici se teste sans React ni base.
// ═══════════════════════════════════════════════════════════════════
import type { TeamProject, TeamTask, TeamTaskActivity, TeamTaskDependency } from '@/modules/team-projects';
import type { TeamOKR, TeamKeyResult } from '@/modules/team-okrs';
import type { OrgNotification } from '@/modules/organizations';

/** Date locale 'YYYY-MM-DD' (les échéances sont saisies en date locale). */
export const localDay = (d: Date): string => d.toLocaleDateString('en-CA');

// ─── Aujourd'hui / cette semaine ────────────────────────────────────

export type Horizon = 'overdue' | 'today' | 'week' | 'later' | 'undated';

export const HORIZON_ORDER: Horizon[] = ['overdue', 'today', 'week', 'later', 'undated'];

/**
 * Range une tâche ouverte selon son échéance. « Cette semaine » = les six
 * jours qui suivent aujourd'hui, pas la semaine du calendrier : un lundi comme
 * un vendredi, on voit ce qui tombe dans les sept prochains jours.
 */
export const horizonOf = (task: TeamTask, now: Date = new Date()): Horizon => {
  if (!task.deadline) return 'undated';
  const today = localDay(now);
  if (task.deadline < today) return 'overdue';
  if (task.deadline === today) return 'today';
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return task.deadline <= localDay(weekEnd) ? 'week' : 'later';
};

/** Groupes non vides, dans l'ordre d'urgence. L'ordre interne est conservé. */
export const groupByHorizon = (
  open: TeamTask[],
  now: Date = new Date(),
): { horizon: Horizon; tasks: TeamTask[] }[] => {
  const buckets = new Map<Horizon, TeamTask[]>(HORIZON_ORDER.map((h) => [h, []]));
  for (const task of open) buckets.get(horizonOf(task, now))!.push(task);
  return HORIZON_ORDER.map((horizon) => ({ horizon, tasks: buckets.get(horizon)! })).filter(
    (g) => g.tasks.length > 0,
  );
};

// ─── Je bloque quelqu'un ────────────────────────────────────────────

export interface BlockingEntry {
  /** Ma tâche, encore ouverte. */
  mine: TeamTask;
  /** Les tâches ouvertes qui l'attendent et ne sont pas (seulement) à moi. */
  waiting: TeamTask[];
}

/**
 * Tâches d'autres personnes bloquées par une des miennes.
 *
 * Arête `taskId` BLOQUÉE PAR `dependsOnId` (mig. 108) : je bloque quelqu'un
 * quand `dependsOnId` est à moi et `taskId` ne l'est pas. Une tâche qui
 * m'attend et qui est aussi à moi ne compte pas : je ne me bloque pas moi-même.
 */
export const computeBlocking = (
  myOpen: TeamTask[],
  deps: TeamTaskDependency[],
  dependents: TeamTask[],
  me: string,
): BlockingEntry[] => {
  const mineById = new Map(myOpen.map((t) => [t.id, t]));
  const dependentById = new Map(dependents.map((t) => [t.id, t]));
  const byMine = new Map<string, TeamTask[]>();
  for (const d of deps) {
    if (!mineById.has(d.dependsOnId)) continue;
    const waiting = dependentById.get(d.taskId);
    if (!waiting || waiting.completed || waiting.assigneeIds.includes(me)) continue;
    byMine.set(d.dependsOnId, [...(byMine.get(d.dependsOnId) ?? []), waiting]);
  }
  return [...byMine.entries()].map(([id, waiting]) => ({ mine: mineById.get(id)!, waiting }));
};

/** Ids des tâches qui dépendent d'une de mes tâches ouvertes, triés (clé de cache stable). */
export const dependentIdsOf = (myOpen: TeamTask[], deps: TeamTaskDependency[]): string[] => {
  const mine = new Set(myOpen.map((t) => t.id));
  return [...new Set(deps.filter((d) => mine.has(d.dependsOnId)).map((d) => d.taskId))].sort();
};

// ─── En attente de moi ──────────────────────────────────────────────

/**
 * Tâches passées en revue qui attendent MA validation : je les ai créées et
 * ce n'est pas moi qui les fais. Celles que je me suis assignées ne
 * m'attendent pas, c'est moi qui les ai rendues.
 */
export const reviewsForMe = (createdInReview: TeamTask[], me: string): TeamTask[] =>
  createdInReview.filter(
    (t) => t.status === 'review' && t.createdBy === me && !(t.assigneeIds.length === 1 && t.assigneeIds[0] === me),
  );

/** Mentions non lues, une par tâche (la plus récente), sur l'organisation. */
export const unreadMentions = (notifications: OrgNotification[]): OrgNotification[] => {
  const seen = new Set<string>();
  return [...notifications]
    .filter((n) => n.kind === 'mention' && n.readAt === null && !!n.taskId)
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
    .filter((n) => {
      if (seen.has(n.taskId!)) return false;
      seen.add(n.taskId!);
      return true;
    });
};

// ─── Mes projets ────────────────────────────────────────────────────

export interface MyProjectSummary {
  project: TeamProject;
  open: number;
  overdue: number;
  /** Prochaine échéance de MES tâches ouvertes dans ce projet. */
  nextDeadline: string | null;
}

/**
 * Les projets actifs où j'ai du travail ouvert, les plus pressants d'abord
 * (retards, puis échéance la plus proche, puis volume).
 */
export const summarizeMyProjects = (
  myOpen: TeamTask[],
  projects: TeamProject[],
  now: Date = new Date(),
): MyProjectSummary[] => {
  const byId = new Map(projects.filter((p) => !p.archivedAt).map((p) => [p.id, p]));
  const acc = new Map<string, MyProjectSummary>();
  for (const task of myOpen) {
    const project = byId.get(task.projectId);
    if (!project) continue;
    const entry = acc.get(project.id) ?? { project, open: 0, overdue: 0, nextDeadline: null };
    entry.open += 1;
    if (horizonOf(task, now) === 'overdue') entry.overdue += 1;
    else if (task.deadline && (!entry.nextDeadline || task.deadline < entry.nextDeadline)) {
      entry.nextDeadline = task.deadline;
    }
    acc.set(project.id, entry);
  }
  return [...acc.values()].sort(
    (a, b) =>
      b.overdue - a.overdue ||
      (a.nextDeadline ?? '9999').localeCompare(b.nextDeadline ?? '9999') ||
      b.open - a.open,
  );
};

// ─── Mes KR ─────────────────────────────────────────────────────────

export interface MyKeyResult {
  kr: TeamKeyResult;
  okr: TeamOKR;
  /** 0..100, borné. Garde B17 : une cible nulle vaut 0 %. */
  percent: number;
}

export const myKeyResults = (okrs: TeamOKR[], me: string): MyKeyResult[] =>
  okrs
    .flatMap((okr) =>
      okr.keyResults
        .filter((kr) => kr.assigneeId === me && !kr.completed)
        .map((kr) => ({
          kr,
          okr,
          percent: kr.targetValue > 0 ? Math.min(100, Math.max(0, Math.round((kr.currentValue / kr.targetValue) * 100))) : 0,
        })),
    )
    .sort((a, b) => (a.okr.endDate ?? '9999').localeCompare(b.okr.endDate ?? '9999') || a.percent - b.percent);

// ─── Fil d'activité ─────────────────────────────────────────────────

export type ActivityKind = 'created' | 'completed' | 'reopened' | 'status' | 'assigned' | 'postponed' | 'advanced';

export interface ActivityItem {
  id: string;
  date: string;
  kind: ActivityKind;
  taskId: string;
  actorId: string | null;
  /** Statut d'arrivée (`status`), ou personnes AJOUTÉES (`assigned`). */
  detail?: string;
  addedIds?: string[];
}

const splitIds = (v: string | null): string[] => (v ? v.split(',').filter(Boolean) : []);

/**
 * Fil d'activité lu dans le JOURNAL (`team_task_activity`), SEULE source
 * (cohérence globale, 2026-09-25). Les créations y figurent depuis la mig. 181
 * (trigger AFTER INSERT) : elles ne sont plus reconstruites depuis l'état
 * courant des tâches, qui oubliait une tâche supprimée et ne connaissait pas
 * son auteur réel. Priorité, projet et intitulé sont écartés : utiles à
 * l'historique d'une tâche, du bruit dans un fil d'équipe.
 */
export const buildActivityItems = (
  activity: TeamTaskActivity[],
  max = 8,
): ActivityItem[] => {
  const out: ActivityItem[] = [];
  for (const e of activity) {
    const base = { id: e.id, date: e.createdAt, taskId: e.taskId, actorId: e.actorId };
    if (e.field === 'created') {
      out.push({ ...base, kind: 'created' });
    } else if (e.field === 'status') {
      if (e.newValue === 'done') out.push({ ...base, kind: 'completed' });
      else if (e.oldValue === 'done') out.push({ ...base, kind: 'reopened' });
      else if (e.newValue) out.push({ ...base, kind: 'status', detail: e.newValue });
    } else if (e.field === 'assignees') {
      const before = new Set(splitIds(e.oldValue));
      const added = splitIds(e.newValue).filter((id) => !before.has(id));
      if (added.length > 0) out.push({ ...base, kind: 'assigned', addedIds: added });
    } else if (e.field === 'deadline' && e.oldValue && e.newValue) {
      out.push({ ...base, kind: e.newValue > e.oldValue ? 'postponed' : 'advanced', detail: e.newValue });
    }
  }
  return out.sort((a, b) => (a.date > b.date ? -1 : 1)).slice(0, max);
};
