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

/**
 * Série d'une habitude, en préférant le chiffre calculé par le serveur.
 *
 * ⚠️ **Utiliser CECI et non `calculateStreak(habit.completions)` partout où on
 * dispose de l'objet `Habit` complet.**
 *
 * Depuis la mig. 119, `habit.completions` est BORNÉ à une fenêtre glissante en
 * mode Supabase (400 jours par défaut) : la colonne gagnait une entrée par jour
 * et par habitude, sans fin. Calculer la série sur cette fenêtre plafonnerait
 * silencieusement à 400 le compteur d'un utilisateur assidu depuis trois ans —
 * un chiffre FAUX, affiché comme s'il était juste.
 *
 * `streakCurrent` est calculé côté serveur sur l'historique ENTIER. Le repli
 * sur le calcul JS couvre le mode démo et le repository local, où `completions`
 * contient effectivement tout.
 */
export function habitStreak(
  habit: { completions: Record<string, boolean>; streakCurrent?: number },
  now: Date = new Date(),
): number {
  return habit.streakCurrent ?? calculateStreak(habit.completions, now);
}
