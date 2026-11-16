// Options de report rapide d'une deadline (#8 « snooze ») — logique pure.
//
// Deux raccourcis : demain, et dans une semaine (aujourd'hui + 7 jours).
//
// 🔴 `deadline` porte désormais l'INSTANT à stocker, pas une date nue.
// Auparavant ces options rendaient `'YYYY-MM-DD'`, envoyé tel quel dans
// `updateTask` : Postgres castait la chaîne en `timestamptz` à minuit UTC, donc
// à la veille au soir pour tout fuseau à décalage négatif. C'est l'un des trois
// chemins d'écriture divergents du risque R-01 ; ils passent tous par
// `@/lib/deadline` maintenant.

import {
  addDaysToKey,
  todayKeyInTz,
  getTimezonePref,
  type TimezonePref,
} from '@/lib/timezone';

export interface SnoozeOption {
  id: 'tomorrow' | 'next-week';
  /**
   * Clé du catalogue `tasks`, jamais la phrase.
   *
   * ⚠️ Ce module est pur et appelé hors rendu : y écrire « Demain » figeait le
   * libellé en français pour toute la session, quelle que soit la langue.
   */
  labelKey: 'snooze.tomorrow' | 'snooze.nextWeek';
  /** Instant à stocker (minuit du jour visé, dans le fuseau de la personne). */
  deadline: string;
}

export function getSnoozeOptions(
  now: Date = new Date(),
  pref: TimezonePref = getTimezonePref(),
): SnoozeOption[] {
  const today = todayKeyInTz(pref, now);
  return [
    { id: 'tomorrow', labelKey: 'snooze.tomorrow', deadline: addDaysToKey(today, 1) },
    { id: 'next-week', labelKey: 'snooze.nextWeek', deadline: addDaysToKey(today, 7) },
  ];
}
