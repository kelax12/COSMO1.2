// Logique pure de l'agenda : heure de scroll initiale + projection/mapping des
// événements vers le format FullCalendar. Extraite pour être testable.
// Comportement déplacé verbatim depuis AgendaPage.tsx.
import { expandRecurringEvents, type CalendarEvent } from '@/modules/events';
import { toDisplayISO, type TimezonePref } from '@/lib/timezone';

// Durée par défaut (minutes) d'un événement créé en glissant une tâche depuis la
// sidebar. Une tâche sans durée estimée a `estimatedTime = 0` (défaut du
// formulaire de création) : sans garde, FullCalendar reçoit `duration: 0` →
// l'aperçu (mirror) ET l'événement créé ont une hauteur nulle, donc invisibles.
// On retombe sur 60 min (cohérent avec EventModal/handleAddEvent).
export const DEFAULT_TASK_EVENT_MINUTES = 60;

export function taskEventDurationMinutes(estimatedTime: number | undefined | null): number {
  return typeof estimatedTime === 'number' && estimatedTime > 0
    ? estimatedTime
    : DEFAULT_TASK_EVENT_MINUTES;
}

// Heure de scroll initiale : 4 h avant l'heure courante (bornée à 00:00).
export function getInitialScrollTime(now: Date = new Date()): string {
  const hour = now.getHours();
  const scrollHour = Math.max(0, hour - 4);
  return `${scrollHour.toString().padStart(2, '0')}:00:00`;
}

// ── Fenêtre temporelle (pagination serveur de l'agenda) ────────────────
export interface EventsWindow { start: string; end: string; }

/**
 * Fenêtre par défaut au 1er rendu (avant le 1er datesSet de FullCalendar) :
 * large autour de `now` pour éviter un flash vide. Affinée ensuite par la plage
 * réellement visible (bufferedWindow).
 */
export function defaultEventsWindow(now: Date = new Date()): EventsWindow {
  const start = new Date(now); start.setMonth(start.getMonth() - 1);
  const end = new Date(now); end.setMonth(end.getMonth() + 2);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Élargit la plage visible de FullCalendar de ±bufferMonths pour limiter les
 * refetch lors de petites navigations (semaine suivante, etc.).
 */
export function bufferedWindow(rangeStart: Date, rangeEnd: Date, bufferMonths = 1): EventsWindow {
  const start = new Date(rangeStart); start.setMonth(start.getMonth() - bufferMonths);
  const end = new Date(rangeEnd); end.setMonth(end.getMonth() + bufferMonths);
  return { start: start.toISOString(), end: end.toISOString() };
}

export interface FullCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor: string;
  editable: boolean;
  extendedProps: {
    notes?: string;
    taskId?: string;
    isRecurringInstance: boolean;
    createdBy?: string;
    /** Créneau de tâche terminé qui attend une décision (pastille « ! »). */
    needsReview: boolean;
    /** Tâche liée déjà validée (check vert, à la place de la pastille). */
    taskDone: boolean;
  };
}

// Étend les événements récurrents sur ±13 mois autour de `now`, puis les mappe
// au format attendu par FullCalendar. Les instances récurrentes (id contenant
// '::') sont non éditables.
export function buildCalendarEvents(
  events: CalendarEvent[],
  now: Date = new Date(),
  /**
   * Identifiants des événements qui attendent une décision. Passé en argument
   * plutôt que recalculé ici : `findOverdueTaskSlots` a besoin des TÂCHES, que
   * ce module ne connaît pas et n'a aucune raison de connaître. Une seconde
   * dérivation de « ce créneau attend une décision » finirait par diverger de
   * celle qui peint le panneau de l'EventModal.
   */
  reviewEventIds: ReadonlySet<string> = new Set(),
  /** Identifiants des événements dont la tâche liée est déjà validée. Même
   * motif que `reviewEventIds` : calculé par `findDoneTaskEvents`, qui a
   * besoin des tâches. */
  doneEventIds: ReadonlySet<string> = new Set(),
): FullCalendarEvent[] {
  const projectionFrom = new Date(now);
  projectionFrom.setMonth(projectionFrom.getMonth() - 13);
  const projectionTo = new Date(now);
  projectionTo.setMonth(projectionTo.getMonth() + 13);
  const expandedEvents = expandRecurringEvents(events, projectionFrom, projectionTo);

  return expandedEvents.map(event => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    backgroundColor: event.color,
    borderColor: event.color,
    textColor: '#ffffff',
    editable: !event.id.includes('::'),
    extendedProps: {
      notes: event.notes,
      taskId: event.taskId,
      isRecurringInstance: event.id.includes('::'),
      createdBy: event.createdBy,
      needsReview: reviewEventIds.has(event.id),
      taskDone: doneEventIds.has(event.id),
    },
  }));
}

/**
 * Décale les instants start/end des événements dans le fuseau d'affichage choisi
 * (préférence utilisateur). Le calendrier reste rendu en heure locale : on lui
 * fournit donc des instants décalés pour qu'il affiche l'heure murale UTC+offset.
 * Les callbacks du calendrier (drag/resize/select) retirent ce décalage avant de
 * persister — cf. AgendaPage. En mode « défaut » c'est l'identité (référence
 * inchangée → pas de re-render superflu).
 */
// ── Drag depuis TaskSidebar (tâche perso ou d'équipe) ──────────────────

/** Payload JSON posé par `TaskSidebar` dans l'attribut `data-task`. */
export interface DraggedTaskData {
  id: string;
  name: string;
  priority: number;
  estimatedTime?: number;
  /** Absent pour une tâche d'équipe (TaskSidebar résout sa propre catégorie). */
  category?: string;
  /** Renseignés par `TaskSidebar` pour une tâche d'équipe uniquement — elle
   *  seule connaît `team_categories`. */
  categoryColor?: string;
  categoryName?: string;
  /** 'pro' = tâche d'équipe assignée ; absent/'perso' = tâche personnelle. */
  source?: 'perso' | 'pro';
}

export interface DraggedTaskEventData {
  title: string;
  duration: { minutes: number };
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    // 🔴 `taskId` UNDEFINED pour une tâche d'équipe : `events.task_id`
    // référence `tasks` (perso) par clé étrangère (migration 004), jamais
    // `team_tasks` — la définir ferait échouer l'écriture. `handleEventReceive`
    // (useCalendarGridGestures.ts) s'appuie sur cette absence.
    taskId: string | undefined;
    isTeamTask: boolean;
    priority: number;
    category: string | undefined;
    estimatedTime: number | undefined;
    categoryName: string;
  };
}

/**
 * Traduit une tâche déposée depuis `TaskSidebar` en événement FullCalendar
 * (aperçu du drag). Une tâche d'équipe (`source === 'pro'`) apporte déjà sa
 * couleur/nom de catégorie résolus par l'appelant (lui seul connaît
 * `team_categories`) ; une tâche perso se résout dans `categories` (module
 * `categories`, connu de cette page).
 */
export function resolveDraggedTaskEventData(
  taskData: DraggedTaskData,
  categories: readonly { id: string; color: string; name: string }[],
  uncategorizedLabel: string,
): DraggedTaskEventData {
  const isTeamTask = taskData.source === 'pro';
  const personalCategory = () => categories.find((cat) => cat.id === taskData.category);
  const catColor = isTeamTask
    ? (taskData.categoryColor || '#6B7280')
    : (personalCategory()?.color || '#6B7280');
  const catName = isTeamTask
    ? (taskData.categoryName || uncategorizedLabel)
    : (personalCategory()?.name || uncategorizedLabel);

  return {
    title: taskData.name,
    // Garde anti-aperçu-invisible : une tâche sans durée estimée
    // (estimatedTime = 0, défaut du formulaire) donnerait duration:0 →
    // mirror FullCalendar de hauteur nulle. On retombe sur 60 min.
    duration: { minutes: taskEventDurationMinutes(taskData.estimatedTime) },
    backgroundColor: catColor,
    borderColor: catColor,
    textColor: '#ffffff',
    extendedProps: {
      taskId: isTeamTask ? undefined : taskData.id,
      isTeamTask,
      priority: taskData.priority,
      category: taskData.category,
      estimatedTime: taskData.estimatedTime,
      categoryName: catName,
    },
  };
}

export function shiftEventsForDisplay(
  events: FullCalendarEvent[],
  pref: TimezonePref,
): FullCalendarEvent[] {
  if (pref.mode !== 'manual') return events;
  return events.map(ev => ({
    ...ev,
    start: toDisplayISO(ev.start, pref),
    end: toDisplayISO(ev.end, pref),
  }));
}
