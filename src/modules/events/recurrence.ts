// ═══════════════════════════════════════════════════════════════════
// EVENTS MODULE — Expansion des événements récurrents (client-side)
// ═══════════════════════════════════════════════════════════════════
//
// Stratégie : un événement récurrent est stocké comme une seule ligne
// (le « master »). À l'affichage, on génère des instances virtuelles
// pour la fenêtre de temps demandée. L'id de chaque instance est
// `${master.id}::${dateISO}` — utiliser `getMasterId(id)` pour
// retrouver le master avant toute mutation.

import type { CalendarEvent } from './types';

const MAX_INSTANCES = 366; // garde-fou : ~1 an quotidien max

/**
 * Sépare un id d'instance en (masterId, instanceDate) ou retourne l'id
 * tel quel si c'est déjà un master.
 */
export const getMasterId = (id: string): string => {
  const sep = id.indexOf('::');
  return sep === -1 ? id : id.slice(0, sep);
};

export const isInstanceId = (id: string): boolean => id.includes('::');

/**
 * Étend un tableau d'événements en ajoutant les instances générées
 * par les récurrences `daily` / `weekly` dans la fenêtre [from, to].
 * Les événements `none` (ou sans champ) sont laissés tels quels.
 */
export function expandRecurringEvents(
  events: CalendarEvent[],
  from: Date,
  to: Date
): CalendarEvent[] {
  const out: CalendarEvent[] = [];

  for (const ev of events) {
    const recurrence = ev.recurrence ?? 'none';

    if (recurrence === 'none') {
      out.push(ev);
      continue;
    }

    const start = new Date(ev.start);
    const end = new Date(ev.end);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      out.push(ev);
      continue;
    }

    const durationMs = end.getTime() - start.getTime();
    const stepDays = recurrence === 'daily' ? 1 : 7;

    // Calcule la première occurrence à projeter dans [from, to]
    const cursor = new Date(start);
    if (cursor < from) {
      const diffDays = Math.floor((from.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24));
      const skipSteps = Math.floor(diffDays / stepDays);
      cursor.setDate(cursor.getDate() + skipSteps * stepDays);
      // Ajuster si on est encore avant `from`
      while (cursor < from) {
        cursor.setDate(cursor.getDate() + stepDays);
      }
    }

    let count = 0;
    while (cursor <= to && count < MAX_INSTANCES) {
      const instanceStart = new Date(cursor);
      const instanceEnd = new Date(instanceStart.getTime() + durationMs);
      const dateKey = instanceStart.toISOString().split('T')[0];

      out.push({
        ...ev,
        id: `${ev.id}::${dateKey}`,
        start: instanceStart.toISOString(),
        end: instanceEnd.toISOString(),
      });

      cursor.setDate(cursor.getDate() + stepDays);
      count++;
    }
  }

  return out;
}
