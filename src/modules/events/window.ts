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
 * OU s'il chevauche la fenêtre (start ≤ fin ET end ≥ début). Comparaison
 * lexicographique d'ISO (UTC `Z`), cohérente avec getFiltered existant.
 */
export function eventInWindow(e: CalendarEvent, startISO: string, endISO: string): boolean {
  if (isRecurringEvent(e)) return true;
  return e.start <= endISO && e.end >= startISO;
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
