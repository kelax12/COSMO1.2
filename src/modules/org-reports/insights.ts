// ═══════════════════════════════════════════════════════════════════
// ORG-REPORTS MODULE - Lecture d'une période : tendances, séries, faits marquants
// ═══════════════════════════════════════════════════════════════════
//
// Pur, sans texte : le composant et l'export PDF traduisent ce qu'on rend ici.

import type { AggregatedReport, DailyActivityReport, ReportEvent, ReportKr, ReportProject } from './types';
import { addDays } from './aggregate';

/** Minutes d'agenda d'un événement, jamais négatives. */
export const eventMinutes = (e: Pick<ReportEvent, 'start' | 'end'>): number =>
  Math.max(0, Math.round((Date.parse(e.end) - Date.parse(e.start)) / 60000));

export const totalEventMinutes = (events: ReportEvent[]): number =>
  events.reduce((sum, e) => sum + eventMinutes(e), 0);

/** La période de même longueur qui précède immédiatement `from`. */
export const previousPeriod = (from: string, to: string): { from: string; to: string } => {
  const length = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
  return { from: addDays(from, -length), to: addDays(from, -1) };
};

export interface Trend {
  /** Écart brut avec la période précédente. */
  delta: number;
  /** Écart en %, `null` quand la période précédente est à zéro. */
  percent: number | null;
}

/** `null` : pas de période précédente connue, on ne compare rien. */
export const trendOf = (current: number, previous: number | null): Trend | null => {
  if (previous === null) return null;
  return {
    delta: current - previous,
    percent: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null,
  };
};

export interface DailySeries {
  tasks: number[];
  projects: number[];
  krs: number[];
  eventMinutes: number[];
}

/** Une valeur par jour de la période, jour vide = 0 (dessine la courbe des chiffres clés). */
export const dailySeries = (days: DailyActivityReport[], from: string, to: string): DailySeries => {
  const byDay = new Map(days.map((d) => [d.day, d.payload]));
  const out: DailySeries = { tasks: [], projects: [], krs: [], eventMinutes: [] };
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const p = byDay.get(day);
    out.tasks.push(p?.tasks.length ?? 0);
    out.projects.push(p?.projects.length ?? 0);
    out.krs.push(p?.krs.length ?? 0);
    out.eventMinutes.push(p ? totalEventMinutes(p.events) : 0);
  }
  return out;
};

const projectGain = (p: ReportProject) => p.after - p.before;
const krGain = (k: ReportKr) => (k.before === null ? 0 : k.after - k.before);

/** Terminés d'abord, puis le plus gros gain. */
export const sortProjectsByGain = (projects: ReportProject[]): ReportProject[] =>
  [...projects].sort((a, b) =>
    Number(b.after >= 100) - Number(a.after >= 100) || projectGain(b) - projectGain(a) || a.name.localeCompare(b.name));

/** Atteints d'abord, puis le plus gros gain. */
export const sortKrsByGain = (krs: ReportKr[]): ReportKr[] =>
  [...krs].sort((a, b) => Number(b.completed) - Number(a.completed) || krGain(b) - krGain(a) || a.title.localeCompare(b.title));

export interface Highlights {
  projectsDone: ReportProject[];
  krsCompleted: ReportKr[];
  /** Équipe qui porte le plus de tâches, et sa part (%) ; `null` sans équipe active. */
  topTeam: { name: string; share: number } | null;
  tasksTrend: Trend | null;
}

export const buildHighlights = (report: AggregatedReport, previousTaskCount: number | null): Highlights => {
  const teamTotal = report.teams.reduce((s, t) => s + t.tasksDone, 0);
  const top = report.teams[0];
  return {
    projectsDone: report.projects.filter((p) => p.after >= 100 && p.before < 100),
    krsCompleted: report.krs.filter((k) => k.completed),
    topTeam: top && teamTotal > 0 && report.teams.length > 1
      ? { name: top.name, share: Math.round((top.tasksDone / teamTotal) * 100) }
      : null,
    tasksTrend: trendOf(report.tasks.length, previousTaskCount),
  };
};
