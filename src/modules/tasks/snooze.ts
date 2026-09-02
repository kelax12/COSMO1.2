// Options de report rapide d'une deadline (#8 « snooze ») — logique pure.
//
// Trois raccourcis : demain, le prochain samedi (« ce week-end »), le prochain
// lundi (« semaine prochaine »).
//
// 🔴 `deadline` porte désormais l'INSTANT à stocker, pas une date nue.
// Auparavant ces options rendaient `'YYYY-MM-DD'`, envoyé tel quel dans
// `updateTask` : Postgres castait la chaîne en `timestamptz` à minuit UTC, donc
// à la veille au soir pour tout fuseau à décalage négatif. C'est l'un des trois
// chemins d'écriture divergents du risque R-01 ; ils passent tous par
// `@/lib/deadline` maintenant.

import { deadlineFromDayKey } from '@/lib/deadline';
import {
  addDaysToKey,
  todayKeyInTz,
  weekdayOfKey,
  getTimezonePref,
  type TimezonePref,
} from '@/lib/timezone';

export interface SnoozeOption {
  id: 'tomorrow' | 'weekend' | 'next-week';
  label: string;
  /** Instant à stocker (minuit du jour visé, dans le fuseau de la personne). */
  deadline: string;
}

/** Prochain jour de semaine STRICTEMENT après `dayKey` (ce jour-là → +7). */
const nextWeekdayKey = (dayKey: string, weekday: number): string => {
  const delta = (weekday - weekdayOfKey(dayKey) + 7) % 7 || 7;
  return addDaysToKey(dayKey, delta);
};

export function getSnoozeOptions(
  now: Date = new Date(),
  pref: TimezonePref = getTimezonePref(),
): SnoozeOption[] {
  const today = todayKeyInTz(pref, now);
  return [
    { id: 'tomorrow', label: 'Demain', deadline: deadlineFromDayKey(addDaysToKey(today, 1), pref) },
    { id: 'weekend', label: 'Ce week-end', deadline: deadlineFromDayKey(nextWeekdayKey(today, 6), pref) },
    { id: 'next-week', label: 'Semaine prochaine', deadline: deadlineFromDayKey(nextWeekdayKey(today, 1), pref) },
  ];
}
