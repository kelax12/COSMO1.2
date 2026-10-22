// Écart d'une période à la précédente (maquette 194), dérivation pure.

export type PeriodDelta =
  | { kind: 'none' }
  | { kind: 'same' }
  | { kind: 'up' | 'down'; pct: number };

/**
 * `none` quand la période précédente vaut 0 : un « +100 % » ou un « +∞ »
 * n'apprend rien, et la première semaine mesurée n'a pas de point de départ.
 */
export function periodDelta(current: number, previous: number): PeriodDelta {
  if (!Number.isFinite(previous) || previous <= 0) return { kind: 'none' };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { kind: 'same' };
  return { kind: pct > 0 ? 'up' : 'down', pct: Math.abs(pct) };
}

/** Plages glissantes : la période courante (n jours jusqu'à aujourd'hui) et la précédente. */
export function rollingPair(today: Date, days: number): { current: { start: Date; end: Date }; previous: { start: Date; end: Date } } {
  const at = (offset: number) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    d.setDate(d.getDate() - offset);
    return d;
  };
  return {
    current: { start: at(days - 1), end: at(0) },
    previous: { start: at(2 * days - 1), end: at(days) },
  };
}
