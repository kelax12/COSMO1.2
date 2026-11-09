// ═══════════════════════════════════════════════════════════════════
// Events — sélection par fenêtre temporelle (pagination serveur de l'agenda).
//
// Le calendrier n'a besoin que des événements de la plage visible. MAIS les
// événements récurrents sont stockés comme UNE seule ligne maître expansée
// côté client (cf. buildCalendarEvents) : une requête `start BETWEEN` naïve
// ferait disparaître un hebdo dont le maître est hors fenêtre.
//
// Règle : on charge TOUJOURS les récurrents (peu nombreux, instances possibles
// partout) + les non-récurrents qui CHEVAUCHENT la fenêtre. Logique pure,
// testée, partagée entre le repo local (filtre JS) et le repo Supabase (le
// filtre SQL .or() de buildWindowOrFilter doit refléter exactement eventInWindow).
// ═══════════════════════════════════════════════════════════════════
import { CalendarEvent, EventRecurrence } from './types';

const RECURRING: ReadonlySet<EventRecurrence> = new Set<EventRecurrence>(['daily', 'weekly', 'custom']);

/** Vrai si l'événement se répète (instances possibles dans n'importe quelle fenêtre). */
export function isRecurringEvent(e: Pick<CalendarEvent, 'recurrence'>): boolean {
  return !!e.recurrence && RECURRING.has(e.recurrence);
}

/**
 * Un événement appartient à la fenêtre [startISO, endISO] s'il est récurrent
 * OU s'il chevauche la fenêtre (start ≤ fin ET end ≥ début), bornes incluses.
 *
 * V14.2 : comparaison d'INSTANTS, plus de chaînes. L'ordre lexicographique
 * d'ISO ne vaut que pour un format identique des deux côtés ; or la base rend
 * `…+00:00` sans millisecondes, l'app écrit `….000Z` : au même instant,
 * `'00:00:00+00:00' < '00:00:00.000Z'`, et un événement qui finit pile au
 * début de la fenêtre en tombait (même défaut avec `…:59Z` contre `…:59.000Z`
 * sur la borne de fin). Postgres, lui, compare des
 * `timestamptz` : la démo doit faire pareil pour rendre les mêmes lignes.
 * Une date illisible est gardée (mieux vaut un bloc de trop qu'un trou).
 */
export function eventInWindow(e: CalendarEvent, startISO: string, endISO: string): boolean {
  if (isRecurringEvent(e)) return true;
  const s = Date.parse(e.start);
  const end = Date.parse(e.end);
  const ws = Date.parse(startISO);
  const we = Date.parse(endISO);
  if ([s, end, ws, we].some(Number.isNaN)) return true;
  return s <= we && end >= ws;
}

/** Filtre un tableau d'événements pour une fenêtre (repo local / démo). */
export function selectEventsInWindow(
  events: CalendarEvent[],
  startISO: string,
  endISO: string,
): CalendarEvent[] {
  return events.filter((e) => eventInWindow(e, startISO, endISO));
}

/**
 * Filtre PostgREST `.or(...)` reflétant `eventInWindow` pour la requête Supabase.
 * recurrence.in.(…) capte les récurrents (null/none → branche plage). Les bornes
 * sont des ISO UTC générés par l'app (FullCalendar `.toISOString()` → `…Z`,
 * sans virgule ni `+`), donc sûres à interpoler dans le filtre.
 */
export function buildWindowOrFilter(startISO: string, endISO: string): string {
  return `recurrence.in.(daily,weekly,custom),and(start_time.lte.${endISO},end_time.gte.${startISO})`;
}
