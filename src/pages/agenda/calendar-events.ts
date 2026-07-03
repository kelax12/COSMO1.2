// Logique pure de l'agenda : heure de scroll initiale + projection/mapping des
// événements vers le format FullCalendar. Extraite pour être testable.
// Comportement déplacé verbatim depuis AgendaPage.tsx.
import { expandRecurringEvents, type CalendarEvent } from '@/modules/events';

// Durée par défaut (minutes) d'un événement créé en glissant une tâche depuis la
// sidebar. Une tâche sans durée estimée a `estimatedTime = 0` (défaut du
// formulaire de création) : sans garde, FullCalendar reçoit `duration: 0` →
// l'aperçu (mirror) ET l'événement créé ont une hauteur nulle, donc invisibles.
// On retombe sur 60 min (cohérent avec EventModal/handleAddEvent).
export const DEFAULT_TASK_EVENT_MINUTES = 60;

export function taskEventDurationMinutes(estimatedTime: number | undefined | null): number {
  return typeof estimatedTime === 'number' && estimatedTime > 0
    ? estimatedTime
    : DEFAULT_TASK_EVENT_MINUTES;
}

// Heure de scroll initiale : 4 h avant l'heure courante (bornée à 00:00).
export function getInitialScrollTime(now: Date = new Date()): string {
  const hour = now.getHours();
  const scrollHour = Math.max(0, hour - 4);
  return `${scrollHour.toString().padStart(2, '0')}:00:00`;
}

// ── Fenêtre temporelle (pagination serveur de l'agenda) ────────────────
export interface EventsWindow { start: string; end: string; }

/**
 * Fenêtre par défaut au 1er rendu (avant le 1er datesSet de FullCalendar) :
 * large autour de `now` pour éviter un flash vide. Affinée ensuite par la plage
 * réellement visible (bufferedWindow).
 */
export function defaultEventsWindow(now: Date = new Date()): EventsWindow {
  const start = new Date(now); start.setMonth(start.getMonth() - 1);
  const end = new Date(now); end.setMonth(end.getMonth() + 2);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Élargit la plage visible de FullCalendar de ±bufferMonths pour limiter les
 * refetch lors de petites navigations (semaine suivante, etc.).
 */
export function bufferedWindow(rangeStart: Date, rangeEnd: Date, bufferMonths = 1): EventsWindow {
  const start = new Date(rangeStart); start.setMonth(start.getMonth() - bufferMonths);
  const end = new Date(rangeEnd); end.setMonth(end.getMonth() + bufferMonths);
  return { start: start.toISOString(), end: end.toISOString() };
}

export interface FullCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor: string;
  editable: boolean;
  extendedProps: { notes?: string; taskId?: string; isRecurringInstance: boolean };
}

// Étend les événements récurrents sur ±13 mois autour de `now`, puis les mappe
// au format attendu par FullCalendar. Les instances récurrentes (id contenant
// '::') sont non éditables.
export function buildCalendarEvents(events: CalendarEvent[], now: Date = new Date()): FullCalendarEvent[] {
  const projectionFrom = new Date(now);
  projectionFrom.setMonth(projectionFrom.getMonth() - 13);
  const projectionTo = new Date(now);
  projectionTo.setMonth(projectionTo.getMonth() + 13);
  const expandedEvents = expandRecurringEvents(events, projectionFrom, projectionTo);

  return expandedEvents.map(event => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    backgroundColor: event.color,
    borderColor: event.color,
    textColor: '#ffffff',
    editable: !event.id.includes('::'),
    extendedProps: { notes: event.notes, taskId: event.taskId, isRecurringInstance: event.id.includes('::') },
  }));
}
