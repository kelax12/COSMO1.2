// ═══════════════════════════════════════════════════════════════════
// ACTIONS SUR UN ÉVÉNEMENT — créer, modifier, supprimer, dupliquer
// ═══════════════════════════════════════════════════════════════════
//
// Extrait d'`AgendaPage` le 2026-09-02. Motif : le cliquet d'architecture
// (`src/architecture.guard.test.ts`) est un budget de lignes qui ne remonte
// jamais, et l'externalisation des chaînes (R-05) l'a de nouveau dépassé. La
// réponse documentée du dépôt est de compenser par un découpage, pas de
// relever le plafond. Ce bloc est cohérent : six gestionnaires qui ferment
// tous les mêmes modales et ne parlent qu'aux mutations d'événements.
//
// Deux règles y survivent, et ce sont les deux raisons de ne pas simplifier :
//
//   - supprimer UNE occurrence d'un événement récurrent n'efface rien : on
//     ajoute sa date aux `exceptions` du master. L'annulation retire cette
//     date, et l'occurrence réapparaît.
//   - dupliquer RETIRE le `taskId`. Deux événements portant le même feraient
//     échouer la résolution par id+taskId ailleurs (glisser, clic, redimension)
//     et l'un des deux serait modifié à la place de l'autre, en silence.

import { useEffect } from 'react';
import { showUndoToast } from '@/lib/undo-toast';
import { findNextFreeSlot } from './free-slot';
import type {
  CalendarEvent,
  CreateEventInput,
  UpdateEventInput,
} from '@/modules/events';

interface AgendaEventActionsDeps {
  events: CalendarEvent[];
  /** Événements déjà mis en forme pour le calendrier (recherche de créneau libre). */
  calendarEvents: { start: string; end: string }[];
  /** Date 'YYYY-MM-DD' de l'occurrence cliquée, `null` hors récurrence. */
  selectedInstanceDate: string | null;

  createEvent: (input: CreateEventInput) => void;
  updateEvent: (id: string, updates: UpdateEventInput) => void;
  deleteEvent: (id: string) => void;
  /** Recrée l'événement sous SON identifiant (R-08). */
  restoreEvent: (event: CalendarEvent) => void;

  closeAddModal: () => void;
  closeEditModal: () => void;
  openAddModal: (slot: { start: string; end: string }) => void;
  unselectCalendar: () => void;

  /** Libellés, traduits par l'appelant. */
  labels: {
    occurrenceDeleted: string;
    eventDeleted: string;
    /** Suffixe du titre d'une copie, ex. « (copie) ». */
    copySuffix: string;
  };
}

export function useAgendaEventActions({
  events,
  calendarEvents,
  selectedInstanceDate,
  createEvent,
  updateEvent,
  deleteEvent,
  restoreEvent,
  closeAddModal,
  closeEditModal,
  openAddModal,
  unselectCalendar,
  labels,
}: AgendaEventActionsDeps) {
  const handleAddEvent = (eventData: CreateEventInput) => {
    createEvent({ ...eventData, taskId: eventData.taskId || undefined });
    closeAddModal();
    setTimeout(unselectCalendar, 100);
  };

  const handleUpdateEvent = (eventId: string, eventData: UpdateEventInput) => {
    updateEvent(eventId, eventData);
    closeEditModal();
  };

  const handleDeleteEvent = (eventId: string) => {
    const master = events.find((e) => e.id === eventId);
    const isRecurring = master && (master.recurrence ?? 'none') !== 'none';
    const instanceDate = selectedInstanceDate;

    if (isRecurring && instanceDate && master) {
      // Une seule occurrence : sa date entre dans les exceptions du master.
      const prevExceptions = master.exceptions ?? [];
      updateEvent(eventId, { exceptions: [...prevExceptions, instanceDate] });
      showUndoToast(labels.occurrenceDeleted, () => {
        // Annulation : on retire la date, l'occurrence réapparaît.
        updateEvent(eventId, { exceptions: prevExceptions });
      });
    } else if (master) {
      deleteEvent(eventId);
      // L'identifiant revient avec l'événement (R-08) : les liens `taskId` et
      // les références de l'agenda pointeraient sinon dans le vide.
      showUndoToast(labels.eventDeleted, () => restoreEvent(master));
    }
    closeEditModal();
  };

  /** Copie aux mêmes horaires, SANS le `taskId` (cf. en-tête). */
  const handleDuplicateEvent = (eventId: string) => {
    const source = events.find((e) => e.id === eventId);
    if (!source) return;
    const { id: _id, taskId: _taskId, ...rest } = source;
    createEvent({ ...rest, title: `${source.title} ${labels.copySuffix}` } as CreateEventInput);
    closeEditModal();
  };

  /** « Nouveau » sans plage sélectionnée : propose le prochain créneau libre. */
  const handleOpenAddModal = () => openAddModal(findNextFreeSlot(calendarEvents));

  const handleCloseAddModal = () => {
    closeAddModal();
    setTimeout(unselectCalendar, 100);
  };

  // FAB global (`Layout.tsx`) : sur /agenda, il est l'unique point de création,
  // le « + » de l'en-tête mobile ayant été retiré comme doublon.
  useEffect(() => {
    const handler = () => handleOpenAddModal();
    window.addEventListener('open-agenda-create', handler);
    return () => window.removeEventListener('open-agenda-create', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarEvents]);

  return {
    handleAddEvent,
    handleUpdateEvent,
    handleDeleteEvent,
    handleDuplicateEvent,
    handleOpenAddModal,
    handleCloseAddModal,
  };
}
