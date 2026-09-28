// ═══════════════════════════════════════════════════════════════════
// ORG-REPORTS MODULE - Agrégation d'une période (fonctions pures)
// ═══════════════════════════════════════════════════════════════════

import type {
  ActivityReportPayload,
  AggregatedReport,
  DailyActivityReport,
  ReportKr,
  ReportProject,
  ReportTask,
  ReportTeamLine,
} from './types';

/** Payload illisible ou d'une version inconnue : une journée vide, jamais une exception. */
export const normalizePayload = (raw: unknown): ActivityReportPayload => {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<ActivityReportPayload>;
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    version: typeof p.version === 'number' ? p.version : 1,
    tasks: arr(p.tasks),
    projects: arr(p.projects),
    krs: arr(p.krs),
    events: arr(p.events),
    teams: arr(p.teams),
    truncated: p.truncated === true,
  };
};

/**
 * Fusionne les journées d'une période.
 *
 * - tâches et événements : concaténés, dans l'ordre chronologique ;
 * - projets et KR : « avant » = celui de la PREMIÈRE journée où l'élément
 *   bouge, « après » = celui de la DERNIÈRE ; les tâches du jour s'additionnent ;
 * - équipes : les tâches terminées s'additionnent.
 */
export const aggregateReports = (
  reports: DailyActivityReport[],
  from: string,
  to: string,
): AggregatedReport => {
  const days = [...reports]
    .filter((r) => r.day >= from && r.day <= to)
    .sort((a, b) => a.day.localeCompare(b.day));

  const tasks: ReportTask[] = [];
  const events: AggregatedReport['events'] = [];
  const projects = new Map<string, ReportProject>();
  const krs = new Map<string, ReportKr>();
  const teams = new Map<string, ReportTeamLine>();
  let truncated = false;

  for (const { payload } of days) {
    tasks.push(...payload.tasks);
    events.push(...payload.events);
    truncated = truncated || payload.truncated;

    for (const p of payload.projects) {
      const prev = projects.get(p.id);
      projects.set(p.id, prev
        ? { ...p, before: prev.before, completedToday: prev.completedToday + p.completedToday }
        : { ...p });
    }
    for (const k of payload.krs) {
      const prev = krs.get(k.id);
      krs.set(k.id, prev
        ? { ...k, before: prev.before ?? k.before, completed: prev.completed || k.completed }
        : { ...k });
    }
    for (const t of payload.teams) {
      const prev = teams.get(t.id);
      teams.set(t.id, prev ? { ...t, tasksDone: prev.tasksDone + t.tasksDone } : { ...t });
    }
  }

  tasks.sort((a, b) => a.at.localeCompare(b.at));
  events.sort((a, b) => a.start.localeCompare(b.start));

  return {
    from,
    to,
    daysCovered: days.length,
    tasks,
    projects: [...projects.values()].sort((a, b) => b.completedToday - a.completedToday || a.name.localeCompare(b.name)),
    krs: [...krs.values()],
    events,
    teams: [...teams.values()].sort((a, b) => b.tasksDone - a.tasksDone || a.name.localeCompare(b.name)),
    truncated,
  };
};

export interface TaskGroup {
  projectId: string | null;
  projectName: string | null;
  projectColor: string | null;
  tasks: ReportTask[];
}

/** Tâches terminées regroupées par projet, le plus actif d'abord, « sans projet » en dernier. */
export const groupTasksByProject = (tasks: ReportTask[]): TaskGroup[] => {
  const groups = new Map<string, TaskGroup>();
  for (const task of tasks) {
    const key = task.projectId ?? '';
    const group = groups.get(key) ?? {
      projectId: task.projectId,
      projectName: task.projectName,
      projectColor: task.projectColor,
      tasks: [],
    };
    group.tasks.push(task);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => {
    if (!a.projectId !== !b.projectId) return a.projectId ? -1 : 1;
    return b.tasks.length - a.tasks.length || (a.projectName ?? '').localeCompare(b.projectName ?? '');
  });
};

export interface EventGroup {
  userId: string;
  userName: string | null;
  events: AggregatedReport['events'];
}

/** Événements regroupés par personne. */
export const groupEventsByPerson = (events: AggregatedReport['events']): EventGroup[] => {
  const groups = new Map<string, EventGroup>();
  for (const e of events) {
    const group = groups.get(e.userId) ?? { userId: e.userId, userName: e.userName, events: [] };
    group.events.push(e);
    groups.set(e.userId, group);
  }
  return [...groups.values()].sort((a, b) => (a.userName ?? '').localeCompare(b.userName ?? ''));
};

// ─── Périodes ──────────────────────────────────────────────────────

export type ReportPeriodKind = 'day' | 'week' | 'month' | 'custom';

const pad = (n: number) => String(n).padStart(2, '0');
/** Date locale 'YYYY-MM-DD' (convention en-CA du projet, jamais toISOString). */
export const toDayKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromDayKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};
export const addDays = (key: string, n: number): string => {
  const d = fromDayKey(key);
  d.setDate(d.getDate() + n);
  return toDayKey(d);
};

/** Dernière journée générée : hier (le rapport du jour part à minuit). */
export const lastReportDay = (now: Date = new Date()): string => addDays(toDayKey(now), -1);

/** Bornes de la période contenant `anchor`. Semaine du lundi au dimanche. */
export const periodBounds = (kind: Exclude<ReportPeriodKind, 'custom'>, anchor: string): { from: string; to: string } => {
  if (kind === 'day') return { from: anchor, to: anchor };
  const d = fromDayKey(anchor);
  if (kind === 'week') {
    const offset = (d.getDay() + 6) % 7;
    const from = addDays(anchor, -offset);
    return { from, to: addDays(from, 6) };
  }
  const from = toDayKey(new Date(d.getFullYear(), d.getMonth(), 1));
  const to = toDayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  return { from, to };
};

/** Décale la période d'un cran (précédent / suivant). */
export const shiftPeriod = (kind: Exclude<ReportPeriodKind, 'custom'>, anchor: string, step: 1 | -1): string => {
  if (kind === 'day') return addDays(anchor, step);
  if (kind === 'week') return addDays(anchor, 7 * step);
  const d = fromDayKey(anchor);
  return toDayKey(new Date(d.getFullYear(), d.getMonth() + step, 1));
};
