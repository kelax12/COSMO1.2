// Calcul de streak simple — logique pure, testée dans streak.test.ts.
//
// Série de jours consécutifs cochés, en remontant depuis aujourd'hui (ou hier
// si aujourd'hui n'est pas encore coché — la journée n'est pas finie). Un seul
// jour manqué remet la série à zéro (pas de joker/gel : cf. suppression 2026-07).

import type { Habit } from './types';
import { scheduleOf } from './schedule';

const dayKey = (d: Date): string => d.toLocaleDateString('en-CA');

/**
 * Bascule d'un jour, au contrat de `habit_completions` (mig. 248) : la carte
 * ne porte que les jours COCHÉS. Décocher RETIRE la clé, jamais `false`, comme
 * la RPC qui rend la fenêtre depuis la table. Démo et cache optimiste passent
 * par ici pour que la même carte sorte des deux côtés.
 */
export function toggleCompletionDay(
  completions: Record<string, boolean>,
  date: string,
): Record<string, boolean> {
  const { [date]: wasDone, ...rest } = completions;
  return wasDone ? rest : { ...rest, [date]: true };
}

//
// Jours prévus (mig. 251) : un jour pour lequel `isScheduled` rend faux est
// NEUTRE, il ne casse ni ne prolonge la série. Même règle que le SQL.
export function calculateStreak(
  completions: Record<string, boolean>,
  now: Date = new Date(),
  isScheduled: (dayKey: string) => boolean = () => true,
): number {
  const cursor = new Date(now);
  // Aujourd'hui prévu mais pas encore coché → la journée n'est pas finie.
  const todayKey = dayKey(cursor);
  if (isScheduled(todayKey) && !completions[todayKey]) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  for (let dayIndex = 0; dayIndex < 3650; dayIndex++) {
    const key = dayKey(cursor);
    cursor.setDate(cursor.getDate() - 1);
    if (!isScheduled(key)) continue;
    if (!completions[key]) break;
    streak++;
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
  habit: Pick<Habit, 'completions' | 'streakCurrent' | 'scheduledDays' | 'scheduleHistory'>,
  now: Date = new Date(),
): number {
  return habit.streakCurrent ?? calculateStreak(habit.completions, now, scheduleOf(habit));
}
