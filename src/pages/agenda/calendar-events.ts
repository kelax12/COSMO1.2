// Logique pure de l'agenda : heure de scroll initiale + projection/mapping des
// événements vers le format FullCalendar. Extraite pour être testable.
// Comportement déplacé verbatim depuis AgendaPage.tsx.
import { expandRecurringEvents, type CalendarEvent } from '@/modules/events';

// Heure de scroll initiale : 4 h avant l'heure courante (bornée à 00:00).
export function getInitialScrollTime(now: Date = new Date()): string {
  const hour = now.getHours();
  const scrollHour = Math.max(0, hour - 4);
  return `${scrollHour.toString().padStart(2, '0')}:00:00`;
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
