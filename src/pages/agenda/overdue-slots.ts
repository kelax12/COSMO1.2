// Détection des créneaux de tâche terminés (feature « revue de créneau »).
//
// Quand une tâche a été planifiée dans l'agenda (événement lié via `taskId`) et
// que son créneau horaire est passé sans que la tâche soit validée, on propose à
// l'utilisateur, à son retour sur l'agenda, de : valider / reporter / supprimer.
// Logique pure et testable ; l'orchestration (mutations, file d'attente) vit
// dans AgendaPage.
import type { CalendarEvent } from '@/modules/events';
import type { Task } from '@/modules/tasks';

export interface OverdueTaskSlot {
  event: CalendarEvent;
  task: Task;
}

export interface FindOverdueOptions {
  /** Fenêtre en arrière (jours) : on ignore les créneaux trop anciens. */
  windowDays?: number;
}

/**
 * Retourne les événements liés à une tâche dont le créneau est terminé et dont
 * la tâche existe encore et n'est pas validée. Trié du plus ancien au plus
 * récent (on vide le backlog en commençant par le plus vieux).
 *
 * Exclus : événements récurrents (masters ou instances virtuelles `::`), dont la
 * fin est dans le futur, plus anciens que `windowDays`, sans tâche associée
 * existante, ou dont la tâche est déjà complétée.
 */
export function findOverdueTaskSlots(
  events: CalendarEvent[],
  tasks: Task[],
  now: Date = new Date(),
  { windowDays = 14 }: FindOverdueOptions = {},
): OverdueTaskSlot[] {
  const nowMs = now.getTime();
  const floorMs = nowMs - windowDays * 24 * 60 * 60 * 1000;
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  const result: OverdueTaskSlot[] = [];
  for (const event of events) {
    if (!event.taskId) continue;
    if (event.id.includes('::')) continue; // instance récurrente virtuelle
    if (event.recurrence && event.recurrence !== 'none') continue; // master récurrent
    const endMs = new Date(event.end).getTime();
    if (Number.isNaN(endMs)) continue;
    if (endMs >= nowMs) continue; // créneau pas encore terminé
    if (endMs < floorMs) continue; // trop ancien
    const task = taskById.get(event.taskId);
    if (!task || task.completed) continue;
    result.push({ event, task });
  }

  result.sort((a, b) => new Date(a.event.end).getTime() - new Date(b.event.end).getTime());
  return result;
}
