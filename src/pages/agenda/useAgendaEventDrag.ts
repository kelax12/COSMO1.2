import { useRef } from 'react';
import type { EventApi } from '@fullcalendar/core';
import { type CalendarEvent, getMasterId } from '@/modules/events';
import { findSourceEvent } from './find-event';

// FullCalendar v6 ne ré-exporte pas EventDragStartArg/EventDragStopArg depuis
// core. Type local minimal couvrant ce que les handlers utilisent (compatible
// avec l'arg réel passé par FullCalendar, qui contient ces champs + d'autres).
type EventDragArg = { event: EventApi; el?: HTMLElement; jsEvent?: UIEvent | null };

interface UseAgendaEventDragParams {
  events: CalendarEvent[];
  deleteEvent: (id: string) => void;
  setSelectedEvent: (event: CalendarEvent) => void;
  setShowEditEventModal: (open: boolean) => void;
  setCalendarKey: React.Dispatch<React.SetStateAction<number>>;
  setMobileCalendarKey: React.Dispatch<React.SetStateAction<number>>;
  // Événement SANS tâche liée déposé sur la sidebar → au lieu de le supprimer,
  // on propose de créer une tâche à partir de ses infos (nom, horaires…).
  onDropUnlinkedEvent?: (event: CalendarEvent) => void;
}

// Gère le cycle de vie d'un drag d'event sur l'agenda (FullCalendar) : drop sur
// la sidebar → suppression, long-press immobile → ouverture EventModal, drag
// intra-calendar → laissé à FullCalendar. `lastDragEndAtRef` est retourné pour
// que `handleEventClick` puisse supprimer le clic résiduel post-drag.
export function useAgendaEventDrag({
  events,
  deleteEvent,
  setSelectedEvent,
  setShowEditEventModal,
  setCalendarKey,
  setMobileCalendarKey,
  onDropUnlinkedEvent,
}: UseAgendaEventDragParams) {
  // Timestamp pour suppression du clic résiduel après un drag — auto-expire après 300ms
  // (jamais "stuck" même si le cleanup ne tourne pas).
  const lastDragEndAtRef = useRef<number>(0);
  const draggedEventIdRef = useRef<string | null>(null);
  const dragEndHandlerRef = useRef<((clientX?: number, clientY?: number) => void) | null>(null);

  const handleEventDragStart = (info: EventDragArg) => {
    draggedEventIdRef.current = info.event.id;

    const je = info.jsEvent as MouseEvent | undefined;
    const startPos = je && typeof je.clientX === 'number' ? { x: je.clientX, y: je.clientY } : null;

    let handled = false;
    let lastX: number | undefined = startPos?.x;
    let lastY: number | undefined = startPos?.y;
    const draggedId = info.event.id;
    const taskId = info.event.extendedProps?.taskId as string | undefined;

    const onPointerMove = (e: PointerEvent) => { lastX = e.clientX; lastY = e.clientY; };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0] || e.changedTouches[0];
      if (t) { lastX = t.clientX; lastY = t.clientY; }
    };

    const removeWindowListeners = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('pointercancel', onCancel);
    };

    const handleEnd = (clientX?: number, clientY?: number) => {
      if (handled) return;
      handled = true;
      dragEndHandlerRef.current = null;
      removeWindowListeners();
      draggedEventIdRef.current = null;
      lastDragEndAtRef.current = Date.now();

      const x = typeof clientX === 'number' ? clientX : lastX;
      const y = typeof clientY === 'number' ? clientY : lastY;

      // 1) Drop sur la sidebar → suppression
      if (typeof x === 'number' && typeof y === 'number') {
        const sidebar = document.getElementById('agenda-task-sidebar-dropzone');
        if (sidebar) {
          const rect = sidebar.getBoundingClientRect();
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            const masterId = getMasterId(draggedId);
            const ev = events.find(e2 => e2.id === masterId);
            if (ev && !ev.taskId) {
              // Event non rattaché à une tâche → propose la création d'une
              // tâche à partir de ses infos, sans le supprimer (FC le fait
              // revenir naturellement à sa position d'origine).
              onDropUnlinkedEvent?.(ev);
              return;
            }
            if (ev) {
              // Quand un event FC est droppé hors de ses drop zones, FC entre
              // dans un état d'auto-revert qui retient la référence DOM de
              // l'event. Même si React Query retire l'event de son cache
              // (optimistic update de useDeleteEvent), FC ne se re-sync pas et
              // garde un ghost visible + bloque tous les pointer events suivants.
              //
              // Solution nucléaire mais fiable : bumper la key de FullCalendar
              // pour forcer un remount complet (qui se re-initialise sur la
              // bonne date via mobileSelectedDate / currentView). On défère
              // mutation + remount au prochain tick pour laisser FC sortir
              // proprement de son pointerup handler.
              setTimeout(() => {
                deleteEvent(ev.id);
                setCalendarKey(k => k + 1);
                setMobileCalendarKey(k => k + 1);
              }, 0);
            }
            return;
          }
        }
      }

      // 2) Long-press sans mouvement → traiter comme un clic (ouvrir EventModal)
      if (
        startPos &&
        typeof x === 'number' && typeof y === 'number' &&
        Math.abs(x - startPos.x) < 5 && Math.abs(y - startPos.y) < 5
      ) {
        const ev = findSourceEvent(events, draggedId, taskId);
        if (ev) {
          setSelectedEvent(ev);
          setShowEditEventModal(true);
        }
        return;
      }

      // 3) Drag intra-calendar normal → FC gère eventDrop naturellement.
    };

    const onPointerUp = (e: PointerEvent) => handleEnd(e.clientX, e.clientY);
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      handleEnd(t?.clientX, t?.clientY);
    };
    const onCancel = () => handleEnd();

    dragEndHandlerRef.current = handleEnd;
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('pointercancel', onCancel);
  };

  const handleEventDragStop = (info: EventDragArg) => {
    const je = info.jsEvent as MouseEvent | undefined;
    dragEndHandlerRef.current?.(je?.clientX, je?.clientY);
  };

  return { lastDragEndAtRef, handleEventDragStart, handleEventDragStop };
}
