// ═══════════════════════════════════════════════════════════════════
// Récurrence des tâches (#26) — helpers purs, testés unitairement.
// À la complétion d'une tâche récurrente, l'occurrence suivante est générée
// (hooks.ts → useToggleTaskComplete). Les dates restent des YYYY-MM-DD
// calendaires locaux (convention projet, pas de toISOString).
// ═══════════════════════════════════════════════════════════════════
import { Task, TaskRecurrence, CreateTaskInput } from './types';

const toLocalYMD = (d: Date): string => d.toLocaleDateString('en-CA');

/**
 * Deadline de l'occurrence suivante. Base = max(deadline courante, aujourd'hui)
 * pour éviter de générer une occurrence déjà en retard quand on complète une
 * tâche restée plusieurs jours dans « En retard ».
 */
export function nextOccurrenceDeadline(
  deadline: string,
  recurrence: TaskRecurrence,
  now: Date = new Date()
): string | null {
  if (recurrence === 'none' || !deadline) return null;
  const parsed = new Date(deadline.slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date(now); today.setHours(12, 0, 0, 0);
  const base = parsed.getTime() >= today.getTime() ? parsed : today;
  const next = new Date(base);
  if (recurrence === 'daily') next.setDate(next.getDate() + 1);
  else if (recurrence === 'weekly') next.setDate(next.getDate() + 7);
  else if (recurrence === 'monthly') next.setMonth(next.getMonth() + 1);
  return toLocalYMD(next);
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
