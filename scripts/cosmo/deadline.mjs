// Échéances du CLI, miroir Node de src/lib/deadline.ts (règles : src/lib/CLAUDE.md § Échéances).
// Le CLI ne connaît pas la préférence de fuseau (localStorage) : fuseau de la MACHINE.

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const at = (dayKey, h, m, s, ms) => {
  if (!dayKey) return null;
  const d = DAY_KEY_RE.exec(String(dayKey));
  return d ? new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), h, m, s, ms).toISOString() : dayKey;
};

/** Jour → instant de minuit (ancienne colonne `tasks.deadline`, avant la mig. 253). */
export const deadlineToTimestamp = (dayKey) => at(dayKey, 0, 0, 0, 0);
/** Dernier instant du jour (borne haute incluse). */
export const deadlineEndOfDay = (dayKey) => at(dayKey, 23, 59, 59, 999);

const PARIS_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Ancienne valeur → jour. Miroir de `public.echeance_jour` (mig. 251). */
export function dayKeyFromStoredDeadline(value) {
  if (!value) return '';
  const s = String(value);
  if (DAY_KEY_RE.test(s)) return s;
  const t = new Date(s);
  if (Number.isNaN(t.getTime())) return '';
  if (t.getUTCSeconds() === 0 && t.getUTCMilliseconds() === 0 && t.getUTCMinutes() % 15 === 0) {
    return new Date(t.getTime() + 13 * 3_600_000).toISOString().slice(0, 10);
  }
  return PARIS_DAY.format(t);
}

export const deadlineDayKey = dayKeyFromStoredDeadline;
