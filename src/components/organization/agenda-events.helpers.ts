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
export interface DayTimelineBlock {
  event: CalendarEvent;
  /** Position et largeur sur la frise, en pourcentage. */
  left: number;
  width: number;
}

export interface DayTimeline {
  /** Heures entières bornant la frise (8 h à 19 h au minimum). */
  fromHour: number;
  toHour: number;
  blocks: DayTimelineBlock[];
  /** Position de « maintenant », ou null hors de la fenêtre. */
  now: number | null;
}

/**
 * Frise de la journée (maquette 5 B, 2026-10-02) : les événements du jour
 * posés sur une règle horaire. La fenêtre s'élargit pour contenir un
 * événement matinal ou tardif plutôt que de le couper.
 */
export const dayTimeline = (events: CalendarEvent[], now: Date = new Date()): DayTimeline => {
  const hourOf = (d: Date) => d.getHours() + d.getMinutes() / 60;
  const spans = events.map((event) => {
    const start = hourOf(parseISO(event.start));
    const rawEnd = hourOf(parseISO(event.end));
    // Un événement qui finit le lendemain (ou sans durée) s'arrête au bord.
    const end = rawEnd > start ? rawEnd : Math.min(24, start + 0.5);
    return { event, start, end };
  });
  const fromHour = Math.max(0, Math.min(8, ...spans.map((s) => Math.floor(s.start))));
  const toHour = Math.min(24, Math.max(19, ...spans.map((s) => Math.ceil(s.end))));
  const range = toHour - fromHour;
  const pct = (h: number) => ((h - fromHour) / range) * 100;
  const nowHour = hourOf(now);
  return {
    fromHour,
    toHour,
    blocks: spans.map(({ event, start, end }) => ({
      event,
      left: pct(start),
      // 3 % minimum : un rendez-vous de cinq minutes reste cliquable à l'œil.
      width: Math.max(3, pct(end) - pct(start)),
    })),
    now: nowHour >= fromHour && nowHour <= toHour ? pct(nowHour) : null,
  };
};

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
