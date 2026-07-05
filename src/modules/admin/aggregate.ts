// Helpers purs d'agrégation des séries quotidiennes du dashboard admin.
// Tout travaille sur des strings 'YYYY-MM-DD' — jamais new Date('YYYY-MM-DD')
// (parse UTC piégeux) : les conversions passent par des composantes locales.
import type { DailyPoint } from './types';

export type Granularity = 'day' | 'week';

/** Au-delà de ce span (en jours), les courbes passent en granularité semaine. */
export const DAY_THRESHOLD = 120;

function toDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1); // Date locale, pas de parse UTC
}

function toDayString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function spanInDays(first: string, last: string): number {
  const ms = toDate(last).getTime() - toDate(first).getTime();
  return Math.round(ms / 86_400_000);
}

/** 'day' si la série couvre <= DAY_THRESHOLD jours, sinon 'week'. */
export function chooseGranularity(points: DailyPoint[]): Granularity {
  if (points.length < 2) return 'day';
  const first = points[0].day;
  const last = points[points.length - 1].day;
  return spanInDays(first, last) > DAY_THRESHOLD ? 'week' : 'day';
}

/**
 * Zéro-fill les jours manquants entre la première date de la série et
 * `endDay` inclus. Série vide → []. Les points sont supposés triés (la RPC
 * trie par jour).
 */
export function fillMissingDays(points: DailyPoint[], endDay: string): DailyPoint[] {
  if (points.length === 0) return [];
  const byDay = new Map(points.map((p) => [p.day, p.count]));
  const out: DailyPoint[] = [];
  const cursor = toDate(points[0].day);
  const end = toDate(endDay);
  while (cursor.getTime() <= end.getTime()) {
    const day = toDayString(cursor);
    out.push({ day, count: byDay.get(day) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** Regroupe par semaine (bucket = lundi ISO), somme des counts. */
export function aggregateWeekly(points: DailyPoint[]): DailyPoint[] {
  const buckets = new Map<string, number>();
  for (const p of points) {
    const date = toDate(p.day);
    const dow = date.getDay(); // 0 = dimanche … 6 = samedi
    const daysSinceMonday = (dow + 6) % 7;
    date.setDate(date.getDate() - daysSinceMonday);
    const monday = toDayString(date);
    buckets.set(monday, (buckets.get(monday) ?? 0) + p.count);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));
}

/** Somme cumulée (courbe « total de comptes » à partir des signups/jour). */
export function toCumulative(points: DailyPoint[]): DailyPoint[] {
  let sum = 0;
  return points.map((p) => {
    sum += p.count;
    return { day: p.day, count: sum };
  });
}
