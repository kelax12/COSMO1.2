// ═══════════════════════════════════════════════════════════════════
// Récurrence des tâches (#26) — helpers purs, testés unitairement.
// À la complétion d'une tâche récurrente, l'occurrence suivante est générée
// (hooks.ts → useToggleTaskComplete).
//
// 🔴 Le raisonnement se fait sur des CLÉS DE JOUR, la valeur rendue est un
// INSTANT (risque R-01). Avant, ce module lisait `deadline.slice(0, 10)` (le
// jour UTC, donc la veille à l'ouest) et rendait un `YYYY-MM-DD` nu, que
// `toggle_task_complete_v2` castait en timestamptz avec le fuseau du SERVEUR.
// L'occurrence suivante naissait donc à minuit UTC : déjà en retard pour qui
// vit à décalage négatif, à chaque validation. La mig. 133 fait accepter
// l'instant côté SQL.
// ═══════════════════════════════════════════════════════════════════
import { Task, TaskRecurrence, CreateTaskInput } from './types';
import { deadlineDayKey, deadlineFromDayKey } from '@/lib/deadline';
import { addDaysToKey, todayKeyInTz, getTimezonePref, type TimezonePref } from '@/lib/timezone';

/**
 * Deadline de l'occurrence suivante. Base = max(deadline courante, aujourd'hui)
 * pour éviter de générer une occurrence déjà en retard quand on complète une
 * tâche restée plusieurs jours dans « En retard ».
 */
export function nextOccurrenceDeadline(
  deadline: string,
  recurrence: TaskRecurrence,
  now: Date = new Date(),
  pref: TimezonePref = getTimezonePref(),
): string | null {
  if (recurrence === 'none') return null;
  const currentKey = deadlineDayKey(deadline, pref);
  if (!currentKey) return null;
  const todayKey = todayKeyInTz(pref, now);
  // Base = la plus tardive des deux, pour ne pas générer une occurrence déjà
  // en retard quand on valide une tâche restée des jours dans « En retard ».
  const baseKey = currentKey >= todayKey ? currentKey : todayKey;

  let nextKey: string;
  if (recurrence === 'daily') {
    nextKey = addDaysToKey(baseKey, 1);
  } else if (recurrence === 'weekly') {
    nextKey = addDaysToKey(baseKey, 7);
  } else {
    // Mensuel : le mois n'a pas de longueur fixe, donc pas d'arithmétique en
    // jours. On avance sur le calendrier UTC, où `setUTCMonth` ne subit aucun
    // effet d'heure d'été.
    const [y, m, d] = baseKey.split('-').map(Number);
    const cursor = new Date(Date.UTC(y, m - 1, d));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    nextKey = cursor.toISOString().slice(0, 10);
  }
  return deadlineFromDayKey(nextKey, pref);
}

/**
 * Construit l'input de la prochaine occurrence à partir de la tâche complétée.
 * Repart d'une tâche propre : non complétée, sous-tâches décochées, sans
 * champs collaboratifs (le partage ne se propage pas automatiquement).
 */
export function buildNextOccurrence(task: Task, now: Date = new Date()): CreateTaskInput | null {
  const recurrence = task.recurrence ?? 'none';
  const nextDeadline = nextOccurrenceDeadline(task.deadline, recurrence, now);
  if (!nextDeadline) return null;
  return {
    name: task.name,
    description: task.description,
    priority: task.priority,
    category: task.category,
    deadline: nextDeadline,
    estimatedTime: task.estimatedTime,
    bookmarked: task.bookmarked,
    completed: false,
    subtasks: (task.subtasks ?? []).map((s) => ({ ...s, completed: false })),
    krId: task.krId,
    recurrence,
  };
}
