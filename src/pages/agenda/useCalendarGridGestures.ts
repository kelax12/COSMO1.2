// ═══════════════════════════════════════════════════════════════════
// Les trois gestes qui écrivent depuis la GRILLE
//
// Déplacer un événement, le redimensionner, déposer une tâche dessus. Les
// trois font le même travail : lire un instant rendu par FullCalendar, lui
// RETIRER le décalage du fuseau d'affichage, puis persister l'instant
// « vrai ». C'est cette conversion qui les réunit, pas leur longueur.
//
// 🔴 Le décalage se retire ICI, à la frontière. Un instant qui remonte de la
// grille sans passer par `fromDisplayISO` est faux de la valeur du réglage
// « heure personnalisée », et le reste de la page (conflits, prochain créneau
// libre, EventModal) raisonne sur des instants vrais.
//
// FRONTIÈRE : ce hook ne connaît ni les modales, ni la revue des créneaux,
// ni le panneau des tâches. Il reçoit les événements chargés et deux
// écritures.
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import type { EventDropArg } from '@fullcalendar/core';
import type { EventReceiveArg, EventResizeDoneArg } from '@fullcalendar/interaction';
import type { CalendarEvent, CreateEventInput } from '@/modules/events';
import { fromDisplayISO, type TimezonePref } from '@/lib/timezone';
import { taskEventDurationMinutes } from './calendar-events';
import { findSourceEvent } from './find-event';

interface Params {
  events: CalendarEvent[];
  tzPref: TimezonePref;
  createEvent: (input: CreateEventInput) => void;
  updateEvent: (id: string, updates: { start: string; end: string }) => void;
}

export function useCalendarGridGestures({ events, tzPref, createEvent, updateEvent }: Params) {
  const handleEventDrop = (dropInfo: EventDropArg) => {
    const taskId = dropInfo.event.extendedProps?.taskId;
    const event = findSourceEvent(events, dropInfo.event.id, taskId);
    if (!event) return;
    const rawStart = dropInfo.event.start?.toISOString();
    if (!rawStart) return;
    const rawEnd = dropInfo.event.end
      ? dropInfo.event.end.toISOString()
      : new Date((dropInfo.event.start?.getTime() ?? Date.now()) + 3600000).toISOString();
    // Retire le décalage d'affichage avant de persister l'instant « vrai ».
    updateEvent(event.id, {
      start: fromDisplayISO(rawStart, tzPref),
      end: fromDisplayISO(rawEnd, tzPref),
    });
  };

  // Persiste un redimensionnement (resize) d'event — tactile mobile ET souris
  // desktop. Sans ce handler, FullCalendar applique le resize visuellement mais
  // ne le persiste jamais : au prochain rendu l'event revient à sa durée initiale.
  const handleEventResize = (resizeInfo: EventResizeDoneArg) => {
    const taskId = resizeInfo.event.extendedProps?.taskId;
    const event = findSourceEvent(events, resizeInfo.event.id, taskId);
    if (!event) { resizeInfo.revert(); return; }
    const rawStart = resizeInfo.event.start?.toISOString();
    const rawEnd = resizeInfo.event.end?.toISOString();
    if (!rawStart || !rawEnd) { resizeInfo.revert(); return; }
    updateEvent(event.id, {
      start: fromDisplayISO(rawStart, tzPref),
      end: fromDisplayISO(rawEnd, tzPref),
    });
  };

  const handleEventReceive = (receiveInfo: EventReceiveArg) => {
    const eventData = receiveInfo.event;
    const rawStart = eventData.start?.toISOString() ?? new Date().toISOString();
    const rawEnd = eventData.end
      ? eventData.end.toISOString()
      : new Date((eventData.start?.getTime() ?? Date.now()) + taskEventDurationMinutes(eventData.extendedProps.estimatedTime as number) * 60000).toISOString();
    const newEvent: CreateEventInput = {
      title: eventData.title,
      // Retire le décalage d'affichage (la tâche est déposée sur la grille
      // décalée) pour stocker l'instant « vrai ».
      start: fromDisplayISO(rawStart, tzPref),
      end: fromDisplayISO(rawEnd, tzPref),
      color: eventData.backgroundColor ?? undefined,
      notes: `Priorité: ${eventData.extendedProps.priority} | Catégorie: ${eventData.extendedProps.categoryName}`,
      taskId: eventData.extendedProps.taskId as string,
    };
    const isDuplicate = events.some((e) =>
      (newEvent.taskId && e.taskId === newEvent.taskId) ||
      (e.title === newEvent.title && e.start === newEvent.start && e.end === newEvent.end)
    );
    if (isDuplicate) { receiveInfo.event.remove(); return; }
    createEvent(newEvent);
  };

  return { handleEventDrop, handleEventResize, handleEventReceive };
}
