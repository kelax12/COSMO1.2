// Options de report rapide d'une deadline (#8 « snooze ») — logique pure.
//
// Trois raccourcis : demain, le prochain samedi (« ce week-end »), le prochain
// lundi (« semaine prochaine »). Dates au format local YYYY-MM-DD (en-CA),
// cohérent avec le champ canonique `task.deadline`.

export interface SnoozeOption {
  id: 'tomorrow' | 'weekend' | 'next-week';
  label: string;
  deadline: string;
}

const toLocalDateString = (d: Date): string => d.toLocaleDateString('en-CA');

const addDays = (base: Date, days: number): Date => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

/** Prochain jour de semaine STRICTEMENT après `base` (base = ce jour → +7). */
const nextWeekday = (base: Date, weekday: number): Date => {
  const delta = (weekday - base.getDay() + 7) % 7 || 7;
  return addDays(base, delta);
};

export function getSnoozeOptions(now: Date = new Date()): SnoozeOption[] {
  return [
    { id: 'tomorrow', label: 'Demain', deadline: toLocalDateString(addDays(now, 1)) },
    { id: 'weekend', label: 'Ce week-end', deadline: toLocalDateString(nextWeekday(now, 6)) },
    { id: 'next-week', label: 'Semaine prochaine', deadline: toLocalDateString(nextWeekday(now, 1)) },
  ];
}
