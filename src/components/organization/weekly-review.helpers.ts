// ═══════════════════════════════════════════════════════════════════
// Revue hebdomadaire d'équipe (item #26) — tout le calcul, testé.
//
// Le mode perso a `WeeklyCheckinModal` ; rien d'équivalent en équipe. Un
// manager qui prépare son lundi devait ouvrir Statistiques, Projets et
// Pyramide, puis recouper à la main.
//
// La différence entre une revue et un tableau de bord de plus tient à la
// dernière section : `needsArbitration` produit des DÉCISIONS cliquables, pas
// des chiffres. Le reste sert à savoir de quoi on parle avant d'arbitrer.
// ═══════════════════════════════════════════════════════════════════

import { startOfWeek, subWeeks, parseISO, isValid } from 'date-fns';
import type { TeamTask, TeamTaskActivity } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import { isOverdue, memberWorkload, workloadTone, type MemberWorkload } from './team-stats.helpers';

/** Une revue ne propose pas quarante décisions : au-delà, on ne décide plus. */
const MAX_ARBITRATIONS = 10;

/** Tâche dont l'échéance a été repoussée pendant la fenêtre de revue. */
export interface SlippedTask {
  taskId: string;
  name: string;
  /** Ancienne échéance (`YYYY-MM-DD`). */
  from: string;
  /** Nouvelle échéance (`YYYY-MM-DD`). */
  to: string;
}

export interface WeeklyReview {
  completedThisWeek: number;
  completedLastWeek: number;
  /** Variation en % ; null si la semaine précédente était à 0 (division impossible). */
  velocityChange: number | null;
  /** Tâches dont la deadline a été repoussée dans la fenêtre. */
  slipped: SlippedTask[];
  /** Membres au-dessus de 1,5× la médiane de l'équipe. */
  overloaded: MemberWorkload[];
  /** Tâches en retard non terminées, les plus anciennes d'abord. */
  needsArbitration: TeamTask[];
}

export interface ReviewWindow {
  thisWeekStart: Date;
  lastWeekStart: Date;
}

/**
 * Les deux semaines comparées, lundi → dimanche.
 *
 * `weekStartsOn: 1` est codé en dur, comme dans `weekBuckets` : dériver le
 * début de semaine de la locale ferait démarrer la semaine le dimanche en
 * anglais, et les chiffres de la revue changeraient d'un membre de l'équipe à
 * l'autre. Une revue d'équipe doit découper le temps de la même façon pour
 * tout le monde.
 */
export function reviewWindow(now: Date = new Date()): ReviewWindow {
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  return { thisWeekStart, lastWeekStart: subWeeks(thisWeekStart, 1) };
}

const parse = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
};

/** Terminées dans [start, end[ — d'après `completedAt`, pas `updatedAt`. */
const completedBetween = (tasks: TeamTask[], start: Date, end: Date): number =>
  tasks.filter((t) => {
    if (!t.completed) return false;
    const d = parse(t.completedAt);
    return !!d && d >= start && d < end;
  }).length;

/**
 * Une entrée du journal est-elle un REPORT d'échéance ?
 *
 * Trois cas voisins qui n'en sont pas :
 *  - `null → date` : on planifie une tâche qui n'avait pas d'échéance ;
 *  - `date → null` : on déplanifie (visible ailleurs, ce n'est pas un report) ;
 *  - `date → date antérieure` : on avance, c'est l'inverse d'un dérapage.
 *
 * La comparaison est lexicographique parce que le trigger de la mig. 094
 * écrit des dates `YYYY-MM-DD` : à format fixe, l'ordre des chaînes EST
 * l'ordre chronologique, sans parsing ni fuseau.
 */
const isPostponement = (e: TeamTaskActivity): boolean =>
  e.field === 'deadline' && !!e.oldValue && !!e.newValue && e.newValue > e.oldValue;

/**
 * Construit la revue. `now` injectable (convention du projet, audit H6) : sans
 * cela les tests pourrissent avec le temps.
 *
 * `activity` est le journal de l'organisation sur la fenêtre — le composant le
 * lit déjà borné côté serveur ; ce qui passe ici est re-filtré, une donnée
 * venue du réseau n'étant pas une garantie de périmètre.
 */
export function buildWeeklyReview(
  tasks: TeamTask[],
  members: OrgMember[],
  activity: TeamTaskActivity[],
  now: Date = new Date(),
): WeeklyReview {
  const { thisWeekStart, lastWeekStart } = reviewWindow(now);

  const completedThisWeek = completedBetween(tasks, thisWeekStart, now);
  const completedLastWeek = completedBetween(tasks, lastWeekStart, thisWeekStart);

  // ─── 2. Ce qui a dérapé ────────────────────────────────────────────
  // Une tâche reportée trois fois est UN dérapage, pas trois : on ne garde que
  // le report le plus récent, sinon la section liste des allers-retours au
  // lieu de la situation.
  const byTask = new Map<string, { entry: TeamTaskActivity; task: TeamTask }>();
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  for (const e of activity) {
    if (!isPostponement(e)) continue;
    const at = parse(e.createdAt);
    if (!at || at < lastWeekStart) continue;
    // Sans la tâche, le dérapage n'est pas cliquable : une impasse dans une
    // section dont tout l'intérêt est de mener quelque part.
    const task = taskById.get(e.taskId);
    if (!task) continue;
    const known = byTask.get(e.taskId);
    if (known && (parse(known.entry.createdAt) ?? 0) >= at) continue;
    byTask.set(e.taskId, { entry: e, task });
  }
  const slipped: SlippedTask[] = [...byTask.values()].map(({ entry, task }) => ({
    taskId: task.id,
    name: task.name,
    from: entry.oldValue as string,
    to: entry.newValue as string,
  }));

  // ─── 3. Qui est en tension ─────────────────────────────────────────
  const overloaded = memberWorkload(tasks, members, now).filter(
    (m) => workloadTone(m.loadRatio) === 'over',
  );

  // ─── 4. Arbitrages ─────────────────────────────────────────────────
  const needsArbitration = tasks
    .filter((t) => isOverdue(t, now))
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
    .slice(0, MAX_ARBITRATIONS);

  return {
    completedThisWeek,
    completedLastWeek,
    velocityChange:
      completedLastWeek === 0
        ? null
        : Math.round(((completedThisWeek - completedLastWeek) / completedLastWeek) * 100),
    slipped,
    overloaded,
    needsArbitration,
  };
}

// ─── Périmètre de la revue (audit du 2026-09-24, étape 3) ────────────
//
// « Limitée au sous-arbre, pas enregistrée. » La revue se fait désormais aussi
// PAR ÉQUIPE ou PAR PROJET, et chacune est enregistrée (mig. 162,
// `org_weekly_reviews`) pour qu'on retrouve la semaine d'avant.

export type ReviewScope =
  | { kind: 'base' }
  | { kind: 'team'; teamId: string }
  | { kind: 'project'; projectId: string };

interface ScopeInput {
  scope: ReviewScope;
  /** Tâches et membres du périmètre du lecteur : un périmètre ne l'élargit JAMAIS. */
  tasks: TeamTask[];
  members: OrgMember[];
  /** Appartenances d'équipe de l'organisation. */
  memberships: { teamId: string; userId: string }[];
  /** Équipes (principale + associées) de chaque projet. */
  teamsOfProject: (projectId: string) => Set<string>;
}

/**
 * Restreint les tâches et les membres de la revue au périmètre choisi.
 *
 * - équipe : les tâches des projets de l'équipe (principale ou associée), et
 *   les membres de l'équipe ;
 * - projet : les tâches du projet, et les personnes qui y sont assignées.
 */
export function scopeReview({ scope, tasks, members, memberships, teamsOfProject }: ScopeInput): {
  tasks: TeamTask[];
  members: OrgMember[];
} {
  if (scope.kind === 'base') return { tasks, members };
  if (scope.kind === 'project') {
    const scoped = tasks.filter((t) => t.projectId === scope.projectId);
    const ids = new Set(scoped.flatMap((t) => t.assigneeIds));
    return { tasks: scoped, members: members.filter((m) => ids.has(m.userId)) };
  }
  const teamMembers = new Set(memberships.filter((m) => m.teamId === scope.teamId).map((m) => m.userId));
  return {
    tasks: tasks.filter((t) => teamsOfProject(t.projectId).has(scope.teamId)),
    members: members.filter((m) => teamMembers.has(m.userId)),
  };
}

/** Le résumé FIGÉ qu'on enregistre : des nombres, jamais des noms (RGPD, mig. 162). */
export const reviewSummary = (review: WeeklyReview): {
  completed: number; previousCompleted: number; slipped: number; blocked: number; overloaded: number;
} => ({
  completed: review.completedThisWeek,
  previousCompleted: review.completedLastWeek,
  slipped: review.slipped.length,
  blocked: review.needsArbitration.length,
  overloaded: review.overloaded.length,
});
