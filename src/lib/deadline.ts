// ═══════════════════════════════════════════════════════════════════
// ÉCHÉANCES : une échéance est un JOUR ('YYYY-MM-DD'), jamais un instant
// ═══════════════════════════════════════════════════════════════════
//
// Dans tout le front, `Task.deadline` et `TeamTask.deadline` sont des clés de
// jour, '' pour « aucune ». Seules les frontières parlent aux colonnes :
// repository Supabase des tâches perso, démo, CLI. Règles : src/lib/CLAUDE.md.

import {
  dayKeyInTz,
  dayStartISOInTz,
  todayKeyInTz,
  daysBetweenKeys,
  type TimezonePref,
  getTimezonePref,
} from './timezone';

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Clé de jour d'une échéance du domaine ('' si absente). Un instant hérité est lu dans le fuseau retenu. */
export function deadlineDayKey(
  deadline: string | undefined | null,
  pref: TimezonePref = getTimezonePref(),
): string {
  if (!deadline) return '';
  if (DAY_KEY_RE.test(deadline)) return deadline;
  return dayKeyInTz(deadline, pref);
}

const PARIS_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
});

/**
 * Jour d'une valeur de l'ancienne colonne `tasks.deadline` (timestamptz).
 * Miroir exact de `public.echeance_jour` (mig. 251) : la base et le front
 * rendent le même jour, avant comme après la migration.
 *
 * - Instant au quart d'heure près : c'est un minuit écrit dans le fuseau de
 *   son auteur (UTC-10 à UTC+13). Le jour est celui de l'instant + 13 h, en UTC.
 * - Autre instant (anciens reports, imports) : jour vécu à Paris.
 */
export function dayKeyFromStoredDeadline(instant: string | undefined | null): string {
  if (!instant) return '';
  if (DAY_KEY_RE.test(instant)) return instant;
  const t = new Date(instant);
  if (Number.isNaN(t.getTime())) return '';
  const minuteAligned = t.getUTCSeconds() === 0 && t.getUTCMilliseconds() === 0 && t.getUTCMinutes() % 15 === 0;
  if (minuteAligned) return new Date(t.getTime() + 13 * 3_600_000).toISOString().slice(0, 10);
  return PARIS_DAY.format(t);
}

/** Jour → valeur de l'ancienne colonne `tasks.deadline` : minuit dans le fuseau retenu. */
export function storedDeadlineInstant(
  dayKey: string | undefined | null,
  pref: TimezonePref = getTimezonePref(),
): string {
  if (!dayKey) return '';
  return dayStartISOInTz(dayKey, pref);
}

/** Nombre de jours calendaires d'ici l'échéance : 0 aujourd'hui, -1 hier. */
export function daysUntilDeadline(
  deadline: string | undefined | null,
  pref: TimezonePref = getTimezonePref(),
  now: Date = new Date(),
): number {
  const key = deadlineDayKey(deadline, pref);
  if (!key) return NaN;
  return daysBetweenKeys(todayKeyInTz(pref, now), key);
}

/** L'échéance tombe-t-elle aujourd'hui, dans le fuseau retenu ? */
export function isDueToday(
  deadline: string | undefined | null,
  pref: TimezonePref = getTimezonePref(),
  now: Date = new Date(),
): boolean {
  return daysUntilDeadline(deadline, pref, now) === 0;
}

/**
 * En retard = échéance d'un jour RÉVOLU, pas d'un instant passé.
 *
 * Une tâche due aujourd'hui n'est pas en retard à 00 h 01, ce que faisait
 * l'ancienne comparaison `new Date(deadline) < new Date()` : elle basculait la
 * ligne en rouge dès la première seconde de la journée.
 */
export function isOverdue(
  deadline: string | undefined | null,
  completed: boolean,
  pref: TimezonePref = getTimezonePref(),
  now: Date = new Date(),
): boolean {
  if (completed) return false;
  const days = daysUntilDeadline(deadline, pref, now);
  return Number.isFinite(days) && days < 0;
}

/** Échéance → date LOCALE à midi, pour l'affichage (`new Date('YYYY-MM-DD')` lirait minuit UTC). */
export function deadlineLocalDate(
  deadline: string | undefined | null,
  pref: TimezonePref = getTimezonePref(),
): Date | null {
  const key = deadlineDayKey(deadline, pref);
  if (!key) return null;
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
