// Regroupement de « Mon agenda » par jour — même donnée que la liste plate
// (useUpcomingEvents), seul le rendu change.
import { isToday, parseISO } from 'date-fns';
import type { CalendarEvent } from '@/modules/events';

export interface AgendaDayGroup {
  /** Date locale 'en-CA' (YYYY-MM-DD) — clé de regroupement ET de rendu React. */
  dayKey: string;
  date: Date;
  isToday: boolean;
  events: CalendarEvent[];
}

/**
 * Groupe des événements déjà triés par date croissante (contrat de
 * `useUpcomingEvents`) en jours consécutifs, ordre préservé.
 *
 * Le jour est déterminé en date LOCALE, comme pour les habitudes et les
 * échéances de tâches (cf. CLAUDE.md § Habitudes) : un événement à 23 h 50 ne
 * doit pas basculer sur le jour suivant parce que son horodatage ISO est en
 * UTC.
 */
export const groupEventsByDay = (events: CalendarEvent[]): AgendaDayGroup[] => {
  const groups: AgendaDayGroup[] = [];
  for (const event of events) {
    const date = parseISO(event.start);
    const dayKey = date.toLocaleDateString('en-CA');
    const last = groups[groups.length - 1];
    if (last && last.dayKey === dayKey) {
      last.events.push(event);
    } else {
      groups.push({ dayKey, date, isToday: isToday(date), events: [event] });
    }
  }
  return groups;
};
