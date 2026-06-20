// Insights purs pour la refonte « test » des Statistiques (exploration
// interactive). Réutilise calculateWorkTimeForPeriod ; aucune logique métier
// nouvelle.
import { calculateWorkTimeForPeriod } from '@/lib/workTimeCalculator';
import { formatTimeShort } from '@/pages/statistics/format';
import type { StatsData } from './compute';

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
export const dayKey = (d: Date) => d.toLocaleDateString('en-CA');

export interface DayCell { date: Date; key: string; minutes: number }
export interface Allocation { tasks: number; agenda: number; habits: number; okr: number; total: number }

const WEEKDAYS_FULL = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** Total quotidien sur `days` jours se terminant aujourd'hui. */
export function computeDailyTotals(data: StatsData, now: Date, days: number): DayCell[] {
  const out: DayCell[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const res = calculateWorkTimeForPeriod(startOfDay(d), endOfDay(d), data);
    out.push({ date: d, key: dayKey(d), minutes: Math.round(res.totalTime) });
  }
  return out;
}

export function computeAllocation(data: StatsData, start: Date, end: Date): Allocation {
  const r = calculateWorkTimeForPeriod(startOfDay(start), endOfDay(end), data);
  return {
    tasks: Math.round(r.tasksTime),
    agenda: Math.round(r.eventsTime),
    habits: Math.round(r.habitsTime),
    okr: Math.round(r.okrTime),
    total: Math.round(r.totalTime),
  };
}

export interface Comparison { current: number; previous: number; deltaPct: number | null }

/** Total de [start,end] vs la fenêtre précédente de même longueur. */
export function rangeComparison(data: StatsData, start: Date, end: Date): Comparison {
  const current = Math.round(calculateWorkTimeForPeriod(startOfDay(start), endOfDay(end), data).totalTime);
  const days = Math.round((endOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000) + 1;
  const prevEnd = new Date(startOfDay(start)); prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - (days - 1));
  const previous = Math.round(calculateWorkTimeForPeriod(startOfDay(prevStart), endOfDay(prevEnd), data).totalTime);
  const deltaPct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  return { current, previous, deltaPct };
}

const inRange = (d: Date, start: Date, end: Date) => d >= startOfDay(start) && d <= endOfDay(end);

/** Moyenne minutes/jour de semaine (Lun→Dim) sur les cellules d'une plage. */
export function weekdayRhythm(cells: DayCell[], start: Date, end: Date): number[] {
  const sums = Array(7).fill(0), counts = Array(7).fill(0);
  for (const c of cells) {
    if (!inRange(c.date, start, end)) continue;
    const wd = (c.date.getDay() + 6) % 7;
    sums[wd] += c.minutes; counts[wd] += 1;
  }
  return sums.map((s, i) => (counts[i] ? Math.round(s / counts[i]) : 0));
}

export interface DayDetail {
  tasks: { id: string; name: string }[];
  events: { id: string; title: string; time: string }[];
  habits: { id: string; name: string; color: string }[];
}

/** Détail d'un jour : tâches complétées, événements, habitudes faites. */
export function dayDetail(data: StatsData, date: Date): DayDetail {
  const key = dayKey(date);
  return {
    tasks: data.tasks
      .filter((t) => t.completed && t.completedAt && dayKey(new Date(t.completedAt)) === key)
      .map((t) => ({ id: t.id, name: t.name })),
    events: data.events
      .filter((e) => dayKey(new Date(e.start)) === key)
      .map((e) => ({ id: e.id, title: e.title, time: new Date(e.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) })),
    habits: data.habits
      .filter((h) => h.completions[key])
      .map((h) => ({ id: h.id, name: h.name, color: h.color })),
  };
}

/** Insights texte auto-générés pour une plage. */
export function buildInsights(data: StatsData, cells: DayCell[], start: Date, end: Date): string[] {
  const out: string[] = [];
  const cmp = rangeComparison(data, start, end);
  if (cmp.deltaPct != null) {
    out.push(cmp.deltaPct >= 0
      ? `📈 ${cmp.deltaPct === 0 ? 'Stable' : `+${cmp.deltaPct}%`} vs la période précédente`
      : `📉 ${cmp.deltaPct}% vs la période précédente`);
  }

  // Jour de semaine le plus productif (sur tout l'historique)
  const rhythmAll = weekdayRhythm(cells, cells[0].date, cells[cells.length - 1].date);
  const maxWd = rhythmAll.indexOf(Math.max(...rhythmAll));
  if (rhythmAll[maxWd] > 0) out.push(`🗓️ Jour le plus productif : ${WEEKDAYS_FULL[maxWd]}`);

  // Dimension dominante sur la sélection
  const a = computeAllocation(data, start, end);
  if (a.total > 0) {
    const dims: [string, number][] = [['les tâches', a.tasks], ["l'agenda", a.agenda], ['les habitudes', a.habits], ['les OKR', a.okr]];
    const [label, val] = dims.reduce((m, x) => (x[1] > m[1] ? x : m));
    out.push(`🍩 Dominante : ${label} (${Math.round((val / a.total) * 100)}%)`);
  }

  // Meilleur jour de la sélection
  const sel = cells.filter((c) => inRange(c.date, start, end));
  const best = sel.reduce((m, c) => (c.minutes > m.minutes ? c : m), sel[0] ?? { minutes: 0, date: start } as DayCell);
  if (best && best.minutes > 0) {
    out.push(`🏆 Meilleur jour : ${best.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} (${formatTimeShort(best.minutes)})`);
  }

  // Jours actifs
  const active = sel.filter((c) => c.minutes > 0).length;
  out.push(`✅ ${active} jour${active > 1 ? 's' : ''} actif${active > 1 ? 's' : ''} sur ${sel.length}`);

  return out;
}
