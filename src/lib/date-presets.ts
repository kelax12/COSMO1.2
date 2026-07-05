// ═══════════════════════════════════════════════════════════════════
// Presets de dates des pickers (#25) — helpers purs, testés unitairement.
// Convention projet : dates calendaires locales au format YYYY-MM-DD
// (toLocaleDateString 'en-CA'), jamais toISOString (décalage UTC nocturne).
// ═══════════════════════════════════════════════════════════════════

const toLocalYMD = (d: Date): string => d.toLocaleDateString('en-CA');

const addDays = (base: Date, days: number): Date => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

export const todayStr = (now: Date = new Date()): string => toLocalYMD(now);

export const tomorrowStr = (now: Date = new Date()): string => toLocalYMD(addDays(now, 1));

/**
 * Prochain samedi. Si on est déjà samedi ou dimanche, retourne le samedi
 * suivant (le « week-end » d'une tâche saisie le week-end = le prochain).
 */
export const weekendStr = (now: Date = new Date()): string => {
  const day = now.getDay(); // 0=dim … 6=sam
  let delta = (6 - day + 7) % 7;
  if (delta === 0) delta = 7; // samedi → samedi suivant
  if (day === 0) delta = 6;   // dimanche → samedi suivant
  return toLocalYMD(addDays(now, delta));
};

/** Lundi de la semaine suivante. */
export const nextWeekStr = (now: Date = new Date()): string => {
  const day = now.getDay(); // 0=dim … 6=sam
  const delta = day === 0 ? 1 : 8 - day;
  return toLocalYMD(addDays(now, delta));
};

export interface DatePreset {
  label: string;
  /** '' = pas de date. */
  value: string;
}

export const buildDatePresets = (now: Date = new Date()): DatePreset[] => [
  { label: "Aujourd'hui", value: todayStr(now) },
  { label: 'Demain', value: tomorrowStr(now) },
  { label: 'Ce week-end', value: weekendStr(now) },
  { label: 'Semaine proch.', value: nextWeekStr(now) },
];
