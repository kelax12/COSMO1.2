import { Task } from '@/modules/tasks';
import { CalendarEvent } from '@/modules/events';
import { Habit } from '@/modules/habits';
import { OKR } from '@/modules/okrs';
import type { KRCompletion } from '@/modules/kr-completions/types';

export function parseLocalDate(dateString: string): Date {
  const date = new Date(dateString);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface WorkTimeData {
  tasks: Task[];
  events: CalendarEvent[];
  habits: Habit[];
  okrs: OKR[];
  /**
   * Journal append-only des complétions de KR. Sans lui, `okrTime` vaut 0 :
   * c'est la SEULE source du temps investi sur les OKR (cf. ci-dessous).
   */
  krCompletions: KRCompletion[];
}

interface HabitWithPeriodCompletions extends Habit {
  periodCompletions: number;
}

// ═══════════════════════════════════════════════════════════════════
// TEMPS INVESTI SUR LES OKR — il vient de `kr_completions`, de rien d'autre
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (revue du 2026-09-02). Ce fichier calculait `okrTime` en lisant
// `kr.history`, un tableau `{ date, increment }` porté par chaque Key Result.
// Ce champ N'EXISTE PAS : il est absent de l'interface `KeyResult`
// (`src/modules/okrs/types.ts`), absent des mappers, et `grep "history:" src`
// ne rend AUCUN écrivain. `(kr as … ).history || []` rendait donc toujours un
// tableau vide, et `okrTime` valait **structurellement zéro**.
//
// La même lecture morte existait dans `get_work_time_stats` (mig. 127), donc la
// page Statistiques affichait 0 pour les OKR en démo COMME en production. Seuls
// les deux graphiques du tableau de bord donnaient le bon chiffre, parce qu'ils
// avaient chacun leur propre `calcOkrTime` lisant `kr_completions` : trois
// implémentations, dont deux justes et une morte, et c'est la morte qui servait
// la page dédiée aux statistiques.
//
// Le journal `kr_completions` est le remplaçant de `history` (une ligne = une
// rep, cf. `src/modules/okrs/supabase.repository.ts → recordKRReps`). C'est lui
// qui fait foi, et il n'y a plus qu'un seul calcul, ici.
//
// ⚠️ La comparaison porte sur des INSTANTS, comme les tâches et les événements
// juste au-dessus, et comme le faisait déjà le tableau de bord. Tous les
// appelants passent un `endDate` posé à 23:59:59.999, donc la journée de fin
// est incluse.

/** Minutes estimées par identifiant de KR, tous objectifs confondus. */
const krMinutesById = (okrs: readonly OKR[]): Map<string, number> => {
  const minutes = new Map<string, number>();
  for (const okr of okrs) {
    for (const kr of okr.keyResults || []) minutes.set(kr.id, kr.estimatedTime || 0);
  }
  return minutes;
};

/**
 * Temps investi sur chaque OBJECTIF pendant la période, en minutes.
 *
 * Rendu par objectif et non en total : la page Statistiques a besoin du détail
 * par OKR, le reste de l'app du total. Les dériver du même parcours est ce qui
 * garantit que le détail somme exactement au total affiché au-dessus de lui.
 *
 * Une complétion dont le KR n'existe plus (objectif supprimé, KR retiré) compte
 * pour 0 minute mais reste rattachée à son objectif : on n'invente pas une
 * durée, et on ne fait pas disparaître la ligne non plus.
 */
export function okrTimeByObjective(
  startDate: Date,
  endDate: Date,
  krCompletions: readonly KRCompletion[],
  okrs: readonly OKR[],
): Map<string, number> {
  const minutes = krMinutesById(okrs);
  const byObjective = new Map<string, number>();
  for (const completion of krCompletions) {
    const at = new Date(completion.completedAt);
    if (Number.isNaN(at.getTime()) || at < startDate || at > endDate) continue;
    const value = minutes.get(completion.krId) ?? 0;
    byObjective.set(completion.okrId, (byObjective.get(completion.okrId) ?? 0) + value);
  }
  return byObjective;
}

/** Temps investi sur l'ensemble des OKR pendant la période, en minutes. */
export function okrTimeForPeriod(
  startDate: Date,
  endDate: Date,
  krCompletions: readonly KRCompletion[],
  okrs: readonly OKR[],
): number {
  let total = 0;
  for (const value of okrTimeByObjective(startDate, endDate, krCompletions, okrs).values()) {
    total += value;
  }
  return total;
}

export function calculateWorkTimeForPeriod(
  startDate: Date,
  endDate: Date,
  data: WorkTimeData
) {
  const { tasks, events, habits, okrs, krCompletions } = data;

  const completedTasks = tasks.filter((task) => {
    if (!task.completed || !task.completedAt) return false;
    const completedDate = parseLocalDate(task.completedAt);
    return completedDate >= startDate && completedDate <= endDate;
  });

  const filteredEvents = events.filter((event) => {
    const eventDate = parseLocalDate(event.start);
    return eventDate >= startDate && eventDate <= endDate;
  });

  const tasksTime = completedTasks.reduce((sum, task) => sum + (task.estimatedTime || 0), 0);

  const eventsTime = filteredEvents.reduce((sum, event) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    return sum + (end.getTime() - start.getTime()) / (1000 * 60);
  }, 0);

  let habitsTime = 0;
  const filteredHabits: HabitWithPeriodCompletions[] = [];
  
  habits.forEach((habit) => {
    let completionsCount = 0;
    Object.keys(habit.completions || {}).forEach((dateStr) => {
      if (habit.completions[dateStr]) {
        const hDate = parseLocalDate(dateStr);
        if (hDate >= startDate && hDate <= endDate) {
          completionsCount++;
        }
      }
    });
    if (completionsCount > 0) {
      habitsTime += completionsCount * (habit.estimatedTime || 0);
      filteredHabits.push({ ...habit, periodCompletions: completionsCount });
    }
  });

  const okrTime = okrTimeForPeriod(startDate, endDate, krCompletions, okrs);

  const totalTime = tasksTime + eventsTime + habitsTime + okrTime;

  return {
    completedTasks,
    events: filteredEvents,
    habits: filteredHabits,
    totalTime,
    tasksTime,
    eventsTime,
    habitsTime,
    okrTime,
  };
}
