// ═══════════════════════════════════════════════════════════════════
// Onglet Statistiques (mode entreprise) — calculs purs & testables
// Séparés du composant pour la couverture (helpers + *.test.ts, cf. TESTING).
// ═══════════════════════════════════════════════════════════════════

import {
  parseISO, isValid, isPast, isToday, subDays, startOfDay,
  startOfWeek, addWeeks, isWithinInterval, format,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import type { TeamTask } from '@/modules/team-projects';
import type { TeamProject } from '@/modules/team-projects';
import type { TeamOKR, TeamKeyResult } from '@/modules/team-okrs';
import type { OrgMember } from '@/modules/organizations';

// ─── Période ──────────────────────────────────────────────────────────

export type StatsPeriod = '7' | '30' | '90' | 'all';

export const STATS_PERIODS: { id: StatsPeriod; label: string; days: number | null }[] = [
  { id: '7', label: '7 j', days: 7 },
  { id: '30', label: '30 j', days: 30 },
  { id: '90', label: '90 j', days: 90 },
  { id: 'all', label: 'Tout', days: null },
];

/** Début de la fenêtre (minuit) ; null = pas de borne (« Tout »). */
export function periodStart(period: StatsPeriod, now: Date = new Date()): Date | null {
  const def = STATS_PERIODS.find((p) => p.id === period);
  if (!def || def.days === null) return null;
  return startOfDay(subDays(now, def.days));
}

const parse = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
};

/** La tâche a-t-elle été créée dans la fenêtre [start, now] ? (start null = toujours vrai) */
export function isCreatedWithin(task: TeamTask, start: Date | null): boolean {
  if (!start) return true;
  const d = parse(task.createdAt);
  return d ? d >= start : true; // date illisible : ne pas exclure
}

/** Filtre les tâches créées dans la fenêtre. */
export function filterByPeriod(tasks: TeamTask[], start: Date | null): TeamTask[] {
  if (!start) return tasks;
  return tasks.filter((t) => isCreatedWithin(t, start));
}

// ─── Retard ───────────────────────────────────────────────────────────

export const isOverdue = (t: TeamTask): boolean => {
  if (t.completed || !t.deadline) return false;
  const d = parse(t.deadline);
  return d ? isPast(d) && !isToday(d) : false;
};

// ─── OKR (progression pondérée) ───────────────────────────────────────

export const krProgress = (kr: TeamKeyResult): number => {
  if (kr.completed) return 1;
  if (kr.targetValue <= 0) return 0; // garde B17
  return Math.max(0, Math.min(1, kr.currentValue / kr.targetValue));
};

/** Coefficient d'importance effectif : entier borné [1, 10], défaut 1. */
export const krWeight = (kr: TeamKeyResult): number => {
  const w = Math.round(Number(kr.weight));
  if (!Number.isFinite(w) || w < 1) return 1;
  return Math.min(w, 10);
};

/** Progression pondérée d'un OKR (0..1) à partir de ses KR. */
export function okrProgress(okr: TeamOKR): number {
  const total = okr.keyResults.reduce((s, kr) => s + krWeight(kr), 0);
  if (total <= 0) return 0;
  return okr.keyResults.reduce((s, kr) => s + krProgress(kr) * krWeight(kr), 0) / total;
}

// ─── Synthèse (cartes) ────────────────────────────────────────────────

export interface StatsSummary {
  total: number;
  completed: number;
  completionRate: number; // 0..100
  overdueCount: number;
}

export function summarize(tasks: TeamTask[]): StatsSummary {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const overdueCount = tasks.filter(isOverdue).length;
  return {
    total,
    completed,
    completionRate: total ? Math.round((completed / total) * 100) : 0,
    overdueCount,
  };
}

/** Progression OKR moyenne pondérée sur l'ensemble des objectifs (0..100). */
export function overallOkrProgress(okrs: TeamOKR[]): number {
  const krs = okrs.flatMap((o) => o.keyResults);
  const total = krs.reduce((s, kr) => s + krWeight(kr), 0);
  if (total <= 0) return 0;
  return Math.round((krs.reduce((s, kr) => s + krProgress(kr) * krWeight(kr), 0) / total) * 100);
}

// ─── Par membre (charge + complétion) ─────────────────────────────────

const firstName = (name: string) => name.split(' ')[0];

export interface MemberLoad {
  userId: string;
  name: string;
  open: number;
  done: number;
  total: number;
  completionRate: number; // 0..100
}

/**
 * Charge et complétion par membre. Une tâche multi-assignée compte pour chaque
 * assigné. Trié par tâches ouvertes décroissantes.
 */
export function memberLoad(tasks: TeamTask[], members: OrgMember[]): MemberLoad[] {
  const open = new Map<string, number>();
  const done = new Map<string, number>();
  for (const t of tasks) {
    for (const uid of t.assigneeIds) {
      if (t.completed) done.set(uid, (done.get(uid) ?? 0) + 1);
      else open.set(uid, (open.get(uid) ?? 0) + 1);
    }
  }
  return members
    .map((m) => {
      const o = open.get(m.userId) ?? 0;
      const d = done.get(m.userId) ?? 0;
      const total = o + d;
      return {
        userId: m.userId,
        name: firstName(m.displayName),
        open: o,
        done: d,
        total,
        completionRate: total ? Math.round((d / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.open - a.open || b.total - a.total);
}

/** Retards par membre (nombre de tâches en retard assignées), trié desc, > 0 seulement. */
export function overdueByMember(
  tasks: TeamTask[],
  members: OrgMember[],
): { userId: string; name: string; count: number }[] {
  const byUser = new Map<string, number>();
  for (const t of tasks) {
    if (!isOverdue(t)) continue;
    for (const uid of t.assigneeIds) byUser.set(uid, (byUser.get(uid) ?? 0) + 1);
  }
  return members
    .map((m) => ({ userId: m.userId, name: firstName(m.displayName), count: byUser.get(m.userId) ?? 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
}

// ─── Par projet ───────────────────────────────────────────────────────

export interface ProjectStat {
  id: string;
  name: string;
  color: string;
  open: number;
  overdue: number;
  total: number;
}

/** Répartition des tâches par projet (actifs, ceux qui ont ≥ 1 tâche), trié par ouvertes desc. */
export function projectBreakdown(tasks: TeamTask[], projects: TeamProject[]): ProjectStat[] {
  const active = projects.filter((p) => !p.archivedAt);
  return active
    .map((p) => {
      const pt = tasks.filter((t) => t.projectId === p.id);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        open: pt.filter((t) => !t.completed).length,
        overdue: pt.filter(isOverdue).length,
        total: pt.length,
      };
    })
    .filter((p) => p.total > 0)
    .sort((a, b) => b.open - a.open || b.total - a.total);
}

// ─── Séries temporelles (semaines) ────────────────────────────────────

interface WeekBucket { start: Date; end: Date; label: string; }

/**
 * Découpe [start, now] en semaines (lundi→dimanche, locale fr). Si start est
 * null (« Tout »), on remonte de `maxWeeks` semaines pour garder un graphe lisible.
 */
export function weekBuckets(start: Date | null, now: Date = new Date(), maxWeeks = 12): WeekBucket[] {
  const from = startOfWeek(start ?? subDays(now, maxWeeks * 7), { weekStartsOn: 1 });
  const buckets: WeekBucket[] = [];
  let cursor = from;
  // Borne dure pour éviter toute boucle infinie sur des dates aberrantes.
  for (let i = 0; i < 60 && cursor <= now; i++) {
    const end = addWeeks(cursor, 1);
    buckets.push({ start: cursor, end, label: format(cursor, 'd MMM', { locale: fr }) });
    cursor = end;
  }
  // Limite à la fenêtre la plus récente si « Tout » explose le nombre de semaines.
  return buckets.slice(-maxWeeks);
}

/** Vélocité : nombre de tâches terminées (par completedAt) dans chaque semaine. */
export function velocityByWeek(
  tasks: TeamTask[],
  start: Date | null,
  now: Date = new Date(),
): { label: string; completed: number }[] {
  const buckets = weekBuckets(start, now);
  return buckets.map((b) => ({
    label: b.label,
    completed: tasks.filter((t) => {
      const d = parse(t.completedAt);
      return t.completed && d && isWithinInterval(d, { start: b.start, end: b.end });
    }).length,
  }));
}

/**
 * Tendance du taux de complétion : à la fin de chaque semaine, part des tâches
 * déjà créées qui sont terminées (completedAt ≤ fin de semaine). Donne une
 * courbe d'évolution du taux global (0..100).
 */
export function completionTrend(
  tasks: TeamTask[],
  start: Date | null,
  now: Date = new Date(),
): { label: string; rate: number }[] {
  const buckets = weekBuckets(start, now);
  return buckets.map((b) => {
    const createdBy = tasks.filter((t) => {
      const c = parse(t.createdAt);
      return c ? c <= b.end : true;
    });
    const completedBy = createdBy.filter((t) => {
      if (!t.completed) return false;
      const d = parse(t.completedAt);
      return d ? d <= b.end : true;
    });
    return {
      label: b.label,
      rate: createdBy.length ? Math.round((completedBy.length / createdBy.length) * 100) : 0,
    };
  });
}

// ─── OKR par objectif ─────────────────────────────────────────────────

export interface OkrStat { id: string; title: string; progress: number; krCount: number; }

/** Avancement pondéré par objectif (0..100), trié du moins avancé au plus avancé. */
export function okrBreakdown(okrs: TeamOKR[]): OkrStat[] {
  return okrs
    .map((o) => ({
      id: o.id,
      title: o.title,
      progress: Math.round(okrProgress(o) * 100),
      krCount: o.keyResults.length,
    }))
    .sort((a, b) => a.progress - b.progress);
}
