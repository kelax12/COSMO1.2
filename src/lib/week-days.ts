// Jours de la semaine localisés (valeurs `Date.getDay()` : 0 = dimanche).
// Module léger, sans React : partagé par la feuille de sélection des jours,
// les jours prévus d'une habitude et l'onboarding.
import { formatDate } from '@/i18n/format';
import { isEveryDay, normalizeScheduledDays } from '@/modules/habits/schedule';

/** Lundi d'abord, dimanche en dernier. */
export const WEEK_DAY_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Nom complet du jour `d` dans la langue de l'app. Le 7 janvier 2024 est un
 * dimanche : `+ d` donne le bon jour (garde `date-format.guard`, AM-3).
 */
export const weekDayName = (d: number): string =>
  capitalize(formatDate(new Date(2024, 0, 7 + d), { weekday: 'long' }));

/** Abréviation localisée : « Lun », « Mon ». */
export const shortWeekDay = (d: number): string =>
  capitalize(formatDate(new Date(2024, 0, 7 + d), { weekday: 'short' }).replace(/\.$/, ''));

/** « Tous les jours » si 7 jours (ou aucun), sinon « Lun, Mer, Ven ». */
export function scheduledDaysLabel(days: readonly number[] | undefined, everyDay: string): string {
  if (isEveryDay(days)) return everyDay;
  const set = new Set(normalizeScheduledDays(days));
  return WEEK_DAY_ORDER.filter((d) => set.has(d)).map(shortWeekDay).join(', ');
}
