// Prochain créneau libre (#19) — logique pure, testée dans free-slot.test.ts.
//
// Cherche le premier trou d'au moins `durationMin` minutes entre `now`
// (arrondi au quart d'heure suivant) et 22 h. Si la journée est pleine,
// propose demain 9 h. Utilisé pour pré-remplir EventModal quand l'utilisateur
// clique « Nouveau » sans avoir sélectionné de plage.

interface TimedEvent {
  start: string;
  end: string;
}

const DAY_END_HOUR = 22;
const NEXT_DAY_START_HOUR = 9;

/** Arrondit au prochain quart d'heure (10:07 → 10:15, 10:15 → 10:15). */
const roundUpToQuarter = (d: Date): Date => {
  const r = new Date(d);
  r.setSeconds(0, 0);
  const rest = r.getMinutes() % 15;
  if (rest !== 0) r.setMinutes(r.getMinutes() + (15 - rest));
  return r;
};

export function findNextFreeSlot(
  events: TimedEvent[],
  now: Date = new Date(),
  durationMin = 60
): { start: string; end: string } {
  const durationMs = durationMin * 60_000;

  const dayEnd = new Date(now);
  dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);

  // Événements du jour qui se terminent après `now`, triés par début.
  const busy = events
    .map(e => ({ start: new Date(e.start), end: new Date(e.end) }))
    .filter(e => !isNaN(e.start.getTime()) && !isNaN(e.end.getTime()))
    .filter(e => e.end > now && e.start < dayEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  let cursor = roundUpToQuarter(now);

  for (const e of busy) {
    if (e.start.getTime() - cursor.getTime() >= durationMs) break;
    if (e.end > cursor) cursor = roundUpToQuarter(e.end);
  }

  // Journée pleine → demain matin.
  if (cursor.getTime() + durationMs > dayEnd.getTime()) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(NEXT_DAY_START_HOUR, 0, 0, 0);
    cursor = tomorrow;
  }

  return {
    start: cursor.toISOString(),
    end: new Date(cursor.getTime() + durationMs).toISOString(),
  };
}
