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

/** Lundi de la semaine suivante. */
export const nextWeekStr = (now: Date = new Date()): string => {
  const day = now.getDay(); // 0=dim … 6=sam
  const delta = day === 0 ? 1 : 8 - day;
  return toLocalYMD(addDays(now, delta));
};

/**
 * Clé de catalogue, jamais un libellé.
 *
 * 🔴 Ces trois presets portaient « Aujourd'hui », « Demain » et « Lundi
 * prochain » EN DUR, et ils sont rendus par les deux pickers du produit — le
 * calendrier desktop et la feuille mobile de la modale de tâche. Un visiteur
 * anglophone les voyait donc en français (revue du 2026-09-02, point 5). Les
 * traduire ici est impossible : ce module est pur, il n'a pas de locale.
 */
export type DatePresetKey = 'datePicker.today' | 'datePicker.tomorrow' | 'datePicker.nextMonday';

export interface DatePreset {
  labelKey: DatePresetKey;
  /** '' = pas de date. */
  value: string;
}

export const buildDatePresets = (now: Date = new Date()): DatePreset[] => [
  { labelKey: 'datePicker.today', value: todayStr(now) },
  { labelKey: 'datePicker.tomorrow', value: tomorrowStr(now) },
  { labelKey: 'datePicker.nextMonday', value: nextWeekStr(now) },
];
