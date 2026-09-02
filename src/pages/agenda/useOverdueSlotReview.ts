// ═══════════════════════════════════════════════════════════════════
// REVUE DES CRÉNEAUX DE TÂCHE PASSÉS
// ═══════════════════════════════════════════════════════════════════
//
// Extrait d'`AgendaPage` le 2026-09-02. Motif : le cliquet d'architecture
// (`src/architecture.guard.test.ts`) est un budget de lignes qui ne remonte
// jamais. Les correctifs R-16 et R-18 ont fait grossir quatre fichiers déjà
// hors budget de 36 lignes au total ; la réponse du dépôt à ce cas est
// documentée et n'est pas de relever le plafond, c'est de compenser par un
// découpage. Ce bloc était le meilleur candidat : quatre gestionnaires, un
// état et un dérivé, qui ne parlent qu'entre eux.
//
// Ce fichier ne change AUCUN comportement : le corps de chaque gestionnaire
// est repris à l'identique, seules les dépendances passent désormais par des
// paramètres au lieu d'être capturées par fermeture.
//
// ⚠️ `handleSlotPostpone` calcule TOUT dans l'espace d'affichage (l'heure du
// fuseau choisi) puis retire le décalage une seule fois à la fin. C'est le
// correctif R-18 : la version d'avant lisait l'heure de départ et posait
// « demain » en heure machine, donc le créneau reporté ne revenait pas à
// l'heure attendue pour qui a réglé un fuseau manuel.

import React, { useState } from 'react';
import { findOverdueTaskSlots, type OverdueTaskSlot } from './overdue-slots';
import { showUndoToast } from '@/lib/undo-toast';
import { fromDisplayISO, toDisplayISO, displayNow, type TimezonePref } from '@/lib/timezone';
import type { Task } from '@/modules/tasks/types';
import type { CalendarEvent } from '@/modules/events';

/** Ce dont la revue a besoin pour agir, sans rien savoir de React Query. */
interface OverdueSlotReviewDeps {
  events: CalendarEvent[];
  tasks: Task[];
  tzPref: TimezonePref;
  /** Bascule la complétion d'une tâche (la file ne contient que des non complétées). */
  toggleTaskComplete: (taskId: string) => void;
  updateEvent: (id: string, updates: { start: string; end: string }) => void;
  deleteEvent: (id: string) => void;
  deleteTask: (taskId: string) => void;
  /** Recree l'evenement supprime, sous SON identifiant (annulation). */
  restoreEvent: (event: CalendarEvent) => void;
  /** Recree la tache supprimee, sous SON identifiant (annulation). */
  restoreTask: (task: Task) => void;
  /** Libellé du toast d'annulation, traduit par l'appelant. */
  deletedLabel: string;
}

export function useOverdueSlotReview({
  events,
  tasks,
  tzPref,
  toggleTaskComplete,
  updateEvent,
  deleteEvent,
  deleteTask,
  restoreEvent,
  restoreTask,
  deletedLabel,
}: OverdueSlotReviewDeps) {
  // Créneaux écartés pendant CETTE session : on ne les repropose pas.
  const [snoozedSlotIds, setSnoozedSlotIds] = useState<Set<string>>(new Set());

  const overdueSlots = React.useMemo(
    () => findOverdueTaskSlots(events, tasks).filter((s) => !snoozedSlotIds.has(s.event.id)),
    [events, tasks, snoozedSlotIds],
  );
  const currentReviewSlot = overdueSlots[0] ?? null;

  const dismissReviewSlot = (eventId: string) =>
    setSnoozedSlotIds((prev) => new Set(prev).add(eventId));

  // Réalisée → valide la tâche côté tâche (comme partout ailleurs : toggle +
  // toast d'annulation). Filtrée à « non complétée », donc le toggle = valider.
  const handleSlotValidate = (slot: OverdueTaskSlot) => {
    if (!slot.task.completed) toggleTaskComplete(slot.task.id);
    dismissReviewSlot(slot.event.id);
  };

  // Reporter → replace le créneau à DEMAIN (relatif à maintenant) en conservant
  // l'heure de début et la durée d'origine. Toujours dans le futur, même pour un
  // créneau en retard de plusieurs jours (sinon le modal réapparaîtrait).
  const handleSlotPostpone = (slot: OverdueTaskSlot) => {
    const origDisplay = new Date(toDisplayISO(slot.event.start, tzPref));
    const durationMs = Math.max(
      new Date(slot.event.end).getTime() - new Date(slot.event.start).getTime(),
      0,
    );
    const next = displayNow(tzPref);
    next.setDate(next.getDate() + 1);
    next.setHours(origDisplay.getHours(), origDisplay.getMinutes(), 0, 0);
    const newStart = fromDisplayISO(next.toISOString(), tzPref);
    const newEnd = fromDisplayISO(
      new Date(next.getTime() + durationMs).toISOString(),
      tzPref,
    );
    updateEvent(slot.event.id, { start: newStart, end: newEnd });
    dismissReviewSlot(slot.event.id);
  };

  // Abandonner → supprime la tâche et son créneau agenda, AVEC annulation.
  //
  // 🔴 R-07. C'était la seule action irréversible du produit, et elle se
  // trouvait dans le seul modal qui s'ouvre sans qu'on l'ait demandé : un clic
  // mal placé sur un dialogue inattendu détruisait une tâche définitivement,
  // alors que toutes les autres suppressions ont leur toast « Annuler ».
  //
  // Les deux objets reviennent sous LEURS identifiants (R-08), sinon la tâche
  // restaurée perdrait son rattachement à ses listes et à son KR.
  const handleSlotDelete = (slot: OverdueTaskSlot) => {
    const eventSnapshot = slot.event;
    const taskSnapshot = slot.task;
    deleteEvent(eventSnapshot.id);
    deleteTask(taskSnapshot.id);
    dismissReviewSlot(eventSnapshot.id);
    showUndoToast(deletedLabel, () => {
      restoreTask(taskSnapshot);
      restoreEvent(eventSnapshot);
    });
  };

  const handleSlotSnooze = () => {
    if (currentReviewSlot) dismissReviewSlot(currentReviewSlot.event.id);
  };

  return {
    overdueSlots,
    currentReviewSlot,
    handleSlotValidate,
    handleSlotPostpone,
    handleSlotDelete,
    handleSlotSnooze,
  };
}
