// Échéances du CLI, miroir Node de src/lib/deadline.ts (règles : src/lib/CLAUDE.md § Échéances).
// Le CLI ne connaît pas la préférence de fuseau (localStorage) : fuseau de la MACHINE.

// Les tâches perso lisent et écrivent `tasks.due_date`, un jour (DAT-01) : plus
// aucune conversion jour → instant. Reste la lecture d'un instant saisi.
const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const PARIS_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Instant → jour. Miroir de `public.echeance_jour` (mig. 251). */
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
