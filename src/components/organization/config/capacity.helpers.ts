/**
 * Charge rapportée à la capacité hebdomadaire (mig. 196), en SEMAINES de
 * travail. `null` sans capacité déclarée, ou pour une capacité nulle : rien
 * n'est jugé qu'on ne sait pas mesurer (même règle que la charge médiane).
 * « Au-delà » = plus d'une semaine de capacité restante.
 */
export function capacityLoad(estimatedMinutes: number, weeklyMinutes: number | undefined): { weeks: number | null; over: boolean } {
  if (weeklyMinutes === undefined || weeklyMinutes <= 0) return { weeks: null, over: false };
  const weeks = estimatedMinutes / weeklyMinutes;
  return { weeks: Math.round(weeks * 10) / 10, over: weeks > 1 };
}
