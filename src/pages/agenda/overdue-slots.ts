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
 * la tâche existe encore et n'est pas validée. C'est la définition de « ce
 * créneau attend une décision » : elle pilote À LA FOIS la pastille peinte sur
 * le bloc d'événement et le panneau latéral de l'EventModal, qui sont deux
 * accès à la même question et ne doivent donc jamais diverger. Trié du plus ancien au plus
 * récent (on vide le backlog en commençant par le plus vieux).
 *
 * Exclus : événements récurrents (masters ou instances virtuelles `::`), dont la
 * fin est dans le futur, plus anciens que `windowDays`, sans tâche associée
 * existante, dont la tâche est déjà complétée, ou que la personne a demandé
 * d'ignorer (`reviewDismissedAt`, mig. 146).
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
    if (event.reviewDismissedAt) continue; // « Ignorer » : ne plus rien demander
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

/**
 * Identifiants des événements dont la TÂCHE liée est déjà validée.
 *
 * Sert à peindre un check vert à la place de la pastille « ! » : les deux
 * conditions se distinguent par `task.completed` seul (`findOverdueTaskSlots`
 * exige `!task.completed`, celle-ci l'inverse), donc jamais vraies en même
 * temps pour un même événement — pas besoin de les faire s'exclure
 * explicitement à l'affichage.
 *
 * ⚠️ Volontairement PLUS LARGE que `findOverdueTaskSlots` : aucune exclusion
 * de fenêtre, de récurrence ni de créneau futur. Une fois la tâche validée,
 * son check reste vrai pour TOUS ses événements, qu'ils soient passés ou à
 * venir — contrairement à la pastille, ce n'est pas une question qui expire.
 */
export function findDoneTaskEvents(events: CalendarEvent[], tasks: Task[]): Set<string> {
  const completedTaskIds = new Set(tasks.filter((t) => t.completed).map((t) => t.id));
  const result = new Set<string>();
  for (const event of events) {
    if (event.taskId && completedTaskIds.has(event.taskId)) result.add(event.id);
  }
  return result;
}
