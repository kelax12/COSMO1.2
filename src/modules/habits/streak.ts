// Calcul de streak avec joker (#23) — logique pure, testée dans streak.test.ts.
//
// Série de jours consécutifs cochés, en remontant depuis aujourd'hui (ou hier
// si aujourd'hui n'est pas encore coché — la journée n'est pas finie).
// Joker : 1 jour manqué toléré par fenêtre glissante de 7 jours — un oubli
// ponctuel ne casse pas la série (le jour manqué ne compte pas dans le total).

const dayKey = (d: Date): string => d.toLocaleDateString('en-CA');

export interface StreakResult {
  /** Nombre de jours cochés dans la série. */
  streak: number;
  /** true si la série en cours a survécu grâce à un joker. */
  jokerUsed: boolean;
}

export function calculateStreakWithJoker(
  completions: Record<string, boolean>,
  now: Date = new Date(),
  jokerPerWeek = 1
): StreakResult {
  const cursor = new Date(now);
  // Aujourd'hui pas encore coché → la série se juge à partir d'hier.
  if (!completions[dayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  // Indices (jours écoulés depuis le départ) où un joker a été consommé.
  const jokerDays: number[] = [];
  // Index du jour coché le plus ancien de la série — sert à distinguer un
  // joker « au milieu » (utile) d'un joker en bout de série (sans objet).
  let lastCheckedIndex = -1;

  for (let dayIndex = 0; dayIndex < 3650; dayIndex++) {
    if (completions[dayKey(cursor)]) {
      streak++;
      lastCheckedIndex = dayIndex;
    } else {
      // Jour manqué : consommable par un joker si la fenêtre de 7 jours
      // n'en a pas déjà utilisé `jokerPerWeek`.
      const usedInWindow = jokerDays.filter(i => dayIndex - i < 7).length;
      if (usedInWindow >= jokerPerWeek) break;
      // Un joker ne sauve la série que s'il reste des jours cochés avant.
      jokerDays.push(dayIndex);
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  // Seuls les jokers situés ENTRE deux jours cochés ont servi la série ;
  // ceux en bout de série (plus anciens que le dernier jour coché) sont inertes.
  const jokerUsed = jokerDays.some(i => i < lastCheckedIndex);

  return { streak, jokerUsed };
}
