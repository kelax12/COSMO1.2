// Calcul de streak simple — logique pure, testée dans streak.test.ts.
//
// Série de jours consécutifs cochés, en remontant depuis aujourd'hui (ou hier
// si aujourd'hui n'est pas encore coché — la journée n'est pas finie). Un seul
// jour manqué remet la série à zéro (pas de joker/gel : cf. suppression 2026-07).

const dayKey = (d: Date): string => d.toLocaleDateString('en-CA');

export function calculateStreak(
  completions: Record<string, boolean>,
  now: Date = new Date()
): number {
  const cursor = new Date(now);
  // Aujourd'hui pas encore coché → la série se juge à partir d'hier.
  if (!completions[dayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  for (let dayIndex = 0; dayIndex < 3650; dayIndex++) {
    if (!completions[dayKey(cursor)]) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
